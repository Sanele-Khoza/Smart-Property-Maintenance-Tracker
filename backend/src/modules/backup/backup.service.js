import { spawn } from 'child_process';
import { createHash } from 'crypto';
import { createReadStream, constants as fsConstants } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import config from '../../config/index.js';
import logger from '../../shared/utils/logger.js';
import AppError from '../../shared/errors/AppError.js';
import { query } from '../../db/connection.js';

/**
 * Real PostgreSQL backup via pg_dump (native custom-format archive).
 *
 * - Files are written under BACKUP_DIR / YYYY-MM-DD / SPMT_*.dump
 * - History + integrity details are persisted in the backup_history table
 * - Backups are verified with `pg_restore --list` (reads the archive TOC)
 * - Retention prunes old archives after a successful creation and never
 *   deletes the only remaining backup.
 */

const SAFE_FILE_RE = /^[A-Za-z0-9._-]+$/;
const SAFE_STDERR_RE = /password/i;

let running = false;

function pad(n) {
  return String(n).padStart(2, '0');
}

function dateSubdir(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function timestamp(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function pgEnv() {
  return {
    ...process.env,
    PGHOST: process.env.DB_HOST || 'localhost',
    PGPORT: process.env.DB_PORT || '5432',
    PGDATABASE: process.env.DB_NAME || 'spmt',
    PGUSER: process.env.DB_USER || 'spmt_user',
    PGPASSWORD: process.env.DB_PASSWORD || 'spmt_pass',
  };
}

function sanitizeErr(raw) {
  return String(raw || '')
    .split('\n')
    .filter((line) => line.trim() && !SAFE_STDERR_RE.test(line))
    .join('\n')
    .trim()
    .slice(0, 1500) || 'Unknown error';
}

function runPg(tool, args) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(tool, args, {
        env: pgEnv(),
        windowsHide: true,
        shell: false,
      });
    } catch (err) {
      resolve({ code: -1, stderr: err.message, stdout: '' });
      return;
    }
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d) => { stdout += d; });
    child.stderr?.on('data', (d) => { stderr += d; });
    child.on('error', (err) => resolve({ code: -1, stderr: err.message, stdout }));
    child.on('close', (code) => resolve({ code, stderr, stdout }));
  });
}

async function exists(filePath) {
  try { await fs.access(filePath); return true; } catch { return false; }
}

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (d) => hash.update(d));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function listArchives(baseDir) {
  let names = [];
  try {
    const entries = await fs.readdir(baseDir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(baseDir, entry.name);
      if (entry.isDirectory()) {
        names = names.concat(await listArchives(full));
      } else if (entry.isFile() && /^SPMT_.+\.dump$/.test(entry.name)) {
        names.push(full);
      }
    }
  } catch (err) {
    logger.warn(`Could not scan backup dir ${baseDir}: ${err.message}`);
  }
  return names;
}

async function writeMetadata(subDir, entry) {
  try {
    const metaPath = path.join(subDir, 'metadata.json');
    let items = [];
    if (await exists(metaPath)) {
      try {
        const raw = await fs.readFile(metaPath, 'utf8');
        items = JSON.parse(raw).backups || [];
      } catch { items = []; }
    }
    items.push(entry);
    items.sort((a, b) => (a.filename > b.filename ? -1 : a.filename < b.filename ? 1 : 0));
    await fs.writeFile(metaPath, JSON.stringify({ backups: items.slice(0, 100) }, null, 2), 'utf8');
  } catch (err) {
    logger.warn(`metadata.json not written: ${err.message}`);
  }
}

async function applyRetention() {
  const max = Math.max(1, parseInt(config.backup.retentionCount, 10) || 1);
  const archives = (await listArchives(config.backup.dir)).sort().reverse();
  if (archives.length <= max) return [];
  const toDelete = archives.slice(max);
  const removed = [];
  for (const filePath of toDelete) {
    try {
      await fs.unlink(filePath);
      removed.push(path.basename(filePath));
      logger.info(`Retention removed old backup: ${filePath}`);
    } catch (err) {
      logger.warn(`Retention could not remove ${filePath}: ${err.message}`);
    }
  }
  return removed;
}

async function recordAudit({ action, userId, targetType, targetId, details, ip, severity = 'INFO', secure = false }) {
  try {
    const ipAddr = ip || null;
    if (secure) {
      await query(
        `INSERT INTO security_audit_log (user_id, event_type, details, ip_address, severity)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId || null, action, details || null, ipAddr, severity]
      );
    }
    await query(
      `INSERT INTO audit_log (action, performed_by, target_type, target_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [action, userId || null, targetType || null, targetId ? String(targetId) : null, details || null, ipAddr]
    );
  } catch (err) {
    logger.error(`Backup audit insert failed: ${err.message}`);
  }
}

async function insertHistory({ filename, filePath, type, status, userId, errorMessage = null }) {
  const result = await query(
    `INSERT INTO backup_history (filename, backup_path, backup_type, status, error_message, created_by)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [filename, filePath, type, status, errorMessage, userId || null]
  );
  return result.rows[0].id;
}

async function reconcileStaleBackups() {
  try {
    const result = await query(
      `UPDATE backup_history
          SET status = 'FAILED', error_message = 'Backup was interrupted (server restarted before completion)',
              completed_at = NOW()
        WHERE status = 'RUNNING'
       RETURNING filename`
    );
    if (result.rows.length > 0) {
      logger.warn(`Marked ${result.rows.length} interrupted backup(s) as FAILED: ${result.rows.map((r) => r.filename).join(', ')}`);
    }
    return result.rows.length;
  } catch (err) {
    logger.warn(`Could not reconcile stale backups: ${err.message}`);
    return 0;
  }
}

async function createBackup({ type = 'MANUAL', userId = null, ip = null } = {}) {
  if (running) {
    throw AppError.conflict('A backup is already running. Please wait for it to finish.');
  }
  running = true;
  const startedAt = new Date();
  const now = new Date();
  const subDir = path.join(config.backup.dir, dateSubdir(now));
  let filename = `SPMT_${timestamp(now)}.dump`;
  let filePath = path.join(subDir, filename);
  for (let i = 1; await exists(filePath); i += 1) {
    filename = `SPMT_${timestamp(now)}_${i}.dump`;
    filePath = path.join(subDir, filename);
  }
  let historyId = null;

  try {
    if (!SAFE_FILE_RE.test(filename)) {
      throw AppError.internal('Refusing to create backup with unsafe filename');
    }
    await fs.mkdir(subDir, { recursive: true });
    if (await exists(filePath)) {
      throw AppError.conflict(`A backup with this filename already exists: ${filename}`);
    }
    if (await exists(config.backup.dir)) {
      await fs.access(config.backup.dir, fsConstants.W_OK).catch(() => {
        throw AppError.internal('Backup directory exists but is not writable');
      });
    }

    historyId = await insertHistory({ filename, filePath, type, status: 'RUNNING', userId });

    const res = await runPg(config.backup.pgDumpPath, [
      '--format=custom',
      `--file=${filePath}`,
      '--no-owner',
      '--no-privileges',
    ]);

    if (res.code !== 0) {
      const reason = sanitizeErr(res.stderr);
      await query(
        `UPDATE backup_history SET status = 'FAILED', error_message = $2, completed_at = NOW() WHERE id = $1`,
        [historyId, reason]
      );
      await fs.unlink(filePath).catch(() => {});
      logger.error(`pg_dump failed for ${filename}: ${reason}`);
      throw AppError.internal(`Backup creation failed: ${reason}`, { code: 'BACKUP_FAILED' });
    }

    const stat = await fs.stat(filePath);
    if (!stat || stat.size === 0) {
      await query(
        `UPDATE backup_history SET status = 'FAILED', error_message = $2, completed_at = NOW() WHERE id = $1`,
        [historyId, 'pg_dump produced an empty file']
      );
      await fs.unlink(filePath).catch(() => {});
      throw AppError.internal('Backup creation failed: pg_dump produced an empty file', { code: 'BACKUP_FAILED' });
    }

    const sha = await sha256File(filePath);

    const verify = await runPg(config.backup.pgRestorePath, ['--list', filePath]);
    const verified = verify.code === 0;
    if (!verified) {
      logger.error(`Backup verification failed for ${filename}: ${sanitizeErr(verify.stderr)}`);
    }

    const completedAt = new Date();
    await query(
      `UPDATE backup_history
         SET status = 'SUCCESS', size_bytes = $2, sha256 = $3, verified = $4,
             completed_at = NOW()
       WHERE id = $1`,
      [historyId, stat.size, sha, verified]
    );

    await writeMetadata(subDir, {
      filename,
      backupType: type,
      status: verified ? 'SUCCESS' : 'CREATED_UNVERIFIED',
      sizeBytes: stat.size,
      sha256: sha,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      verified,
    });

    const removed = await applyRetention();
    await recordAudit({
      action: 'BACKUP_CREATED',
      userId,
      targetType: 'backup',
      targetId: filename,
      details: `${type} backup ${filename} (${stat.size} bytes)${removed.length ? `; removed ${removed.length} old backup(s)` : ''}`,
      ip,
    });

    logger.info(`Backup created: ${filename} (${stat.size} bytes, sha256 ${sha.slice(0, 12)}…, verified=${verified})`);
    return {
      success: true,
      data: {
        id: historyId,
        filename,
        backupPath: filePath,
        backupType: type,
        sizeBytes: stat.size,
        sha256: sha,
        verified,
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        removed,
      },
      message: verified ? 'Backup created and verified successfully' : 'Backup created but verification reported an issue',
    };
  } catch (err) {
    if (historyId) {
      try {
        await query(
          `UPDATE backup_history SET status = 'FAILED', error_message = $2, completed_at = NOW() WHERE id = $1`,
          [historyId, sanitizeErr(err.message).slice(0, 1500)]
        );
      } catch (ignore) { /* history unavailable */ }
    }
    throw err;
  } finally {
    running = false;
  }
}

async function listBackups({ limit = 50, offset = 0 } = {}) {
  const safeLimit = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
  const safeOffset = Math.max(0, parseInt(offset, 10) || 0);
  const result = await query(
    `SELECT * FROM backup_history ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [safeLimit, safeOffset]
  );
  return { success: true, data: { backups: result.rows }, pagination: { limit: safeLimit, offset: safeOffset } };
}

async function getBackup(id) {
  const row = await findByHistoryId(id);
  return { success: true, data: { backup: row } };
}

async function findByHistoryId(id) {
  if (!id || typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) {
    throw AppError.notFound('Backup not found');
  }
  const result = await query('SELECT * FROM backup_history WHERE id = $1', [id]);
  if (result.rows.length === 0) throw AppError.notFound('Backup not found');
  return result.rows[0];
}

async function verifyBackup(id) {
  const row = await findByHistoryId(id);
  if (!(await exists(row.backup_path))) {
    await query(
      `UPDATE backup_history SET verified = FALSE, error_message = 'Backup file is missing from disk' WHERE id = $1`,
      [id]
    );
    return { success: true, data: { verified: false, reason: 'Backup file is missing from disk' } };
  }

  let verifyReason = 'ok';
  let verified = true;
  const res = await runPg(config.backup.pgRestorePath, ['--list', row.backup_path]);
  if (res.code !== 0) {
    verified = false;
    verifyReason = sanitizeErr(res.stderr);
  } else if (row.sha256) {
    const current = await sha256File(row.backup_path);
    if (current !== row.sha256) {
      verified = false;
      verifyReason = 'Backup hash does not match the value recorded at creation time (file may be corrupted)';
    }
  }

  await query(
    `UPDATE backup_history SET verified = $2, error_message = NULL WHERE id = $1`,
    [id, verified]
  );
  return { success: true, data: { verified, reason: verifyReason } };
}

async function restoreBackup(id, { confirm = false, userId = null, ip = null } = {}) {
  if (!config.backup.restoreEnabled) {
    throw AppError.forbidden('Restore is disabled by server configuration (BACKUP_RESTORE_ENABLED=false)');
  }
  if (confirm !== true) {
    throw AppError.badRequest(
      'Restore requires explicit confirmation (body: { confirm: true }). Restoring will overwrite the current database and destroy any data created after the backup.'
    );
  }
  const row = await findByHistoryId(id);
  if (row.status !== 'SUCCESS') {
    throw AppError.badRequest('Cannot restore from a backup that did not complete successfully');
  }
  if (!(await exists(row.backup_path))) {
    throw AppError.notFound(`Backup file is missing from disk: ${row.filename}`);
  }

  await recordAudit({
    action: 'BACKUP_RESTORE_REQUESTED',
    userId,
    targetType: 'backup',
    targetId: row.filename,
    details: `Restore requested from ${row.filename}`,
    ip,
    secure: true,
    severity: 'WARNING',
  });

  const res = await runPg(config.backup.pgRestorePath, [
    '--clean',
    '--if-exists',
    '--no-owner',
    '--no-privileges',
    '--verbose',
    `--dbname=${process.env.DB_NAME || 'spmt'}`,
    row.backup_path,
  ]);

  const summary = sanitizeErr(res.stdout || res.stderr).split('\n').slice(0, 5).join('\n');
  if (res.code !== 0) {
    const reason = sanitizeErr(res.stderr);
    await recordAudit({
      action: 'BACKUP_RESTORE_FAILED',
      userId,
      targetType: 'backup',
      targetId: row.filename,
      details: `Restore from ${row.filename} failed: ${reason}`,
      ip,
      secure: true,
      severity: 'ERROR',
    });
    logger.error(`Restore from ${row.filename} failed: ${reason}`);
    throw AppError.internal(`Restore failed: ${reason}`, { code: 'RESTORE_FAILED' });
  }

  await recordAudit({
    action: 'BACKUP_RESTORE_COMPLETED',
    userId,
    targetType: 'backup',
    targetId: row.filename,
    details: `Database restored from ${row.filename}`,
    ip,
    secure: true,
    severity: 'WARNING',
  });
  logger.info(`Database restored from ${row.filename}`);
  return { success: true, data: { filename: row.filename, summary }, message: 'Database restored from backup' };
}

async function getDbStats() {
  try {
    const sizeRes = await query('SELECT pg_database_size(current_database()) AS size_bytes');
    const tblRes = await query(
      `SELECT count(*)::int AS table_count
         FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
    );
    return {
      dbSizeBytes: sizeRes.rows[0]?.size_bytes ? Number(sizeRes.rows[0].size_bytes) : null,
      tableCount: tblRes.rows[0]?.table_count ?? null,
    };
  } catch (err) {
    logger.warn(`Could not compute DB stats: ${err.message}`);
    return { dbSizeBytes: null, tableCount: null };
  }
}

async function getSchedule() {
  const stats = await getDbStats();
  return {
    success: true,
    data: {
      scheduleEnabled: config.backup.scheduleEnabled,
      scheduleCron: config.backup.scheduleCron,
      retentionCount: Math.max(1, parseInt(config.backup.retentionCount, 10) || 1),
      restoreEnabled: config.backup.restoreEnabled,
      backupDir: config.backup.dir,
      dbSizeBytes: stats.dbSizeBytes,
      tableCount: stats.tableCount,
      lastBackups: (await listBackups({ limit: 5 })).data.backups,
      runningNow: running,
    },
  };
}

export { createBackup, listBackups, getBackup, verifyBackup, restoreBackup, getSchedule, applyRetention, reconcileStaleBackups };
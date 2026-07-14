import { query } from '../../db/connection.js';
import { run as runMigrations } from '../../db/migrations/index.js';
import { seed } from '../../db/seeds/index.js';
import AppError from '../../shared/errors/AppError.js';
import logger from '../../shared/utils/logger.js';

const TABLES = ['users', 'properties', 'units', 'leases', 'categories', 'tickets', 'ticket_status_history', 'technicians', 'availability_slots', 'materials', 'notifications', 'documents', 'ratings', 'inference_logs', 'system_settings', 'sla_config', 'ai_threshold_config', 'audit_logs', 'security_audit_logs', 'messages', 'ticket_comments', 'job_evidence', 'completion_reports'];

const getUsers = async (req, res, next) => {
  try {
    const conditions = [];
    const params = [];
    let idx = 1;
    if (req.query.status) { conditions.push(`account_status = $${idx++}`); params.push(req.query.status); }
    if (req.query.role) { conditions.push(`role = $${idx++}`); params.push(req.query.role); }
    if (req.query.search) { conditions.push(`(name ILIKE $${idx} OR surname ILIKE $${idx} OR email ILIKE $${idx})`); params.push(`%${req.query.search}%`); idx++; }
    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const result = await query(`SELECT id, name, surname, email, phone, role, account_status, approved, approved_at, last_login, created_at FROM users ${whereClause} ORDER BY created_at DESC`, params);
    res.json({ success: true, data: { users: result.rows } });
  } catch (err) { next(err); }
};

const approveUser = async (req, res, next) => {
  try { await query("UPDATE users SET approved = TRUE, approved_at = NOW(), account_status = 'ACTIVE' WHERE id = $1", [Number(req.params.id)]); res.json({ success: true, message: 'User approved' }); } catch (err) { next(err); }
};

const deactivateUser = async (req, res, next) => {
  try { await query("UPDATE users SET account_status = 'DEACTIVATED' WHERE id = $1", [Number(req.params.id)]); res.json({ success: true, message: 'User deactivated' }); } catch (err) { next(err); }
};

const reactivateUser = async (req, res, next) => {
  try { await query("UPDATE users SET account_status = 'ACTIVE' WHERE id = $1", [Number(req.params.id)]); res.json({ success: true, message: 'User reactivated' }); } catch (err) { next(err); }
};

const changeRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!role || !['SYSTEM_ADMIN', 'PROPERTY_MANAGER', 'TENANT', 'SERVICE_PROVIDER'].includes(role)) return res.status(400).json({ success: false, message: 'Invalid role' });
    await query('UPDATE users SET role = $1 WHERE id = $2', [role, Number(req.params.id)]);
    res.json({ success: true, message: 'Role updated' });
  } catch (err) { next(err); }
};

const unlockUser = async (req, res, next) => {
  try { await query('UPDATE users SET login_attempts = 0, locked_until = NULL WHERE id = $1', [Number(req.params.id)]); res.json({ success: true, message: 'User unlocked' }); } catch (err) { next(err); }
};

const resetData = async (req, res, next) => {
  try {
    for (const table of TABLES) { await query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`); }
    await runMigrations();
    await seed();
    logger.info('Database reset completed');
    res.json({ success: true, message: 'Data reset to seed state' });
  } catch (err) { next(err); }
};

const backupData = async (req, res, next) => {
  try {
    const data = { exportedAt: new Date().toISOString() };
    for (const table of TABLES) {
      const result = await query(`SELECT * FROM ${table}`);
      data[table] = result.rows;
    }
    res.json({ success: true, data, message: 'Backup completed' });
  } catch (err) { next(err); }
};

const restoreData = async (req, res, next) => {
  try {
    const payload = req.body;
    if (!payload || typeof payload !== 'object') throw AppError.badRequest('Invalid restore data');
    let count = 0;
    for (const table of TABLES) {
      if (!Array.isArray(payload[table])) continue;
      for (const row of payload[table]) {
        const keys = Object.keys(row).filter(k => k !== 'id' && k !== 'created_at' && k !== 'updated_at');
        if (!keys.length) continue;
        const vals = keys.map((_, i) => `$${i + 1}`);
        const values = keys.map(k => typeof row[k] === 'object' && row[k] !== null ? JSON.stringify(row[k]) : row[k]);
        await query(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${vals.join(',')}) ON CONFLICT DO NOTHING`, values);
        count++;
      }
    }
    logger.info(`Restore completed: ${count} records`);
    res.json({ success: true, message: `Restore complete. ${count} records processed.` });
  } catch (err) { next(err); }
};

export { getUsers, approveUser, deactivateUser, reactivateUser, changeRole, unlockUser, resetData, backupData, restoreData };

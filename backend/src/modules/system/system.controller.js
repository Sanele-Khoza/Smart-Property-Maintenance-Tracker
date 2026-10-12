import { query, pool } from '../../db/connection.js';
import AppError from '../../shared/errors/AppError.js';

const getSettings = async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM system_config ORDER BY key');
    res.json({ success: true, data: { settings: result.rows } });
  } catch (err) { next(err); }
};

const updateSettings = async (req, res, next) => {
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') throw AppError.badRequest('Settings object required');
    for (const [key, value] of Object.entries(settings)) {
      await query(
        "INSERT INTO system_config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()",
        [key, String(value)]
      );
    }
    const result = await query('SELECT * FROM system_config ORDER BY key');
    res.json({ success: true, data: { settings: result.rows }, message: 'Settings updated' });
  } catch (err) { next(err); }
};

const getSla = async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM sla_config ORDER BY priority');
    res.json({ success: true, data: { slaConfig: result.rows } });
  } catch (err) { next(err); }
};

const updateSla = async (req, res, next) => {
  try {
    const { priority, responseMinutes, resolutionMinutes } = req.body;
    if (!priority) throw AppError.badRequest('Priority is required');
    await query(
      'INSERT INTO sla_config (priority, response_minutes, resolution_minutes) VALUES ($1, $2, $3) ON CONFLICT (priority) DO UPDATE SET response_minutes = EXCLUDED.response_minutes, resolution_minutes = EXCLUDED.resolution_minutes',
      [priority, responseMinutes, resolutionMinutes]
    );
    res.json({ success: true, message: 'SLA config updated' });
  } catch (err) { next(err); }
};

const getThresholds = async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM ai_threshold_config ORDER BY key');
    res.json({ success: true, data: { thresholds: result.rows } });
  } catch (err) { next(err); }
};

/* Live system health: every section is best-effort and reports null when its
   source is unavailable, so the endpoint itself stays reachable. */
const getHealth = async (req, res, next) => {
  try {
    const health = {
      timestamp: new Date().toISOString(),
      api: { status: 'up', uptimeSeconds: Math.floor(process.uptime()), memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) },
      db: null,
      ai: null,
      sla: null,
      security: null,
    };

    try {
      const t0 = Date.now();
      await query('SELECT 1');
      const latencyMs = Date.now() - t0;
      const [dbRow, verRow, sizeRow] = await Promise.all([
        query('SELECT current_database() AS database').then(r => r.rows[0]),
        query('SELECT version() AS version').then(r => r.rows[0]),
        query(`SELECT pg_size_pretty(pg_database_size(current_database())) AS size`).then(r => r.rows[0]),
      ]);
      const pgVersion = String(verRow?.version || '').split(' ').slice(0, 2).join(' ');
      health.db = {
        status: 'up',
        latencyMs,
        database: dbRow?.database || null,
        version: pgVersion || null,
        size: sizeRow?.size || null,
        pool: { total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount },
      };
    } catch (err) {
      health.db = { status: 'down', error: err.message };
    }

    try {
      const byService = (await query(
        `SELECT service,
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')::int AS last24h,
                ROUND(AVG(COALESCE(text_confidence, visual_confidence))::numeric, 3)::float AS avgConfidence,
                COUNT(*) FILTER (WHERE conflict_detected = TRUE)::int AS conflicts,
                MAX(created_at) AS lastAt
         FROM ai_inference_log GROUP BY 1 ORDER BY 2 DESC`
      )).rows;
      const totals = await query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')::int AS last24h,
                COUNT(*) FILTER (WHERE conflict_detected = TRUE)::int AS conflicts,
                MAX(created_at) AS lastAt
         FROM ai_inference_log`
      ).then(r => r.rows[0]);
      health.ai = { status: 'up', total: totals.total, last24h: totals.last24h, conflicts: totals.conflicts, lastAt: totals.lastAt, services: byService };
    } catch {
      health.ai = null;
    }

    try {
      const [cfg, breached, open] = await Promise.all([
        query('SELECT COUNT(*)::int AS n FROM sla_config').then(r => r.rows[0].n).catch(() => null),
        query('SELECT COUNT(*)::int AS n FROM tickets WHERE sla_breached = TRUE AND deleted_at IS NULL').then(r => r.rows[0].n).catch(() => null),
        query("SELECT COUNT(*)::int AS n FROM tickets WHERE status NOT IN ('Closed', 'Cancelled') AND deleted_at IS NULL").then(r => r.rows[0].n).catch(() => null),
      ]);
      health.sla = { mode: 'on-demand', configCount: cfg, breachedOpen: breached, openTickets: open };
    } catch {
      health.sla = null;
    }

    try {
      const row = await query(
        `SELECT COUNT(*) FILTER (WHERE event_type = 'LOGIN_FAILED' AND created_at > NOW() - INTERVAL '24 hours')::int AS failed24h,
                COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')::int AS total24h
         FROM security_audit_log`
      ).then(r => r.rows[0]);
      health.security = { failedLogins24h: row.failed24h, totalEvents24h: row.total24h };
    } catch {
      health.security = null;
    }

    res.json({ success: true, data: health, message: 'System health retrieved' });
  } catch (err) { next(err); }
};

export { getSettings, updateSettings, getSla, updateSla, getThresholds, getHealth };

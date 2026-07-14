import { query } from '../../db/connection.js';
import AppError from '../../shared/errors/AppError.js';

const getSecurityLogs = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = parseInt(req.query.offset) || 0;
    const conditions = [];
    const params = [];
    let idx = 1;
    if (req.query.severity) { conditions.push(`severity = $${idx++}`); params.push(req.query.severity); }
    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const [logsResult, totalResult] = await Promise.all([
      query(`SELECT * FROM security_audit_log ${whereClause} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`, [...params, limit, offset]),
      query(`SELECT COUNT(*)::int AS count FROM security_audit_log ${whereClause}`, params.slice(0, -2)),
    ]);
    res.json({ success: true, data: { logs: logsResult.rows }, pagination: { limit, offset, total: totalResult.rows[0].count } });
  } catch (err) { next(err); }
};

const createSecurityLog = async (req, res, next) => {
  try {
    const { eventType, details, severity } = req.body;
    if (!eventType) throw AppError.badRequest('Event type required');
    const result = await query(
      'INSERT INTO security_audit_logs (event_type, user_id, details, ip_address, severity) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [eventType, req.user.id, details || null, req.ip || null, severity || 'INFO']
    );
    res.status(201).json({ success: true, data: { id: result.rows[0].id }, message: 'Security log created' });
  } catch (err) { next(err); }
};

export { getSecurityLogs, createSecurityLog };

import { query } from '../../db/connection.js';
import AppError from '../../shared/errors/AppError.js';

const getLogs = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = parseInt(req.query.offset) || 0;
    const [logsResult, totalResult] = await Promise.all([
      query('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]),
      query('SELECT COUNT(*)::int AS count FROM audit_log'),
    ]);
    res.json({ success: true, data: { logs: logsResult.rows }, pagination: { limit, offset, total: totalResult.rows[0].count } });
  } catch (err) { next(err); }
};

const createLog = async (req, res, next) => {
  try {
    const { action, details } = req.body;
    if (!action) throw AppError.badRequest('Action required');
    const result = await query(
      'INSERT INTO audit_log (action, performed_by, target_type, details) VALUES ($1, $2, $3, $4) RETURNING id',
      [action, req.user.id, 'manual', details || null]
    );
    res.status(201).json({ success: true, data: { id: result.rows[0].id }, message: 'Audit log created' });
  } catch (err) { next(err); }
};

export { getLogs, createLog };

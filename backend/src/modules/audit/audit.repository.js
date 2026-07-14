import { query } from '../../db/connection.js';

const getAuditLogs = async (limit, offset) => {
  const [logsResult, totalResult] = await Promise.all([
    query('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]),
    query('SELECT COUNT(*)::int AS count FROM audit_log'),
  ]);
  return { logs: logsResult.rows, total: totalResult.rows[0].count };
};

const getSecurityLogs = async (limit, offset, severity) => {
  const conditions = [];
  const params = [];
  let idx = 1;
  if (severity) {
    conditions.push(`severity = $${idx++}`);
    params.push(severity);
  }
  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  const countParams = [...params];

  const [logsResult, totalResult] = await Promise.all([
    query(`SELECT * FROM security_audit_log ${whereClause} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`, [...params, limit, offset]),
    query(`SELECT COUNT(*)::int AS count FROM security_audit_log ${whereClause}`, countParams),
  ]);
  return { logs: logsResult.rows, total: totalResult.rows[0].count };
};

const createAuditLog = async (action, userId, details) => {
  const result = await query(
    'INSERT INTO audit_log (action, performed_by, target_type, details) VALUES ($1, $2, $3, $4) RETURNING id',
    [action, userId, 'manual', details || null]
  );
  return result.rows[0].id;
};

const createSecurityLog = async (eventType, userId, details, ipAddress, severity) => {
  const result = await query(
    'INSERT INTO security_audit_log (event_type, user_id, details, ip_address, severity) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    [eventType, userId, details || null, ipAddress || null, severity || 'INFO']
  );
  return result.rows[0].id;
};

export { getAuditLogs, getSecurityLogs, createAuditLog, createSecurityLog };

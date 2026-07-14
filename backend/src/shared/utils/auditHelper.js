import logger from './logger.js';

export async function logAudit(pool, { action, performedBy, targetType, targetId, details }) {
  try {
    await pool.query(
      `INSERT INTO audit_log (action, performed_by, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [action, performedBy, targetType, String(targetId), details || null]
    );
  } catch (err) {
    logger.error(`Audit log failed: ${err.message}`);
  }
}

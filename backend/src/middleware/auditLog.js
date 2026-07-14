import { query } from '../db/connection.js';
import logger from '../shared/utils/logger.js';

function auditLog(action, getTarget) {
  return async (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = async function (body) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          const target = typeof getTarget === 'function' ? getTarget(req, res) : getTarget;
          await query(
            `INSERT INTO audit_log (action, performed_by, target_type, target_id, details)
             VALUES ($1, $2, $3, $4, $5)`,
            [action, req.user?.id, target?.type || null, target?.id ? String(target.id) : null, target?.details || null]
          );
        } catch (err) {
          logger.error(`Audit middleware failed: ${err.message}`);
        }
      }
      return originalJson(body);
    };
    next();
  };
}

export default auditLog;

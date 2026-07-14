import { query } from '../../db/connection.js';

const SEVERITY = { INFO: 'INFO', WARN: 'WARN', ERROR: 'ERROR', CRITICAL: 'CRITICAL' };

async function log(eventType, details, userId = null, ipAddress = null, severity = SEVERITY.INFO) {
  try {
    await query(
      `INSERT INTO security_audit_log (user_id, event_type, details, ip_address, severity)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, eventType, details, ipAddress, severity]
    );
  } catch (err) {
    console.error('Failed to write security audit log:', err.message);
  }
}

export { log, SEVERITY };

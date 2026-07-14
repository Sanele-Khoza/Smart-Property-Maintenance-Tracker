import logger from '../../shared/utils/logger.js';
import { query } from '../../db/connection.js';

const TABLES = ['users', 'properties', 'units', 'leases', 'categories', 'tickets', 'ticket_status_history', 'technicians', 'availability_slots', 'materials', 'notifications', 'documents', 'ratings', 'inference_logs', 'system_settings', 'sla_config', 'ai_threshold_config', 'audit_logs', 'security_audit_logs', 'messages', 'ticket_comments', 'job_evidence', 'completion_reports'];

const exportData = async () => {
  const data = { exportedAt: new Date().toISOString() };
  for (const table of TABLES) {
    const result = await query(`SELECT * FROM ${table}`);
    data[table] = result.rows;
  }
  logger.info('Database export completed');
  return { success: true, data, message: 'Export completed' };
};

const importData = async (importPayload) => {
  if (!importPayload || typeof importPayload !== 'object') {
    const AppError = (await import('../../shared/errors/AppError.js')).default;
    throw AppError.badRequest('Invalid import data');
  }

  let imported = 0;
  for (const table of TABLES) {
    if (Array.isArray(importPayload[table]) && importPayload[table].length) {
      for (const row of importPayload[table]) {
        const keys = Object.keys(row).filter(k => k !== 'id' && k !== 'created_at');
        if (!keys.length) continue;
        const cols = keys.join(', ');
        const vals = keys.map((_, i) => `$${i + 1}`);
        const values = keys.map(k => typeof row[k] === 'object' && row[k] !== null ? JSON.stringify(row[k]) : row[k] !== undefined ? row[k] : null);
        await query(`INSERT INTO ${table} (${cols}) VALUES (${vals.join(',')}) ON CONFLICT DO NOTHING`, values);
        imported++;
      }
    }
  }
  logger.info(`Database import completed: ${imported} records`);
  return { success: true, message: `Import complete. ${imported} records processed.` };
};

export { exportData, importData };

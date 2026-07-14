import { query } from '../../db/connection.js';

const getSettings = async () => {
  const result = await query('SELECT * FROM system_config ORDER BY key ASC');
  return result.rows;
};

const getSetting = async (key) => {
  const result = await query('SELECT * FROM system_config WHERE key = $1', [key]);
  return result.rows[0] || null;
};

const upsertSetting = async (key, value, description) => {
  await query(
    `INSERT INTO system_config (key, value, description) VALUES ($1, $2, $3)
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
    [key, String(value), description || null]
  );
  return getSetting(key);
};

const getSlaConfig = async () => {
  const result = await query('SELECT * FROM sla_config ORDER BY priority ASC');
  const order = { EMERGENCY: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  return result.rows.sort((a, b) => (order[a.priority] ?? 99) - (order[b.priority] ?? 99));
};

const upsertSla = async (priority, responseMinutes, resolutionMinutes) => {
  await query(
    `INSERT INTO sla_config (priority, response_minutes, resolution_minutes) VALUES ($1, $2, $3)
     ON CONFLICT (priority) DO UPDATE SET response_minutes = $2, resolution_minutes = $3`,
    [priority, responseMinutes, resolutionMinutes]
  );
  const result = await query('SELECT * FROM sla_config WHERE priority = $1', [priority]);
  return result.rows[0];
};

const getThresholds = async () => {
  const result = await query('SELECT * FROM ai_threshold_config');
  return result.rows;
};

const upsertThreshold = async (key, value, description) => {
  await query(
    `INSERT INTO ai_threshold_config (key, value, description) VALUES ($1, $2, $3)
     ON CONFLICT (key) DO UPDATE SET value = $2`,
    [key, value, description || null]
  );
  const result = await query('SELECT * FROM ai_threshold_config WHERE key = $1', [key]);
  return result.rows[0];
};

export { getSettings, getSetting, upsertSetting, getSlaConfig, upsertSla, getThresholds, upsertThreshold };

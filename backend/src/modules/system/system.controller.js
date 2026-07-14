import { query } from '../../db/connection.js';
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

export { getSettings, updateSettings, getSla, updateSla, getThresholds };

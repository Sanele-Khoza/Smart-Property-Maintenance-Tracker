const express = require('express');
const { dbRun, dbGet, dbAll } = require('../db/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const settings = await dbAll('SELECT * FROM system_settings ORDER BY id ASC');
    const slaConfig = await dbAll('SELECT * FROM sla_config ORDER BY CASE priority WHEN \'EMERGENCY\' THEN 0 WHEN \'HIGH\' THEN 1 WHEN \'MEDIUM\' THEN 2 WHEN \'LOW\' THEN 3 END');
    const thresholds = await dbAll('SELECT * FROM ai_threshold_config');
    res.json({ settings, slaConfig, thresholds });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

router.put('/:key', authenticate, authorize('SYSTEM_ADMIN'), async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    if (value === undefined) return res.status(400).json({ error: 'Value is required' });
    const existing = await dbGet('SELECT id FROM system_settings WHERE key = ?', [key]);
    if (existing) {
      await dbRun('UPDATE system_settings SET value = ? WHERE key = ?', [String(value), key]);
    } else {
      await dbRun('INSERT INTO system_settings (key, value, type) VALUES (?, ?, ?)', [key, String(value), typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'string']);
    }
    const updated = await dbGet('SELECT * FROM system_settings WHERE key = ?', [key]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

router.put('/sla/:priority', authenticate, authorize('SYSTEM_ADMIN'), async (req, res) => {
  try {
    const { priority } = req.params;
    const { responseMinutes, resolutionMinutes } = req.body;
    if (responseMinutes === undefined || resolutionMinutes === undefined) {
      return res.status(400).json({ error: 'Response and resolution minutes required' });
    }
    const existing = await dbGet('SELECT id FROM sla_config WHERE priority = ?', [priority]);
    if (existing) {
      await dbRun('UPDATE sla_config SET response_minutes = ?, resolution_minutes = ? WHERE priority = ?', [responseMinutes, resolutionMinutes, priority]);
    } else {
      await dbRun('INSERT INTO sla_config (priority, response_minutes, resolution_minutes) VALUES (?, ?, ?)', [priority, responseMinutes, resolutionMinutes]);
    }
    const updated = await dbGet('SELECT * FROM sla_config WHERE priority = ?', [priority]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update SLA config' });
  }
});

router.put('/thresholds/:key', authenticate, authorize('SYSTEM_ADMIN'), async (req, res) => {
  try {
    const { key } = req.params;
    const { value, description } = req.body;
    if (value === undefined) return res.status(400).json({ error: 'Value is required' });
    const existing = await dbGet('SELECT id FROM ai_threshold_config WHERE key = ?', [key]);
    if (existing) {
      await dbRun('UPDATE ai_threshold_config SET value = ? WHERE key = ?', [String(value), key]);
    } else {
      await dbRun('INSERT INTO ai_threshold_config (key, value, description) VALUES (?, ?, ?)', [key, String(value), description || null]);
    }
    const updated = await dbGet('SELECT * FROM ai_threshold_config WHERE key = ?', [key]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update threshold' });
  }
});

module.exports = router;

const express = require('express');
const { dbRun, dbGet, dbAll } = require('../db/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/export', authenticate, authorize('SYSTEM_ADMIN'), async (req, res) => {
  try {
    const tables = ['users', 'properties', 'units', 'leases', 'categories', 'tickets', 'ticket_status_history', 'technicians', 'availability_slots', 'materials', 'notifications', 'documents', 'ratings', 'inference_logs', 'system_settings', 'sla_config', 'ai_threshold_config', 'audit_logs', 'security_audit_logs', 'password_reset_tokens'];
    const data = {};
    for (const table of tables) {
      data[table] = await dbAll(`SELECT * FROM ${table}`);
    }
    data.exportedAt = new Date().toISOString();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to export data' });
  }
});

router.post('/import', authenticate, authorize('SYSTEM_ADMIN'), async (req, res) => {
  const importData = req.body;
  if (!importData || typeof importData !== 'object') {
    return res.status(400).json({ error: 'Invalid import data' });
  }
  try {
    const tables = ['users', 'properties', 'units', 'leases', 'categories', 'tickets', 'ticket_status_history', 'technicians', 'availability_slots', 'materials', 'notifications', 'documents', 'ratings', 'inference_logs', 'system_settings', 'sla_config', 'ai_threshold_config', 'audit_logs', 'security_audit_logs', 'password_reset_tokens'];
    let imported = 0;
    for (const table of tables) {
      if (Array.isArray(importData[table]) && importData[table].length) {
        for (const row of importData[table]) {
          const keys = Object.keys(row).filter(k => k !== 'id' && k !== 'created_at');
          if (keys.length === 0) continue;
          const placeholders = keys.map(() => '?').join(', ');
          const columns = keys.join(', ');
          const values = keys.map(k => {
            const v = row[k];
            if (typeof v === 'object' && v !== null) return JSON.stringify(v);
            return v !== undefined ? v : null;
          });
          await dbRun(`INSERT OR IGNORE INTO ${table} (${columns}) VALUES (${placeholders})`, values);
          imported++;
        }
      }
    }
    res.json({ message: `Import complete. ${imported} records processed.` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to import data: ' + err.message });
  }
});

module.exports = router;

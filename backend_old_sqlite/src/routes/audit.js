const express = require('express');
const { dbRun, dbGet, dbAll } = require('../db/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/logs', authenticate, authorize('SYSTEM_ADMIN'), async (req, res) => {
  try {
    const { limit, offset } = req.query;
    const l = Math.min(Number(limit) || 50, 200);
    const o = Number(offset) || 0;
    const logs = await dbAll('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ? OFFSET ?', [l, o]);
    const total = await dbGet('SELECT COUNT(*) as count FROM audit_logs');
    res.json({ logs, total: total.count, limit: l, offset: o });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

router.get('/security', authenticate, authorize('SYSTEM_ADMIN'), async (req, res) => {
  try {
    const { limit, offset, severity } = req.query;
    let sql = 'SELECT * FROM security_audit_logs WHERE 1=1';
    const params = [];
    if (severity) { sql += ' AND severity = ?'; params.push(severity); }
    sql += ' ORDER BY timestamp DESC';
    const l = Math.min(Number(limit) || 50, 200);
    const o = Number(offset) || 0;
    sql += ' LIMIT ? OFFSET ?';
    params.push(l, o);
    const logs = await dbAll(sql, params);
    const countSql = severity ? 'SELECT COUNT(*) as count FROM security_audit_logs WHERE severity = ?' : 'SELECT COUNT(*) as count FROM security_audit_logs';
    const total = await dbGet(countSql, severity ? [severity] : []);
    res.json({ logs, total: total.count, limit: l, offset: o });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch security logs' });
  }
});

router.post('/logs', authenticate, async (req, res) => {
  try {
    const { action, details } = req.body;
    if (!action) return res.status(400).json({ error: 'Action is required' });
    const result = await dbRun('INSERT INTO audit_logs (action, user_id, user_name, details) VALUES (?, ?, ?, ?)',
      [action, req.user.id, req.user.name + ' ' + req.user.surname, details || null]);
    res.status(201).json({ id: result.lastID, message: 'Audit log created' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create audit log' });
  }
});

router.post('/security', authenticate, async (req, res) => {
  try {
    const { eventType, details, ipAddress, severity } = req.body;
    if (!eventType) return res.status(400).json({ error: 'Event type is required' });
    const result = await dbRun('INSERT INTO security_audit_logs (event_type, user_id, details, ip_address, severity) VALUES (?, ?, ?, ?, ?)',
      [eventType, req.user.id, details || null, ipAddress || req.ip || null, severity || 'INFO']);
    res.status(201).json({ id: result.lastID, message: 'Security log created' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create security log' });
  }
});

router.get('/inference-logs', authenticate, async (req, res) => {
  try {
    const logs = await dbAll('SELECT * FROM inference_logs ORDER BY created_at DESC');
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch inference logs' });
  }
});

router.post('/inference-logs', authenticate, async (req, res) => {
  try {
    const { ticketId, service, type, result, confidence, conflictDetected } = req.body;
    if (!ticketId || !service || !type) return res.status(400).json({ error: 'ticketId, service, and type are required' });
    const log = await dbRun('INSERT INTO inference_logs (ticket_id, service, type, result, confidence, conflict_detected) VALUES (?, ?, ?, ?, ?, ?)',
      [ticketId, service, type, result || null, confidence || null, conflictDetected ? 1 : 0]);
    res.status(201).json({ id: log.lastID, message: 'Inference log created' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create inference log' });
  }
});

module.exports = router;

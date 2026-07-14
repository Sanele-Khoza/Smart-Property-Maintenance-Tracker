const express = require('express');
const { dbRun, dbGet, dbAll } = require('../db/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const { read, limit } = req.query;
    let sql = 'SELECT * FROM notifications WHERE 1=1';
    const params = [];
    if (req.user.role !== 'SYSTEM_ADMIN') {
      sql += ' AND (user_id = ? OR recipient = ? OR recipient IS NULL)';
      params.push(req.user.id, req.user.email);
    }
    if (read !== undefined) { sql += ' AND read = ?'; params.push(read === '1' ? 1 : 0); }
    sql += ' ORDER BY created_at DESC';
    if (limit) { sql += ' LIMIT ?'; params.push(Number(limit)); }
    const notifications = await dbAll(sql, params);
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

router.get('/unread-count', authenticate, async (req, res) => {
  try {
    let sql = "SELECT COUNT(*) as count FROM notifications WHERE read = 0 AND (user_id = ? OR recipient = ?)";
    const result = await dbGet(sql, [req.user.id, req.user.email]);
    res.json({ count: result.count });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const notif = await dbGet('SELECT * FROM notifications WHERE id = ?', [req.params.id]);
    if (!notif) return res.status(404).json({ error: 'Notification not found' });
    res.json(notif);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notification' });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { recipient, type, message, isEmergency, userId } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });
    const result = await dbRun(
      'INSERT INTO notifications (recipient, user_id, type, message, is_emergency) VALUES (?, ?, ?, ?, ?)',
      [recipient || null, userId || req.user.id || null, type || 'info', message, isEmergency ? 1 : 0]
    );
    const notif = await dbGet('SELECT * FROM notifications WHERE id = ?', [result.lastID]);
    res.status(201).json(notif);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

router.put('/:id/read', authenticate, async (req, res) => {
  try {
    const notif = await dbGet('SELECT * FROM notifications WHERE id = ?', [req.params.id]);
    if (!notif) return res.status(404).json({ error: 'Notification not found' });
    await dbRun('UPDATE notifications SET read = 1 WHERE id = ?', [notif.id]);
    res.json({ message: 'Marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

router.put('/read-all', authenticate, async (req, res) => {
  try {
    await dbRun('UPDATE notifications SET read = 1 WHERE (user_id = ? OR recipient = ?) AND read = 0', [req.user.id, req.user.email]);
    res.json({ message: 'All marked as read' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

router.put('/:id/status', authenticate, async (req, res) => {
  try {
    const { deliveryStatus } = req.body;
    const notif = await dbGet('SELECT * FROM notifications WHERE id = ?', [req.params.id]);
    if (!notif) return res.status(404).json({ error: 'Notification not found' });
    await dbRun('UPDATE notifications SET delivery_status = ? WHERE id = ?', [deliveryStatus || 'Delivered', notif.id]);
    res.json({ message: 'Status updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update status' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const notif = await dbGet('SELECT * FROM notifications WHERE id = ?', [req.params.id]);
    if (!notif) return res.status(404).json({ error: 'Notification not found' });
    await dbRun('DELETE FROM notifications WHERE id = ?', [notif.id]);
    res.json({ message: 'Notification deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

module.exports = router;

const express = require('express');
const { dbRun, dbGet, dbAll } = require('../db/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/users', authenticate, authorize('SYSTEM_ADMIN'), async (req, res) => {
  try {
    const { status, role, search } = req.query;
    let sql = 'SELECT id, name, surname, email, phone, role, account_status, approved, approved_at, last_login, created_at, updated_at FROM users WHERE 1=1';
    const params = [];
    if (status) { sql += ' AND account_status = ?'; params.push(status); }
    if (role) { sql += ' AND role = ?'; params.push(role); }
    if (search) { sql += ' AND (name LIKE ? OR surname LIKE ? OR email LIKE ?)'; const s = `%${search}%`; params.push(s, s, s); }
    sql += ' ORDER BY created_at DESC';
    const users = await dbAll(sql, params);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.put('/users/:id/approve', authenticate, authorize('SYSTEM_ADMIN'), async (req, res) => {
  try {
    const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.approved) return res.status(400).json({ error: 'User already approved' });
    await dbRun('UPDATE users SET approved = 1, approved_at = ?, account_status = ?, updated_at = ? WHERE id = ?',
      [new Date().toISOString(), 'ACTIVE', new Date().toISOString(), user.id]);
    res.json({ message: 'User approved' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to approve user' });
  }
});

router.put('/users/:id/deactivate', authenticate, authorize('SYSTEM_ADMIN'), async (req, res) => {
  try {
    const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    await dbRun('UPDATE users SET account_status = ?, updated_at = ? WHERE id = ?', ['DEACTIVATED', new Date().toISOString(), user.id]);
    res.json({ message: 'User deactivated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to deactivate user' });
  }
});

router.put('/users/:id/reactivate', authenticate, authorize('SYSTEM_ADMIN'), async (req, res) => {
  try {
    const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    await dbRun('UPDATE users SET account_status = ?, updated_at = ? WHERE id = ?', ['ACTIVE', new Date().toISOString(), user.id]);
    res.json({ message: 'User reactivated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reactivate user' });
  }
});

router.put('/users/:id/unlock', authenticate, authorize('SYSTEM_ADMIN'), async (req, res) => {
  try {
    const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    await dbRun('UPDATE users SET login_attempts = 0, locked_until = NULL, updated_at = ? WHERE id = ?', [new Date().toISOString(), user.id]);
    res.json({ message: 'User unlocked' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unlock user' });
  }
});

router.get('/dashboard', authenticate, authorize('SYSTEM_ADMIN'), async (req, res) => {
  try {
    const totalUsers = await dbGet('SELECT COUNT(*) as count FROM users');
    const pendingApprovals = await dbGet("SELECT COUNT(*) as count FROM users WHERE approved = 0");
    const activeUsers = await dbGet("SELECT COUNT(*) as count FROM users WHERE account_status = 'ACTIVE'");
    const totalProperties = await dbGet('SELECT COUNT(*) as count FROM properties');
    const totalTickets = await dbGet('SELECT COUNT(*) as count FROM tickets');
    res.json({ totalUsers: totalUsers.count, pendingApprovals: pendingApprovals.count, activeUsers: activeUsers.count, totalProperties: totalProperties.count, totalTickets: totalTickets.count });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

module.exports = router;

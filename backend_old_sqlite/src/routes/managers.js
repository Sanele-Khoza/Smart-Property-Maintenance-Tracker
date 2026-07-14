const express = require('express');
const { dbRun, dbGet, dbAll } = require('../db/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/tenants', authenticate, authorize('SYSTEM_ADMIN', 'PROPERTY_MANAGER'), async (req, res) => {
  try {
    const tenants = await dbAll("SELECT id, name, surname, email, phone, role, account_status, approved, last_login, created_at FROM users WHERE role = 'TENANT' ORDER BY created_at DESC");
    res.json(tenants);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tenants' });
  }
});

router.get('/dashboard', authenticate, authorize('SYSTEM_ADMIN', 'PROPERTY_MANAGER'), async (req, res) => {
  try {
    const openTickets = await dbGet("SELECT COUNT(*) as count FROM tickets WHERE status NOT IN ('Completed','Cancelled','Archived')");
    const overdueTickets = await dbGet("SELECT COUNT(*) as count FROM tickets WHERE status NOT IN ('Completed','Cancelled','Archived') AND due_date < ?", [new Date().toISOString()]);
    const availableTechs = await dbGet("SELECT COUNT(*) as count FROM technicians WHERE availability_status IN ('AVAILABLE','ON_CALL')");
    const totalProperties = await dbGet('SELECT COUNT(*) as count FROM properties');
    res.json({ openTickets: openTickets.count, overdueTickets: overdueTickets.count, availableTechs: availableTechs.count, totalProperties: totalProperties.count });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

module.exports = router;

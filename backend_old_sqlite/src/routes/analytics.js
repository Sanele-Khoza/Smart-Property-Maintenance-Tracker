const express = require('express');
const { dbRun, dbGet, dbAll } = require('../db/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/tickets-trend', authenticate, authorize('SYSTEM_ADMIN', 'PROPERTY_MANAGER'), async (req, res) => {
  try {
    const { days } = req.query;
    const d = Math.min(Number(days) || 30, 365);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - d);
    const trend = await dbAll(`
      SELECT DATE(created_by_date) as date, COUNT(*) as count,
             SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) as completed
      FROM tickets
      WHERE DATE(created_by_date) >= DATE(?)
      GROUP BY DATE(created_by_date)
      ORDER BY date ASC
    `, [startDate.toISOString().split('T')[0]]);
    res.json(trend);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate tickets trend' });
  }
});

router.get('/priority-distribution', authenticate, authorize('SYSTEM_ADMIN', 'PROPERTY_MANAGER'), async (req, res) => {
  try {
    const distribution = await dbAll(`
      SELECT priority, COUNT(*) as count
      FROM tickets
      WHERE status NOT IN ('Completed', 'Cancelled', 'Archived')
      GROUP BY priority
      ORDER BY CASE priority WHEN 'EMERGENCY' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 WHEN 'LOW' THEN 3 END
    `);
    res.json(distribution);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate priority distribution' });
  }
});

router.get('/provider-performance', authenticate, authorize('SYSTEM_ADMIN', 'PROPERTY_MANAGER'), async (req, res) => {
  try {
    const performance = await dbAll(`
      SELECT tech.name, tech.company_name,
             COUNT(t.id) as totalJobs,
             SUM(CASE WHEN t.status = 'Completed' THEN 1 ELSE 0 END) as completedJobs,
             ROUND(AVG(rt.rating_value), 2) as avgRating,
             ROUND(AVG(CASE WHEN t.status = 'Completed' THEN julianday(t.updated_at) - julianday(t.created_by_date) END), 1) as avgCompletionDays
      FROM technicians tech
      LEFT JOIN tickets t ON t.assigned_to_id = tech.id
      LEFT JOIN ratings rt ON rt.ticket_id = t.id
      GROUP BY tech.id
      ORDER BY avgRating DESC
    `);
    for (const row of performance) {
      if (row.avgRating) row.avgRating = Math.round(row.avgRating * 100) / 100;
    }
    res.json(performance);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate provider performance' });
  }
});

router.get('/dashboard-summary', authenticate, async (req, res) => {
  try {
    const totalTickets = await dbGet("SELECT COUNT(*) as count FROM tickets");
    const openTickets = await dbGet("SELECT COUNT(*) as count FROM tickets WHERE status NOT IN ('Completed','Cancelled','Archived')");
    const totalProperties = await dbGet("SELECT COUNT(*) as count FROM properties");
    const totalUnits = await dbGet("SELECT COUNT(*) as count FROM units");
    const vacantUnits = await dbGet("SELECT COUNT(*) as count FROM units WHERE status = 'Vacant'");
    const totalTechnicians = await dbGet("SELECT COUNT(*) as count FROM technicians");
    const totalTenants = await dbGet("SELECT COUNT(*) as count FROM users WHERE role = 'TENANT'");
    const pendingApprovals = await dbGet("SELECT COUNT(*) as count FROM users WHERE approved = 0");
    res.json({
      totalTickets: totalTickets.count,
      openTickets: openTickets.count,
      totalProperties: totalProperties.count,
      totalUnits: totalUnits.count,
      vacantUnits: vacantUnits.count,
      totalTechnicians: totalTechnicians.count,
      totalTenants: totalTenants.count,
      pendingApprovals: pendingApprovals.count
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch dashboard summary' });
  }
});

module.exports = router;

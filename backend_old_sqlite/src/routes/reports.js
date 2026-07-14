const express = require('express');
const { dbRun, dbGet, dbAll } = require('../db/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/providers-summary', authenticate, authorize('SYSTEM_ADMIN', 'PROPERTY_MANAGER'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let dateFilter = '';
    const params = [];
    if (startDate) { dateFilter += ' AND t.created_by_date >= ?'; params.push(startDate); }
    if (endDate) { dateFilter += ' AND t.created_by_date <= ?'; params.push(endDate); }
    const report = await dbAll(`
      SELECT tech.id, tech.name, tech.company_name, tech.availability_status,
             COUNT(t.id) as totalJobs,
             SUM(CASE WHEN t.status = 'Completed' THEN 1 ELSE 0 END) as completedJobs,
             ROUND(AVG(rt.rating_value), 2) as avgRating,
             tech.current_workload
      FROM technicians tech
      LEFT JOIN tickets t ON t.assigned_to_id = tech.id${dateFilter ? ' AND 1=1' : ''}
      LEFT JOIN ratings rt ON rt.ticket_id = t.id
      WHERE 1=1${dateFilter.replace(/AND/g, '')}
      GROUP BY tech.id
      ORDER BY completedJobs DESC
    `, params);
    for (const row of report) {
      if (row.avgRating) row.avgRating = Math.round(row.avgRating * 100) / 100;
    }
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate providers report' });
  }
});

router.get('/categories-summary', authenticate, authorize('SYSTEM_ADMIN', 'PROPERTY_MANAGER'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let dateFilter = '';
    const params = [];
    if (startDate) { dateFilter += ' AND t.created_by_date >= ?'; params.push(startDate); }
    if (endDate) { dateFilter += ' AND t.created_by_date <= ?'; params.push(endDate); }
    const report = await dbAll(`
      SELECT cat.id, cat.name, cat.icon, cat.color,
             COUNT(t.id) as totalTickets,
             SUM(CASE WHEN t.status = 'Completed' THEN 1 ELSE 0 END) as completedTickets,
             ROUND(AVG(CASE WHEN t.status IN ('Completed','Cancelled') THEN julianday(t.updated_at) - julianday(t.created_by_date) END), 1) as avgResolutionDays
      FROM categories cat
      LEFT JOIN tickets t ON t.category_id = cat.id${dateFilter ? ' AND 1=1' : ''}
      WHERE 1=1${dateFilter.replace(/AND/g, '')}
      GROUP BY cat.id
      ORDER BY totalTickets DESC
    `, params);
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate categories report' });
  }
});

router.get('/full-report', authenticate, authorize('SYSTEM_ADMIN', 'PROPERTY_MANAGER'), async (req, res) => {
  try {
    const properties = await dbAll(`
      SELECT p.id, p.name, p.type, p.status, p.address, p.created_at,
             (SELECT COUNT(*) FROM units WHERE property_id = p.id) as totalUnits,
             (SELECT COUNT(*) FROM units WHERE property_id = p.id AND status = 'Vacant') as vacantUnits,
             (SELECT COUNT(*) FROM tickets t JOIN units u ON t.unit_id = u.id WHERE u.property_id = p.id) as totalTickets,
             (SELECT COUNT(*) FROM tickets t JOIN units u ON t.unit_id = u.id WHERE u.property_id = p.id AND t.status != 'Completed') as openTickets
      FROM properties p
      ORDER BY p.name
    `);
    res.json(properties);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate full report' });
  }
});

module.exports = router;

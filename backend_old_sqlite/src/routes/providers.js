const express = require('express');
const { dbRun, dbGet, dbAll } = require('../db/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/my-jobs', authenticate, async (req, res) => {
  try {
    const jobs = await dbAll(`
      SELECT t.*, u.unit_number, p.name as property_name, p.address as property_address,
             cat.name as category_name, rt.rating_value
      FROM tickets t
      JOIN units u ON t.unit_id = u.id
      JOIN properties p ON u.property_id = p.id
      LEFT JOIN categories cat ON t.category_id = cat.id
      LEFT JOIN ratings rt ON rt.ticket_id = t.id AND rt.rated_by = ?
      WHERE t.assigned_to_id = ?
      ORDER BY t.due_date ASC, t.priority DESC
    `, [req.user.id, req.user.id]);
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

router.get('/my-availability', authenticate, async (req, res) => {
  try {
    const tech = await dbGet('SELECT * FROM technicians WHERE email = ?', [req.user.email]);
    if (!tech) return res.status(404).json({ error: 'Technician profile not found' });
    const slots = await dbAll('SELECT * FROM availability_slots WHERE technician_id = ? ORDER BY day_of_week, start_time', [tech.id]);
    res.json({ technician: tech, availability: slots });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
});

router.post('/my-availability', authenticate, async (req, res) => {
  try {
    const tech = await dbGet('SELECT * FROM technicians WHERE email = ?', [req.user.email]);
    if (!tech) return res.status(404).json({ error: 'Technician profile not found' });
    const { dayOfWeek, startTime, endTime } = req.body;
    if (dayOfWeek === undefined || !startTime || !endTime) {
      return res.status(400).json({ error: 'dayOfWeek, startTime, and endTime required' });
    }
    const existing = await dbGet('SELECT id FROM availability_slots WHERE technician_id = ? AND day_of_week = ? AND start_time = ?', [tech.id, dayOfWeek, startTime]);
    if (existing) {
      await dbRun('UPDATE availability_slots SET end_time = ? WHERE id = ?', [endTime, existing.id]);
    } else {
      await dbRun('INSERT INTO availability_slots (technician_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?)',
        [tech.id, dayOfWeek, startTime, endTime]);
    }
    const slots = await dbAll('SELECT * FROM availability_slots WHERE technician_id = ? ORDER BY day_of_week, start_time', [tech.id]);
    res.json({ technician: tech, availability: slots });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save availability' });
  }
});

router.get('/my-materials', authenticate, async (req, res) => {
  try {
    const materials = await dbAll('SELECT * FROM materials WHERE provided_by = ? OR created_by = ? ORDER BY created_at DESC', [req.user.id, req.user.id]);
    res.json(materials);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch materials' });
  }
});

router.post('/my-materials', authenticate, async (req, res) => {
  try {
    const { ticketId, name, quantity, unitCost } = req.body;
    if (!ticketId || !name || quantity === undefined) {
      return res.status(400).json({ error: 'ticketId, name, and quantity required' });
    }
    const result = await dbRun('INSERT INTO materials (ticket_id, name, quantity, unit_cost, provided_by) VALUES (?, ?, ?, ?, ?)',
      [ticketId, name, quantity, unitCost || null, req.user.id]);
    const material = await dbGet('SELECT * FROM materials WHERE id = ?', [result.lastID]);
    res.status(201).json(material);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create material' });
  }
});

module.exports = router;

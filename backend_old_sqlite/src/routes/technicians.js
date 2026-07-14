const express = require('express');
const { dbRun, dbGet, dbAll } = require('../db/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const technicians = await dbAll('SELECT * FROM technicians ORDER BY rating DESC');
    res.json(technicians);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch technicians' });
  }
});

router.get('/providers', async (req, res) => {
  try {
    const providers = await dbAll("SELECT * FROM technicians WHERE availability_status != 'SUSPENDED' ORDER BY rating DESC");
    res.json(providers);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch providers' });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const tech = await dbGet('SELECT * FROM technicians WHERE id = ?', [req.params.id]);
    if (!tech) return res.status(404).json({ error: 'Technician not found' });
    const activeJobs = await dbGet("SELECT COUNT(*) as count FROM tickets WHERE assigned_to_id = ? AND status IN ('Assigned','In Progress','Waiting for Parts')", [tech.id]);
    res.json({ ...tech, activeJobs: activeJobs.count });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch technician' });
  }
});

router.post('/', authenticate, authorize('SYSTEM_ADMIN', 'PROPERTY_MANAGER'), async (req, res) => {
  try {
    const { name, companyName, specialisations, email, phone } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const result = await dbRun(
      'INSERT INTO technicians (name, company_name, specialisations, email, phone) VALUES (?, ?, ?, ?, ?)',
      [name, companyName || null, JSON.stringify(specialisations || []), email || null, phone || null]
    );
    const tech = await dbGet('SELECT * FROM technicians WHERE id = ?', [result.lastID]);
    res.status(201).json(tech);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create technician' });
  }
});

router.put('/:id', authenticate, authorize('SYSTEM_ADMIN', 'PROPERTY_MANAGER'), async (req, res) => {
  try {
    const tech = await dbGet('SELECT * FROM technicians WHERE id = ?', [req.params.id]);
    if (!tech) return res.status(404).json({ error: 'Technician not found' });
    const { name, companyName, availabilityStatus, specialisations, rating, currentWorkload, totalJobsCompleted, email, phone, gpsLatitude, gpsLongitude } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (companyName !== undefined) updates.company_name = companyName;
    if (availabilityStatus) updates.availability_status = availabilityStatus;
    if (specialisations) updates.specialisations = JSON.stringify(specialisations);
    if (rating !== undefined) updates.rating = rating;
    if (currentWorkload !== undefined) updates.current_workload = currentWorkload;
    if (totalJobsCompleted !== undefined) updates.total_jobs_completed = totalJobsCompleted;
    if (email) updates.email = email;
    if (phone) updates.phone = phone;
    if (gpsLatitude !== undefined) updates.gps_latitude = gpsLatitude;
    if (gpsLongitude !== undefined) updates.gps_longitude = gpsLongitude;
    if (Object.keys(updates).length) {
      const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
      const vals = Object.values(updates);
      await dbRun(`UPDATE technicians SET ${sets} WHERE id = ?`, [...vals, tech.id]);
    }
    const updated = await dbGet('SELECT * FROM technicians WHERE id = ?', [tech.id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update technician' });
  }
});

router.put('/:id/status', authenticate, authorize('SYSTEM_ADMIN', 'PROPERTY_MANAGER'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!['AVAILABLE', 'ON_CALL', 'OFF_DUTY', 'SUSPENDED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const tech = await dbGet('SELECT * FROM technicians WHERE id = ?', [req.params.id]);
    if (!tech) return res.status(404).json({ error: 'Technician not found' });
    await dbRun('UPDATE technicians SET availability_status = ? WHERE id = ?', [status, tech.id]);
    const updated = await dbGet('SELECT * FROM technicians WHERE id = ?', [tech.id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update status' });
  }
});

router.put('/:id/location', authenticate, async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const tech = await dbGet('SELECT * FROM technicians WHERE id = ?', [req.params.id]);
    if (!tech) return res.status(404).json({ error: 'Technician not found' });
    await dbRun('UPDATE technicians SET gps_latitude = ?, gps_longitude = ?, last_location_update = ? WHERE id = ?',
      [latitude || null, longitude || null, new Date().toISOString(), tech.id]);
    res.json({ message: 'Location updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update location' });
  }
});

router.delete('/:id', authenticate, authorize('SYSTEM_ADMIN'), async (req, res) => {
  try {
    const tech = await dbGet('SELECT * FROM technicians WHERE id = ?', [req.params.id]);
    if (!tech) return res.status(404).json({ error: 'Technician not found' });
    await dbRun('DELETE FROM technicians WHERE id = ?', [tech.id]);
    res.json({ message: 'Technician deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete technician' });
  }
});

module.exports = router;

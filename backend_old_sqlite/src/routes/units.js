const express = require('express');
const { dbRun, dbGet, dbAll } = require('../db/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { property_id } = req.query;
    let sql = `SELECT u.*, p.name as property_name, p.address as property_address FROM units u LEFT JOIN properties p ON u.property_id = p.property_id`;
    const params = [];
    if (property_id) {
      sql += ' WHERE u.property_id = ?';
      params.push(property_id);
    }
    sql += ' ORDER BY u.created_at DESC';
    const units = await dbAll(sql, params);
    res.json(units);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch units' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const unit = await dbGet('SELECT u.*, p.name as property_name, p.address as property_address FROM units u LEFT JOIN properties p ON u.property_id = p.property_id WHERE u.unit_id = ? OR u.id = ?', [req.params.id, req.params.id]);
    if (!unit) return res.status(404).json({ error: 'Unit not found' });
    res.json(unit);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch unit' });
  }
});

router.post('/', authenticate, authorize('SYSTEM_ADMIN', 'PROPERTY_MANAGER'), async (req, res) => {
  try {
    const { propertyId, unitNumber, floor } = req.body;
    if (!propertyId || !unitNumber) return res.status(400).json({ error: 'Property ID and unit number are required' });
    const prop = await dbGet('SELECT * FROM properties WHERE property_id = ?', [propertyId]);
    if (!prop) return res.status(404).json({ error: 'Property not found' });
    const unitId = 'UNIT-' + String(Date.now()).slice(-6);
    await dbRun(
      'INSERT INTO units (unit_id, property_id, property_name, unit_number, floor) VALUES (?, ?, ?, ?, ?)',
      [unitId, propertyId, prop.name, unitNumber, floor || null]
    );
    const unit = await dbGet('SELECT * FROM units WHERE unit_id = ?', [unitId]);
    res.status(201).json(unit);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create unit' });
  }
});

router.put('/:id', authenticate, authorize('SYSTEM_ADMIN', 'PROPERTY_MANAGER'), async (req, res) => {
  try {
    const unit = await dbGet('SELECT * FROM units WHERE unit_id = ? OR id = ?', [req.params.id, req.params.id]);
    if (!unit) return res.status(404).json({ error: 'Unit not found' });
    const { unitNumber, floor, status, tenantName } = req.body;
    const updates = {};
    if (unitNumber) updates.unit_number = unitNumber;
    if (floor !== undefined) updates.floor = floor;
    if (status) updates.status = status;
    if (tenantName !== undefined) updates.tenant_name = tenantName;
    const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const vals = Object.values(updates);
    if (sets) {
      await dbRun(`UPDATE units SET ${sets} WHERE unit_id = ?`, [...vals, unit.unit_id]);
    }
    const updated = await dbGet('SELECT * FROM units WHERE unit_id = ?', [unit.unit_id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update unit' });
  }
});

router.put('/:id/assign', authenticate, authorize('SYSTEM_ADMIN', 'PROPERTY_MANAGER'), async (req, res) => {
  try {
    const { tenantName } = req.body;
    if (!tenantName) return res.status(400).json({ error: 'Tenant name required' });
    const unit = await dbGet('SELECT * FROM units WHERE unit_id = ? OR id = ?', [req.params.id, req.params.id]);
    if (!unit) return res.status(404).json({ error: 'Unit not found' });
    await dbRun("UPDATE units SET tenant_name = ?, status = 'OCCUPIED' WHERE unit_id = ?", [tenantName, unit.unit_id]);
    const updated = await dbGet('SELECT * FROM units WHERE unit_id = ?', [unit.unit_id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to assign tenant' });
  }
});

router.put('/:id/vacate', authenticate, authorize('SYSTEM_ADMIN', 'PROPERTY_MANAGER'), async (req, res) => {
  try {
    const unit = await dbGet('SELECT * FROM units WHERE unit_id = ? OR id = ?', [req.params.id, req.params.id]);
    if (!unit) return res.status(404).json({ error: 'Unit not found' });
    await dbRun("UPDATE units SET tenant_name = NULL, status = 'VACANT' WHERE unit_id = ?", [unit.unit_id]);
    const updated = await dbGet('SELECT * FROM units WHERE unit_id = ?', [unit.unit_id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to vacate unit' });
  }
});

router.delete('/:id', authenticate, authorize('SYSTEM_ADMIN', 'PROPERTY_MANAGER'), async (req, res) => {
  try {
    const unit = await dbGet('SELECT * FROM units WHERE unit_id = ? OR id = ?', [req.params.id, req.params.id]);
    if (!unit) return res.status(404).json({ error: 'Unit not found' });
    await dbRun('DELETE FROM units WHERE unit_id = ?', [unit.unit_id]);
    res.json({ message: 'Unit deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete unit' });
  }
});

module.exports = router;

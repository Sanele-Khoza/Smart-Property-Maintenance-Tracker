const express = require('express');
const { dbRun, dbGet, dbAll } = require('../db/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[^a-zA-Z0-9\s\-_]/g, '').trim();
}

router.get('/', async (req, res) => {
  try {
    const { search, managerName } = req.query;
    let sql = `SELECT p.*, (SELECT COUNT(*) FROM units u WHERE u.property_id = p.property_id) as unit_count FROM properties p`;
    const params = [];
    const conditions = [];
    if (search) {
      conditions.push('(p.name LIKE ? OR p.address LIKE ? OR p.city LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (managerName) {
      conditions.push('p.manager_name = ?');
      params.push(managerName);
    }
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY p.created_at DESC';
    const properties = await dbAll(sql, params);
    res.json(properties);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch properties' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const property = await dbGet('SELECT * FROM properties WHERE property_id = ? OR id = ?', [req.params.id, req.params.id]);
    if (!property) return res.status(404).json({ error: 'Property not found' });
    const units = await dbAll('SELECT * FROM units WHERE property_id = ?', [property.property_id]);
    res.json({ ...property, units });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch property' });
  }
});

router.post('/', authenticate, authorize('SYSTEM_ADMIN', 'PROPERTY_MANAGER'), async (req, res) => {
  try {
    const { name, address, propertyType, managerName } = req.body;
    if (!name || !address) return res.status(400).json({ error: 'Name and address are required' });
    const propertyId = 'PR-' + String(Date.now()).slice(-6);
    await dbRun(
      'INSERT INTO properties (property_id, name, address, property_type, manager_name) VALUES (?, ?, ?, ?, ?)',
      [propertyId, sanitize(name), sanitize(address), propertyType || 'RESIDENTIAL', managerName || null]
    );
    const property = await dbGet('SELECT * FROM properties WHERE property_id = ?', [propertyId]);
    res.status(201).json(property);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create property' });
  }
});

router.put('/:id', authenticate, authorize('SYSTEM_ADMIN', 'PROPERTY_MANAGER'), async (req, res) => {
  try {
    const property = await dbGet('SELECT * FROM properties WHERE property_id = ? OR id = ?', [req.params.id, req.params.id]);
    if (!property) return res.status(404).json({ error: 'Property not found' });
    const { name, address, propertyType, managerName, status } = req.body;
    const updates = {};
    if (name) updates.name = sanitize(name);
    if (address) updates.address = sanitize(address);
    if (propertyType) updates.property_type = propertyType;
    if (managerName !== undefined) updates.manager_name = managerName;
    if (status) updates.status = status;
    const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const vals = Object.values(updates);
    if (sets) {
      await dbRun(`UPDATE properties SET ${sets} WHERE property_id = ?`, [...vals, property.property_id]);
    }
    const updated = await dbGet('SELECT * FROM properties WHERE property_id = ?', [property.property_id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update property' });
  }
});

router.delete('/:id', authenticate, authorize('SYSTEM_ADMIN', 'PROPERTY_MANAGER'), async (req, res) => {
  try {
    const property = await dbGet('SELECT * FROM properties WHERE property_id = ? OR id = ?', [req.params.id, req.params.id]);
    if (!property) return res.status(404).json({ error: 'Property not found' });
    await dbRun('DELETE FROM properties WHERE property_id = ?', [property.property_id]);
    res.json({ message: 'Property deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete property' });
  }
});

module.exports = router;

const express = require('express');
const { dbRun, dbGet, dbAll } = require('../db/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/my-units', authenticate, authorize('TENANT', 'SYSTEM_ADMIN', 'PROPERTY_MANAGER'), async (req, res) => {
  try {
    const units = await dbAll(`
      SELECT u.*, p.name as property_name, p.address as property_address
      FROM units u JOIN properties p ON u.property_id = p.id
      WHERE u.occupant_id = ?
    `, [req.user.id]);
    res.json(units);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch units' });
  }
});

router.get('/my-tickets', authenticate, authorize('TENANT', 'SYSTEM_ADMIN', 'PROPERTY_MANAGER'), async (req, res) => {
  try {
    const tickets = await dbAll(`
      SELECT t.*, u.unit_number, p.name as property_name,
             cat.name as category_name, cat.icon as category_icon, cat.color as category_color
      FROM tickets t
      JOIN units u ON t.unit_id = u.id
      JOIN properties p ON u.property_id = p.id
      LEFT JOIN categories cat ON t.category_id = cat.id
      WHERE t.tenant_id = ?
      ORDER BY t.created_by_date DESC
    `, [req.user.id]);
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

router.get('/my-lease', authenticate, authorize('TENANT', 'SYSTEM_ADMIN', 'PROPERTY_MANAGER'), async (req, res) => {
  try {
    const unit = await dbGet(`
      SELECT u.*, p.name as property_name, p.address as property_address
      FROM units u JOIN properties p ON u.property_id = p.id
      WHERE u.occupant_id = ?
    `, [req.user.id]);
    if (!unit) return res.status(404).json({ error: 'No unit assigned' });
    const lease = await dbGet('SELECT * FROM leases WHERE unit_id = ? AND tenant_id = ? ORDER BY start_date DESC LIMIT 1', [unit.id, req.user.id]);
    res.json({ unit, lease });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch lease' });
  }
});

router.get('/my-documents', authenticate, authorize('TENANT', 'SYSTEM_ADMIN', 'PROPERTY_MANAGER'), async (req, res) => {
  try {
    const documents = await dbAll("SELECT * FROM documents WHERE uploaded_by = ? ORDER BY uploaded_at DESC", [req.user.id]);
    res.json(documents);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

module.exports = router;

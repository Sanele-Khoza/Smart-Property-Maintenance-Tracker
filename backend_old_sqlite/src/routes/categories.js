const express = require('express');
const { dbRun, dbGet, dbAll } = require('../db/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const categories = await dbAll('SELECT * FROM categories ORDER BY name ASC');
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

router.post('/', authenticate, authorize('SYSTEM_ADMIN'), async (req, res) => {
  try {
    const { name, icon, color } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const existing = await dbGet('SELECT id FROM categories WHERE name = ?', [name]);
    if (existing) return res.status(409).json({ error: 'Category already exists' });
    const result = await dbRun('INSERT INTO categories (name, icon, color) VALUES (?, ?, ?)', [name, icon || '🔧', color || '#95a5a6']);
    const cat = await dbGet('SELECT * FROM categories WHERE id = ?', [result.lastID]);
    res.status(201).json(cat);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create category' });
  }
});

router.put('/:id', authenticate, authorize('SYSTEM_ADMIN'), async (req, res) => {
  try {
    const cat = await dbGet('SELECT * FROM categories WHERE id = ?', [req.params.id]);
    if (!cat) return res.status(404).json({ error: 'Category not found' });
    const { name, icon, color } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (icon) updates.icon = icon;
    if (color) updates.color = color;
    const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const vals = Object.values(updates);
    if (sets) await dbRun(`UPDATE categories SET ${sets} WHERE id = ?`, [...vals, cat.id]);
    const updated = await dbGet('SELECT * FROM categories WHERE id = ?', [cat.id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update category' });
  }
});

router.delete('/:id', authenticate, authorize('SYSTEM_ADMIN'), async (req, res) => {
  try {
    const cat = await dbGet('SELECT * FROM categories WHERE id = ?', [req.params.id]);
    if (!cat) return res.status(404).json({ error: 'Category not found' });
    await dbRun('DELETE FROM categories WHERE id = ?', [cat.id]);
    res.json({ message: 'Category deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

module.exports = router;

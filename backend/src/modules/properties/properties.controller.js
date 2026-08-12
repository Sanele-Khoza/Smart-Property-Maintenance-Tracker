import * as service from './properties.service.js';

const list = async (req, res, next) => {
  try {
    const filters = { ...req.query };
    if (req.user.role === 'TENANT') {
      filters.occupant_id = req.user.id;
    }
    const result = await service.list(filters);
    res.json(result);
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const result = await service.getById(req.params.id);
    if (req.user.role === 'TENANT') {
      const { query } = await import('../../db/connection.js');
      const unit = await query('SELECT id FROM units WHERE property_id = $1 AND occupant_id = $2 LIMIT 1', [req.params.id, req.user.id]);
      if (!unit.rows.length) {
        const { default: AppError } = await import('../../shared/errors/AppError.js');
        throw AppError.forbidden('Access denied');
      }
    }
    res.json(result);
  } catch (err) { next(err); }
};

const create = async (req, res, next) => { try { const result = await service.create(req.validatedBody); res.status(201).json(result); } catch (err) { next(err); } };
const update = async (req, res, next) => { try { const result = await service.update(req.params.id, req.validatedBody); res.json(result); } catch (err) { next(err); } };
const remove = async (req, res, next) => { try { const result = await service.remove(req.params.id); res.json(result); } catch (err) { next(err); } };

const getUnits = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT u.*, p.name AS property_name
       FROM units u
       JOIN properties p ON p.id = u.property_id
       WHERE u.property_id = $1
       ORDER BY u.unit_number ASC`,
      [req.params.id]
    );
    res.json({ success: true, data: { units: result.rows } });
  } catch (err) { next(err); }
};

const getTickets = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT t.*, u.unit_number
       FROM tickets t
       JOIN units u ON u.id = t.unit_id
       WHERE u.property_id = $1 AND t.deleted_at IS NULL
       ORDER BY t.created_at DESC`,
      [req.params.id]
    );
    res.json({ success: true, data: { tickets: result.rows } });
  } catch (err) { next(err); }
};

export { list, getById, create, update, remove, getUnits, getTickets };

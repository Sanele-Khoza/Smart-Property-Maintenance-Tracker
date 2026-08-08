import * as service from './units.service.js';
import AppError from '../../shared/errors/AppError.js';

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
    if (req.user.role === 'TENANT' && result.data.unit.occupant_id !== req.user.id) {
      throw AppError.forbidden('Access denied');
    }
    res.json(result);
  } catch (err) { next(err); }
};

const create = async (req, res, next) => { try { const result = await service.create(req.validatedBody); res.status(201).json(result); } catch (err) { next(err); } };
const update = async (req, res, next) => { try { const result = await service.update(req.params.id, req.validatedBody); res.json(result); } catch (err) { next(err); } };
const assign = async (req, res, next) => {
  try {
    const body = req.validatedBody || req.body;
    const result = await service.assign(req.params.id, body.tenantId, body.tenantName);
    res.json(result);
  } catch (err) { next(err); }
};
const vacate = async (req, res, next) => { try { const result = await service.vacate(req.params.id); res.json(result); } catch (err) { next(err); } };
const remove = async (req, res, next) => { try { const result = await service.remove(req.params.id); res.json(result); } catch (err) { next(err); } };

export { list, getById, create, update, assign, vacate, remove };

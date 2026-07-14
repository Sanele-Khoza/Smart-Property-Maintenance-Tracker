import * as service from './categories.service.js';

const list = async (req, res, next) => { try { const result = await service.list(); res.json(result); } catch (err) { next(err); } };
const getById = async (req, res, next) => { try { const result = await service.getById(req.params.id); res.json(result); } catch (err) { next(err); } };
const create = async (req, res, next) => { try { const result = await service.create(req.validatedBody); res.status(201).json(result); } catch (err) { next(err); } };
const update = async (req, res, next) => { try { const result = await service.update(req.params.id, req.validatedBody); res.json(result); } catch (err) { next(err); } };
const remove = async (req, res, next) => { try { const result = await service.remove(req.params.id); res.json(result); } catch (err) { next(err); } };

export { list, getById, create, update, remove };

import * as service from './technicians.service.js';

const list = async (req, res, next) => { try { const result = await service.list(req.query); res.json(result); } catch (err) { next(err); } };
const getById = async (req, res, next) => { try { const result = await service.getById(req.params.id); res.json(result); } catch (err) { next(err); } };
const create = async (req, res, next) => { try { const result = await service.create(req.validatedBody || req.body); res.status(201).json(result); } catch (err) { next(err); } };
const update = async (req, res, next) => { try { const result = await service.update(req.params.id, req.validatedBody || req.body); res.json(result); } catch (err) { next(err); } };
const updateStatus = async (req, res, next) => { try { const result = await service.updateStatus(req.params.id, req.body.status); res.json(result); } catch (err) { next(err); } };
const updateLocation = async (req, res, next) => { try { const result = await service.updateLocation(req.params.id, req.body.latitude, req.body.longitude); res.json(result); } catch (err) { next(err); } };
const getAvailability = async (req, res, next) => { try { const result = await service.getAvailability(req.params.id); res.json(result); } catch (err) { next(err); } };
const addAvailability = async (req, res, next) => { try { const result = await service.addAvailability(req.params.id, req.body); res.json(result); } catch (err) { next(err); } };
const getMe = async (req, res, next) => { try { const result = await service.getMe(req.user.email); res.json(result); } catch (err) { next(err); } };
const updateMe = async (req, res, next) => { try { const result = await service.updateMe(req.user.email, req.validatedBody || req.body); res.json(result); } catch (err) { next(err); } };
const remove = async (req, res, next) => { try { const result = await service.remove(req.params.id); res.json(result); } catch (err) { next(err); } };

export { list, getById, create, update, updateStatus, updateLocation, getAvailability, addAvailability, remove, getMe, updateMe };

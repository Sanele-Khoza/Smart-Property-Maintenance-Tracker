import * as service from './notifications.service.js';

const list = async (req, res, next) => { try { const result = await service.list(req); res.json(result); } catch (err) { next(err); } };
const getById = async (req, res, next) => { try { const result = await service.getById(req.params.id); res.json(result); } catch (err) { next(err); } };
const create = async (req, res, next) => { try { const result = await service.create(req.validatedBody); res.status(201).json(result); } catch (err) { next(err); } };
const markRead = async (req, res, next) => { try { const result = await service.markRead(req.params.id); res.json(result); } catch (err) { next(err); } };
const markAllRead = async (req, res, next) => { try { const result = await service.markAllRead(req); res.json(result); } catch (err) { next(err); } };
const countUnread = async (req, res, next) => { try { const result = await service.countUnread(req); res.json(result); } catch (err) { next(err); } };
const updateStatus = async (req, res, next) => { try { const result = await service.updateStatus(req.params.id, req.body.deliveryStatus); res.json(result); } catch (err) { next(err); } };
const remove = async (req, res, next) => { try { const result = await service.remove(req.params.id); res.json(result); } catch (err) { next(err); } };

export { list, create, markRead, markAllRead, countUnread, updateStatus, remove };

import * as service from './notifications.service.js';

const list = async (req, res, next) => { try { const result = await service.list(req); res.json(result); } catch (err) { next(err); } };
const getById = async (req, res, next) => { try { const result = await service.getById(Number(req.params.id)); res.json(result); } catch (err) { next(err); } };
const create = async (req, res, next) => { try { const result = await service.create(req.validatedBody); res.status(201).json(result); } catch (err) { next(err); } };
const markRead = async (req, res, next) => { try { const result = await service.markRead(Number(req.params.id)); res.json(result); } catch (err) { next(err); } };
const markAllRead = async (req, res, next) => { try { const result = await service.markAllRead(req); res.json(result); } catch (err) { next(err); } };
const countUnread = async (req, res, next) => { try { const result = await service.countUnread(req); res.json(result); } catch (err) { next(err); } };
const updateStatus = async (req, res, next) => { try { const result = await service.updateStatus(Number(req.params.id), req.body.deliveryStatus); res.json(result); } catch (err) { next(err); } };
const remove = async (req, res, next) => { try { const result = await service.remove(Number(req.params.id)); res.json(result); } catch (err) { next(err); } };

export { list, create, markRead, markAllRead, countUnread, updateStatus, remove };

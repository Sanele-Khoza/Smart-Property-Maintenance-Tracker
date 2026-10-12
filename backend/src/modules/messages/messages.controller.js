import * as service from './messages.service.js';

const list = async (req, res, next) => { try { const result = await service.list(req); res.json(result); } catch (err) { next(err); } };
const listSent = async (req, res, next) => { try { const result = await service.listSent(req); res.json(result); } catch (err) { next(err); } };
const getById = async (req, res, next) => { try { const result = await service.getById(Number(req.params.id)); res.json(result); } catch (err) { next(err); } };
const send = async (req, res, next) => { try { const result = await service.send(req.user.id, req.validatedBody); res.status(201).json(result); } catch (err) { next(err); } };
const sendBroadcast = async (req, res, next) => { try { const result = await service.sendBroadcast(req.user.id, req.validatedBody); res.status(201).json(result); } catch (err) { next(err); } };
const popups = async (req, res, next) => { try { const result = await service.getPopups(req.user.id); res.json(result); } catch (err) { next(err); } };
const markRead = async (req, res, next) => { try { const result = await service.markRead(Number(req.params.id)); res.json(result); } catch (err) { next(err); } };
const countUnread = async (req, res, next) => { try { const result = await service.countUnread(req.user.id); res.json(result); } catch (err) { next(err); } };

export { list, listSent, getById, send, sendBroadcast, popups, markRead, countUnread };

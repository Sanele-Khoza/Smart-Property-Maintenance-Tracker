import * as service from './settings.service.js';

const getAll = async (req, res, next) => { try { const result = await service.getAll(); res.json(result); } catch (err) { next(err); } };
const updateSettings = async (req, res, next) => { try { const result = await service.updateSettings(req.body); res.json(result); } catch (err) { next(err); } };
const getSla = async (req, res, next) => { try { const result = await service.getSla(); res.json(result); } catch (err) { next(err); } };
const updateSla = async (req, res, next) => { try { const { priority, ...fields } = req.validatedBody; const result = await service.updateSla(priority, fields); res.json(result); } catch (err) { next(err); } };

export { getAll, updateSettings, getSla, updateSla };

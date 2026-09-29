import * as service from './backup.service.js';

const create = async (req, res, next) => {
  try {
    const result = await service.createBackup({
      type: 'MANUAL',
      userId: req.user?.id ?? null,
      ip: req.ip,
    });
    res.json(result);
  } catch (err) { next(err); }
};

const list = async (req, res, next) => {
  try {
    const result = await service.listBackups({
      limit: req.query.limit,
      offset: req.query.offset,
    });
    res.json(result);
  } catch (err) { next(err); }
};

const getOne = async (req, res, next) => {
  try {
    const result = await service.getBackup(req.params.id);
    res.json(result);
  } catch (err) { next(err); }
};

const verify = async (req, res, next) => {
  try {
    const result = await service.verifyBackup(req.params.id);
    res.json(result);
  } catch (err) { next(err); }
};

const restore = async (req, res, next) => {
  try {
    const result = await service.restoreBackup(req.params.id, {
      confirm: req.body?.confirm === true,
      userId: req.user?.id ?? null,
      ip: req.ip,
    });
    res.json(result);
  } catch (err) { next(err); }
};

const schedule = async (req, res, next) => {
  try {
    const result = await service.getSchedule();
    res.json(result);
  } catch (err) { next(err); }
};

export { create, list, getOne, verify, restore, schedule };
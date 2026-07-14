import * as service from './admin.service.js';

const getUsers = async (req, res, next) => {
  try {
    const result = await service.getUsers(req.query);
    res.json(result);
  } catch (err) { next(err); }
};

const approveUser = async (req, res, next) => {
  try {
    const result = await service.approveUser(req.params.id);
    res.json(result);
  } catch (err) { next(err); }
};

const deactivateUser = async (req, res, next) => {
  try {
    const result = await service.deactivateUser(req.params.id);
    res.json(result);
  } catch (err) { next(err); }
};

const changeRole = async (req, res, next) => {
  try {
    const result = await service.changeRole(req.params.id, req.body.role);
    res.json(result);
  } catch (err) { next(err); }
};

const reactivateUser = async (req, res, next) => {
  try {
    const result = await service.reactivateUser(req.params.id);
    res.json(result);
  } catch (err) { next(err); }
};

const unlockUser = async (req, res, next) => {
  try {
    const result = await service.unlockUser(req.params.id);
    res.json(result);
  } catch (err) { next(err); }
};

export { getUsers, approveUser, deactivateUser, changeRole, reactivateUser, unlockUser };

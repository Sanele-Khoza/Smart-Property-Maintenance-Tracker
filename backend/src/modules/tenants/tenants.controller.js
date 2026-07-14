import * as service from './tenants.service.js';

const myTickets = async (req, res, next) => {
  try {
    const result = await service.myTickets(req.user.id);
    res.json(result);
  } catch (err) { next(err); }
};

const getProfile = async (req, res, next) => {
  try {
    const result = await service.getProfile(req.user.id);
    res.json(result);
  } catch (err) { next(err); }
};

const updateProfile = async (req, res, next) => {
  try {
    const result = await service.updateProfile(req.user.id, req.body);
    res.json(result);
  } catch (err) { next(err); }
};

const rateTicket = async (req, res, next) => {
  try {
    const result = await service.rateTicket(req.params.id, req.user.id, req.body);
    res.json(result);
  } catch (err) { next(err); }
};

export { myTickets, getProfile, updateProfile, rateTicket };

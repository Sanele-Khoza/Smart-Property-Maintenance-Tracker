import * as service from './providers.service.js';

const myJobs = async (req, res, next) => {
  try {
    const result = await service.myJobs(req.user.id);
    res.json(result);
  } catch (err) { next(err); }
};

const acceptTicket = async (req, res, next) => {
  try {
    const result = await service.acceptTicket(req.params.id, req.user.id, `${req.user.name} ${req.user.surname}`);
    res.json(result);
  } catch (err) { next(err); }
};

const completeTicket = async (req, res, next) => {
  try {
    const result = await service.completeTicket(req.params.id, req.user.id, `${req.user.name} ${req.user.surname}`, req.body);
    res.json(result);
  } catch (err) { next(err); }
};

const myAvailability = async (req, res, next) => {
  try {
    const result = await service.myAvailability(req.user.id);
    res.json(result);
  } catch (err) { next(err); }
};

const updateAvailability = async (req, res, next) => {
  try {
    const result = await service.updateAvailability(req.user.id, req.body);
    res.json(result);
  } catch (err) { next(err); }
};

export { myJobs, acceptTicket, completeTicket, myAvailability, updateAvailability };

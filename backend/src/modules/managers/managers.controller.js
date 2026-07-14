import * as service from './managers.service.js';

const getProperties = async (req, res, next) => {
  try {
    const result = await service.getProperties();
    res.json(result);
  } catch (err) { next(err); }
};

const getTickets = async (req, res, next) => {
  try {
    const result = await service.getTickets(req.query);
    res.json(result);
  } catch (err) { next(err); }
};

const getReports = async (req, res, next) => {
  try {
    const result = await service.getReports();
    res.json(result);
  } catch (err) { next(err); }
};

export { getProperties, getTickets, getReports };

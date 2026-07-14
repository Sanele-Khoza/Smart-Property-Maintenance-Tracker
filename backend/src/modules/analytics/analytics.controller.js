import * as service from './analytics.service.js';

const overview = async (req, res, next) => {
  try {
    const result = await service.overview();
    res.json(result);
  } catch (err) { next(err); }
};

const ticketTrends = async (req, res, next) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 30, 365);
    const result = await service.ticketTrends(days);
    res.json(result);
  } catch (err) { next(err); }
};

const slaCompliance = async (req, res, next) => {
  try {
    const result = await service.slaCompliance();
    res.json(result);
  } catch (err) { next(err); }
};

const priorityDistribution = async (req, res, next) => {
  try {
    const result = await service.priorityDistribution();
    res.json(result);
  } catch (err) { next(err); }
};

export { overview, ticketTrends, slaCompliance, priorityDistribution };

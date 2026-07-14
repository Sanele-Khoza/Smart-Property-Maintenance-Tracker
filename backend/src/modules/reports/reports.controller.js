import * as service from './reports.service.js';

const ticketStats = async (req, res, next) => {
  try {
    const result = await service.ticketStats(req.query);
    res.json(result);
  } catch (err) { next(err); }
};

const technicianPerformance = async (req, res, next) => {
  try {
    const result = await service.technicianPerformance(req.query);
    res.json(result);
  } catch (err) { next(err); }
};

const propertyHealth = async (req, res, next) => {
  try {
    const result = await service.propertyHealth(req.query);
    res.json(result);
  } catch (err) { next(err); }
};

const providersSummary = async (req, res, next) => {
  try {
    const result = await service.providersSummary(req.query);
    res.json(result);
  } catch (err) { next(err); }
};

const categoriesSummary = async (req, res, next) => {
  try {
    const result = await service.categoriesSummary(req.query);
    res.json(result);
  } catch (err) { next(err); }
};

const fullReport = async (req, res, next) => {
  try {
    const result = await service.fullReport(req.query);
    res.json(result);
  } catch (err) { next(err); }
};

export { ticketStats, technicianPerformance, propertyHealth, providersSummary, categoriesSummary, fullReport };

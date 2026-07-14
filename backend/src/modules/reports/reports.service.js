import * as repo from './reports.repository.js';

function extractDateRange(query) {
  const filters = {};
  if (query.startDate) filters.startDate = query.startDate;
  if (query.endDate) filters.endDate = query.endDate;
  return filters;
}

async function ticketStats(reqQuery = {}) {
  const data = await repo.getTicketStats(extractDateRange(reqQuery));
  return { success: true, data };
}

async function technicianPerformance(reqQuery = {}) {
  const technicians = await repo.getTechnicianPerformance(extractDateRange(reqQuery));
  return { success: true, data: { technicians } };
}

async function propertyHealth(reqQuery = {}) {
  const properties = await repo.getPropertyHealth(extractDateRange(reqQuery));
  return { success: true, data: { properties } };
}

async function providersSummary(reqQuery = {}) {
  const providers = await repo.getProvidersSummary(extractDateRange(reqQuery));
  return { success: true, data: { providers } };
}

async function categoriesSummary(reqQuery = {}) {
  const categories = await repo.getCategoriesSummary(extractDateRange(reqQuery));
  return { success: true, data: { categories } };
}

async function fullReport(reqQuery = {}) {
  const report = await repo.getFullReport(extractDateRange(reqQuery));
  return { success: true, data: { report } };
}

export { ticketStats, technicianPerformance, propertyHealth, providersSummary, categoriesSummary, fullReport };

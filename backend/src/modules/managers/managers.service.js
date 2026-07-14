import * as repo from './managers.repository.js';

async function getProperties() {
  const properties = await repo.getProperties();
  return { success: true, data: { properties } };
}

async function getTickets(filters) {
  const tickets = await repo.getTickets(filters);
  return { success: true, data: { tickets } };
}

async function getReports() {
  const data = await repo.getReportsSummary();
  return { success: true, data };
}

export { getProperties, getTickets, getReports };

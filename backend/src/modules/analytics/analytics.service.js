import * as repo from './analytics.repository.js';

async function overview() {
  const data = await repo.getOverview();
  return { success: true, data };
}

async function ticketTrends(days) {
  const trends = await repo.getTicketTrends(days);
  return { success: true, data: { trends } };
}

async function slaCompliance() {
  const data = await repo.getSlaCompliance();
  return { success: true, data };
}

async function priorityDistribution() {
  const distribution = await repo.getPriorityDistribution();
  return { success: true, data: { distribution } };
}

export { overview, ticketTrends, slaCompliance, priorityDistribution };

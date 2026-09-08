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

async function dashboard() {
  const data = await repo.getDashboard();
  const fmtDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const ticketVolume = data.ticketVolume.map(row => ({
    date: fmtDate(row.date),
    created: row.created,
    resolved: row.resolved,
  }));

  const avgResolutionByPriority = data.avgResolutionByPriority.map(row => ({
    priority: row.priority,
    avgHours: row.avg_minutes != null ? Math.round(row.avg_minutes / 60 * 10) / 10 : 0,
  }));

  const slaComplianceByPriority = data.slaComplianceByPriority.map(row => ({
    priority: row.priority,
    total: row.total,
    compliant: row.total > 0 ? Math.round(row.compliant / row.total * 100) : 0,
  }));

  const statusDistribution = data.statusDistribution.map(row => ({
    name: row.status,
    value: row.count,
  }));

  const providerPerformance = data.providerPerformance.map(row => ({
    name: row.name.split(' ')[0],
    jobs: row.jobs,
    resolved: row.resolved,
    rating: row.rating,
    workload: row.workload,
  }));

  const priorityDistribution = data.priorityDistribution.map(row => ({
    priority: row.priority,
    count: row.count,
  }));

  const aiConfidence = data.aiConfidence.map(row => ({
    adapter: row.adapter,
    avgConfidence: Math.round(row.avg_confidence * 100),
    avgLatency: 0,
    conflicts: row.conflicts,
    calls: row.calls,
  }));

  return {
    success: true,
    data: {
      ticketVolume,
      avgResolutionByPriority,
      slaComplianceByPriority,
      statusDistribution,
      providerPerformance,
      priorityDistribution,
      aiConfidence,
      totalTickets: data.totalTickets,
    },
  };
}

export { overview, ticketTrends, slaCompliance, priorityDistribution, dashboard };

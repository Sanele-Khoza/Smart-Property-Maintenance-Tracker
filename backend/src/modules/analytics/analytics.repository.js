import { query } from '../../db/connection.js';

const getOverview = async () => {
  const [totalTickets, openTickets, completedTickets, totalProperties, totalUnits, vacantUnits, totalTechnicians, totalTenants, slaBreaches] = await Promise.all([
    query('SELECT COUNT(*)::int AS count FROM tickets WHERE deleted_at IS NULL').then(r => r.rows[0].count),
    query("SELECT COUNT(*)::int AS count FROM tickets WHERE deleted_at IS NULL AND status NOT IN ('Completed', 'Cancelled', 'Archived')").then(r => r.rows[0].count),
    query("SELECT COUNT(*)::int AS count FROM tickets WHERE deleted_at IS NULL AND status = 'Completed'").then(r => r.rows[0].count),
    query('SELECT COUNT(*)::int AS count FROM properties').then(r => r.rows[0].count),
    query('SELECT COUNT(*)::int AS count FROM units').then(r => r.rows[0].count),
    query("SELECT COUNT(*)::int AS count FROM units WHERE status = 'Vacant'").then(r => r.rows[0].count),
    query("SELECT COUNT(*)::int AS count FROM users WHERE role = 'SERVICE_PROVIDER'").then(r => r.rows[0].count),
    query("SELECT COUNT(*)::int AS count FROM users WHERE role = 'TENANT'").then(r => r.rows[0].count),
    query('SELECT COUNT(*)::int AS count FROM tickets WHERE deleted_at IS NULL AND sla_breached = TRUE').then(r => r.rows[0].count),
  ]);
  return { totalTickets, openTickets, completedTickets, totalProperties, totalUnits, vacantUnits, totalTechnicians, totalTenants, slaBreaches };
};

const getTicketTrends = async (days) => {
  const result = await query(
    `SELECT DATE(created_at) as date, COUNT(*)::int as count,
            SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END)::int as completed
     FROM tickets
     WHERE deleted_at IS NULL AND created_at >= NOW() - INTERVAL '1 day' * $1
     GROUP BY DATE(created_at)
     ORDER BY date ASC`,
    [days]
  );
  return result.rows;
};

const getSlaCompliance = async () => {
  const [totalResult, breachedResult] = await Promise.all([
    query("SELECT COUNT(*)::int AS count FROM tickets WHERE deleted_at IS NULL AND status NOT IN ('Cancelled', 'Archived')"),
    query("SELECT COUNT(*)::int AS count FROM tickets WHERE deleted_at IS NULL AND sla_breached = TRUE AND status NOT IN ('Cancelled', 'Archived')"),
  ]);
  const total = totalResult.rows[0].count;
  const breached = breachedResult.rows[0].count;
  const compliant = total - breached;
  const complianceRate = total > 0 ? ((compliant / total) * 100).toFixed(1) : '100.0';
  return { total, compliant, breached, complianceRate: parseFloat(complianceRate) };
};

const getPriorityDistribution = async () => {
  const result = await query(
    `SELECT priority, COUNT(*)::int as count
     FROM tickets
     WHERE deleted_at IS NULL AND status NOT IN ('Completed', 'Cancelled', 'Archived')
     GROUP BY priority
     ORDER BY CASE priority WHEN 'EMERGENCY' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 WHEN 'LOW' THEN 3 END`
  );
  return result.rows;
};

const getTicketVolume = async () => {
  const result = await query(
    `SELECT d::date AS date,
            COALESCE(created.c, 0)::int AS created,
            COALESCE(resolved.c, 0)::int AS resolved
     FROM generate_series(CURRENT_DATE - 13, CURRENT_DATE, '1 day') d
     LEFT JOIN (
       SELECT created_at::date AS date, COUNT(*)::int AS c
       FROM tickets WHERE deleted_at IS NULL
       GROUP BY 1
     ) created ON created.date = d::date
     LEFT JOIN (
       SELECT updated_at::date AS date, COUNT(*)::int AS c
       FROM tickets WHERE deleted_at IS NULL
         AND status IN ('Completed', 'Tenant Confirmed', 'Closed')
       GROUP BY 1
     ) resolved ON resolved.date = d::date
     ORDER BY d`
  );
  return result.rows;
};

const getAvgResolutionByPriority = async () => {
  const result = await query(
    `SELECT priority,
            AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 60000) AS avg_minutes,
            COUNT(*)::int AS count
     FROM tickets
     WHERE deleted_at IS NULL AND updated_at >= created_at
     GROUP BY priority
     ORDER BY CASE priority WHEN 'EMERGENCY' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 WHEN 'LOW' THEN 3 END`
  );
  return result.rows;
};

const getSlaComplianceByPriority = async () => {
  const result = await query(
    `SELECT t.priority,
            COUNT(*)::int AS total,
            COUNT(*) FILTER (
              WHERE EXTRACT(EPOCH FROM (t.updated_at - t.created_at)) / 60000 <= COALESCE(s.resolution_minutes, 999999)
            )::int AS compliant
     FROM tickets t
     LEFT JOIN sla_config s ON s.priority = t.priority
     WHERE t.deleted_at IS NULL
     GROUP BY t.priority
     ORDER BY CASE t.priority WHEN 'EMERGENCY' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 WHEN 'LOW' THEN 3 END`
  );
  return result.rows;
};

const getStatusDistribution = async () => {
  const result = await query(
    `SELECT status, COUNT(*)::int AS count
     FROM tickets
     WHERE deleted_at IS NULL
     GROUP BY status`
  );
  return result.rows;
};

const getProviderPerformance = async () => {
  const result = await query(
    `SELECT sp.id, sp.name, sp.rating, sp.current_workload AS workload,
            COUNT(t.id)::int AS jobs,
            COUNT(t.id) FILTER (WHERE t.status IN ('Completed', 'Tenant Confirmed', 'Closed'))::int AS resolved
     FROM service_providers sp
     LEFT JOIN tickets t ON t.assigned_to = sp.id AND t.deleted_at IS NULL
     GROUP BY sp.id, sp.name, sp.rating, sp.current_workload
     ORDER BY jobs DESC`
  );
  return result.rows;
};

const getAiConfidence = async () => {
  const result = await query(
    `SELECT service AS adapter,
            AVG(GREATEST(COALESCE(text_confidence, 0), COALESCE(visual_confidence, 0))) AS avg_confidence,
            COUNT(*)::int AS calls,
            COUNT(*) FILTER (WHERE conflict_detected)::int AS conflicts
     FROM ai_inference_log
     GROUP BY service`
  );
  return result.rows;
};

const getDashboard = async () => {
  const [
    ticketVolume,
    avgResolutionByPriority,
    slaComplianceByPriority,
    statusDistribution,
    providerPerformance,
    priorityDistribution,
    aiConfidence,
    totalTickets,
  ] = await Promise.all([
    getTicketVolume(),
    getAvgResolutionByPriority(),
    getSlaComplianceByPriority(),
    getStatusDistribution(),
    getProviderPerformance(),
    getPriorityDistribution(),
    getAiConfidence(),
    query('SELECT COUNT(*)::int AS count FROM tickets WHERE deleted_at IS NULL').then(r => r.rows[0].count),
  ]);
  return { ticketVolume, avgResolutionByPriority, slaComplianceByPriority, statusDistribution, providerPerformance, priorityDistribution, aiConfidence, totalTickets };
};

export {
  getOverview,
  getTicketTrends,
  getSlaCompliance,
  getPriorityDistribution,
  getDashboard,
};

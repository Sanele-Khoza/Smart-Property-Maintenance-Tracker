import { query } from '../../db/connection.js';

const getOverview = async () => {
  const [totalTickets, openTickets, completedTickets, totalProperties, totalUnits, vacantUnits, totalTechnicians, totalTenants, slaBreaches] = await Promise.all([
    query('SELECT COUNT(*)::int AS count FROM tickets').then(r => r.rows[0].count),
    query("SELECT COUNT(*)::int AS count FROM tickets WHERE status NOT IN ('Completed', 'Cancelled', 'Archived')").then(r => r.rows[0].count),
    query("SELECT COUNT(*)::int AS count FROM tickets WHERE status = 'Completed'").then(r => r.rows[0].count),
    query('SELECT COUNT(*)::int AS count FROM properties').then(r => r.rows[0].count),
    query('SELECT COUNT(*)::int AS count FROM units').then(r => r.rows[0].count),
    query("SELECT COUNT(*)::int AS count FROM units WHERE status = 'Vacant'").then(r => r.rows[0].count),
    query('SELECT COUNT(*)::int AS count FROM technicians').then(r => r.rows[0].count),
    query("SELECT COUNT(*)::int AS count FROM users WHERE role = 'TENANT'").then(r => r.rows[0].count),
    query('SELECT COUNT(*)::int AS count FROM tickets WHERE sla_breached = TRUE').then(r => r.rows[0].count),
  ]);
  return { totalTickets, openTickets, completedTickets, totalProperties, totalUnits, vacantUnits, totalTechnicians, totalTenants, slaBreaches };
};

const getTicketTrends = async (days) => {
  const result = await query(
    `SELECT DATE(created_by_date) as date, COUNT(*)::int as count,
            SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END)::int as completed
     FROM tickets
     WHERE created_by_date >= NOW() - INTERVAL '1 day' * $1
     GROUP BY DATE(created_by_date)
     ORDER BY date ASC`,
    [days]
  );
  return result.rows;
};

const getSlaCompliance = async () => {
  const [totalResult, breachedResult] = await Promise.all([
    query("SELECT COUNT(*)::int AS count FROM tickets WHERE status NOT IN ('Cancelled', 'Archived')"),
    query("SELECT COUNT(*)::int AS count FROM tickets WHERE sla_breached = TRUE AND status NOT IN ('Cancelled', 'Archived')"),
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
     WHERE status NOT IN ('Completed', 'Cancelled', 'Archived')
     GROUP BY priority
     ORDER BY CASE priority WHEN 'EMERGENCY' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 WHEN 'LOW' THEN 3 END`
  );
  return result.rows;
};

export { getOverview, getTicketTrends, getSlaCompliance, getPriorityDistribution };

import { query } from '../../db/connection.js';

function buildDateFilter(params, startDate, endDate) {
  const clauses = [];
  const values = [];
  if (startDate) {
    clauses.push(`t.created_at >= $${params.length + values.length + 1}`);
    values.push(startDate);
  }
  if (endDate) {
    clauses.push(`t.created_at <= $${params.length + values.length + 1}`);
    values.push(endDate);
  }
  return { sql: clauses.length ? ' AND ' + clauses.join(' AND ') : '', values };
}

function mergeParams(sqlParams, filterResult) {
  return {
    text: sqlParams.text.replace(/\$(\d+)/g, (m, n) => `$${parseInt(n) + filterResult.values.length}`),
    values: [...filterResult.values, ...sqlParams.values],
  };
}

async function runWithDates(baseSql, baseValues, startDate, endDate) {
  const df = buildDateFilter(baseValues, startDate, endDate);
  if (!df.sql) {
    return query(baseSql, baseValues.length ? baseValues : undefined);
  }
  const merged = mergeParams({ text: baseSql, values: baseValues }, df);
  return query(merged.text.replace(/(WHERE\s+1=1|LEFT JOIN\s+\w+\s+\w+\s+ON\s+\w+)/, `$1${df.sql}`), merged.values.length ? merged.values : undefined);
}

const getTicketStats = async ({ startDate, endDate } = {}) => {
  const df = buildDateFilter([], startDate, endDate);
  const whereClause = df.sql || '';
  const baseValues = df.values;
  const [totalResult, statusResult, priorityResult] = await Promise.all([
    query(`SELECT COUNT(*)::int AS total FROM tickets t WHERE 1=1${whereClause}`, baseValues.length ? baseValues : undefined),
    query(`SELECT status, COUNT(*)::int AS count FROM tickets t WHERE 1=1${whereClause} GROUP BY status ORDER BY count DESC`, baseValues.length ? baseValues : undefined),
    query(`SELECT priority, COUNT(*)::int AS count FROM tickets t WHERE 1=1${whereClause} GROUP BY priority ORDER BY CASE priority WHEN 'EMERGENCY' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 WHEN 'LOW' THEN 3 END`, baseValues.length ? baseValues : undefined),
  ]);
  return {
    total: totalResult.rows[0].total,
    byStatus: statusResult.rows,
    byPriority: priorityResult.rows,
  };
};

const getTechnicianPerformance = async ({ startDate, endDate } = {}) => {
  const df = buildDateFilter([], startDate, endDate);
  const joinClause = df.sql ? ` AND (1=1${df.sql})` : '';
  const result = await query(
    `SELECT sp.id, sp.name, sp.company_name, sp.status,
            COUNT(t.id)::int as total_jobs,
            SUM(CASE WHEN t.status = 'Completed' THEN 1 ELSE 0 END)::int as completed_jobs,
            ROUND(AVG(pr.rating), 2) as avg_rating,
            sp.current_workload
     FROM service_providers sp
     LEFT JOIN tickets t ON t.assigned_to = sp.id${joinClause}
     LEFT JOIN performance_ratings pr ON pr.ticket_id = t.id
     GROUP BY sp.id
     ORDER BY completed_jobs DESC`,
    df.values.length ? df.values : undefined
  );
  return result.rows;
};

const getPropertyHealth = async ({ startDate, endDate } = {}) => {
  const df = buildDateFilter([], startDate, endDate);
  const filterClause = df.sql || '';
  const vals = df.values;
  const result = await query(
    `SELECT p.id, p.name, p.type, p.status, p.address,
            (SELECT COUNT(*)::int FROM units WHERE property_id = p.id) as total_units,
            (SELECT COUNT(*)::int FROM units WHERE property_id = p.id AND status = 'Vacant') as vacant_units,
            (SELECT COUNT(*)::int FROM tickets t JOIN units u ON t.unit_id = u.id WHERE u.property_id = p.id AND t.status NOT IN ('Completed','Cancelled','Archived')${filterClause}) as open_tickets,
            (SELECT COUNT(*)::int FROM tickets t JOIN units u ON t.unit_id = u.id WHERE u.property_id = p.id AND t.sla_breached = TRUE${filterClause}) as sla_breaches
     FROM properties p
     ORDER BY p.name`,
    vals.length ? vals : undefined
  );
  return result.rows;
};

const getProvidersSummary = async ({ startDate, endDate } = {}) => {
  const df = buildDateFilter([], startDate, endDate);
  const joinClause = df.sql ? ` AND (1=1${df.sql})` : '';
  const result = await query(
    `SELECT sp.id, sp.name, sp.company_name, sp.status,
            COUNT(t.id)::int as total_jobs,
            SUM(CASE WHEN t.status = 'Completed' THEN 1 ELSE 0 END)::int as completed_jobs,
            ROUND(AVG(pr.rating), 2) as avg_rating,
            sp.current_workload
     FROM service_providers sp
     LEFT JOIN tickets t ON t.assigned_to = sp.id${joinClause}
     LEFT JOIN performance_ratings pr ON pr.ticket_id = t.id
     GROUP BY sp.id
     ORDER BY completed_jobs DESC`,
    df.values.length ? df.values : undefined
  );
  return result.rows;
};

const getCategoriesSummary = async ({ startDate, endDate } = {}) => {
  const df = buildDateFilter([], startDate, endDate);
  const whereClause = df.sql || '';
  const vals = df.values;
  const result = await query(
    `SELECT t.category,
            COUNT(t.id)::int as total_tickets,
            SUM(CASE WHEN t.status = 'Completed' THEN 1 ELSE 0 END)::int as completed_tickets,
            ROUND(AVG(CASE WHEN t.status IN ('Completed','Cancelled') THEN EXTRACT(EPOCH FROM (t.updated_at - t.created_at))/86400 END), 1) as avg_resolution_days
     FROM tickets t
     WHERE 1=1${whereClause}
     GROUP BY t.category
     ORDER BY total_tickets DESC`,
    vals.length ? vals : undefined
  );
  return result.rows;
};

const getFullReport = async ({ startDate, endDate } = {}) => {
  const df = buildDateFilter([], startDate, endDate);
  const filterClause = df.sql || '';
  const vals = df.values;
  const result = await query(
    `SELECT p.id, p.name, p.type, p.status, p.address, p.created_at,
            (SELECT COUNT(*)::int FROM units WHERE property_id = p.id) as total_units,
            (SELECT COUNT(*)::int FROM units WHERE property_id = p.id AND status = 'Vacant') as vacant_units,
            (SELECT COUNT(*)::int FROM tickets t JOIN units u ON t.unit_id = u.id WHERE u.property_id = p.id${filterClause}) as total_tickets,
            (SELECT COUNT(*)::int FROM tickets t JOIN units u ON t.unit_id = u.id WHERE u.property_id = p.id AND t.status != 'Completed'${filterClause}) as open_tickets
     FROM properties p
     ORDER BY p.name`,
    vals.length ? vals : undefined
  );
  return result.rows;
};

export { getTicketStats, getTechnicianPerformance, getPropertyHealth, getProvidersSummary, getCategoriesSummary, getFullReport };

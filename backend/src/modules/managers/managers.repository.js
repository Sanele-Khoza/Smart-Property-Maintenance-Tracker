import { query } from '../../db/connection.js';

const getProperties = async () => {
  const result = await query(
    `SELECT p.*, (SELECT COUNT(*)::int FROM units u WHERE u.property_id = p.id) AS unit_count
     FROM properties p ORDER BY p.name ASC`
  );
  return result.rows;
};

const getTickets = async (filters = {}) => {
  const conditions = [];
  const params = [];
  let idx = 1;
  conditions.push('t.deleted_at IS NULL');
  if (filters.status) {
    conditions.push(`t.status = $${idx++}`);
    params.push(filters.status);
  }
  if (filters.priority) {
    conditions.push(`t.priority = $${idx++}`);
    params.push(filters.priority);
  }
  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  const result = await query(
    `SELECT t.*, p.name AS property_name, u.unit_number,
            t.category AS category_name
     FROM tickets t
     LEFT JOIN units u ON u.id = t.unit_id
     LEFT JOIN properties p ON p.id = u.property_id
     ${whereClause}
     ORDER BY t.created_at DESC`,
    params
  );
  return result.rows;
};

const getReportsSummary = async () => {
  const [openTickets, completedTickets, overdueTickets, totalProperties, totalUnits, availableTechs] = await Promise.all([
    query("SELECT COUNT(*)::int AS count FROM tickets WHERE deleted_at IS NULL AND status NOT IN ('Completed', 'Cancelled', 'Archived')").then(r => r.rows[0].count),
    query("SELECT COUNT(*)::int AS count FROM tickets WHERE deleted_at IS NULL AND status = 'Completed'").then(r => r.rows[0].count),
    query("SELECT COUNT(*)::int AS count FROM tickets WHERE deleted_at IS NULL AND status NOT IN ('Completed', 'Cancelled', 'Archived') AND due_date < NOW()").then(r => r.rows[0].count),
    query('SELECT COUNT(*)::int AS count FROM properties').then(r => r.rows[0].count),
    query('SELECT COUNT(*)::int AS count FROM units').then(r => r.rows[0].count),
    query("SELECT COUNT(*)::int AS count FROM service_providers WHERE status IN ('AVAILABLE', 'ON_CALL')").then(r => r.rows[0].count),
  ]);
  return { openTickets, completedTickets, overdueTickets, totalProperties, totalUnits, availableTechnicians: availableTechs };
};

export { getProperties, getTickets, getReportsSummary };

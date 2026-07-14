import { query } from '../../db/connection.js';

const findById = async (id) => {
  const result = await query(
    `SELECT l.*, u.unit_number, p.name AS property_name,
            u2.name AS tenant_name, u2.surname AS tenant_surname
     FROM leases l
     JOIN units u ON u.id = l.unit_id
     JOIN properties p ON p.id = u.property_id
     JOIN users u2 ON u2.id = l.tenant_id
     WHERE l.id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

const findAll = async (filters = {}) => {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (filters.unit_id) { conditions.push(`l.unit_id = $${idx++}`); params.push(filters.unit_id); }
  if (filters.tenant_id) { conditions.push(`l.tenant_id = $${idx++}`); params.push(filters.tenant_id); }
  if (filters.status) { conditions.push(`l.status = $${idx++}`); params.push(filters.status); }
  if (filters.property_id) { conditions.push(`u.property_id = $${idx++}`); params.push(filters.property_id); }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  const limit = filters.limit ? parseInt(filters.limit) : 20;
  const offset = filters.offset ? parseInt(filters.offset) : 0;

  const countResult = await query(
    `SELECT COUNT(*) FROM leases l JOIN units u ON u.id = l.unit_id ${where}`,
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const result = await query(
    `SELECT l.*, u.unit_number, p.name AS property_name,
            u2.name AS tenant_name, u2.surname AS tenant_surname
     FROM leases l
     JOIN units u ON u.id = l.unit_id
     JOIN properties p ON p.id = u.property_id
     JOIN users u2 ON u2.id = l.tenant_id
     ${where}
     ORDER BY l.created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset]
  );

  return { leases: result.rows, total };
};

const create = async (data) => {
  const result = await query(
    `INSERT INTO leases (unit_id, tenant_id, start_date, end_date, monthly_rent, deposit, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [data.unit_id, data.tenant_id, data.start_date, data.end_date, data.monthly_rent, data.deposit || 0, data.notes || null]
  );
  return findById(result.rows[0].id);
};

const update = async (id, data) => {
  const entries = Object.entries(data).filter(([_, v]) => v !== undefined);
  if (entries.length === 0) return findById(id);
  const setClauses = [];
  const params = [];
  let idx = 1;
  for (const [key, value] of entries) {
    setClauses.push(`${key} = $${idx++}`);
    params.push(value);
  }
  params.push(id);
  await query(
    `UPDATE leases SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${idx}`,
    params
  );
  return findById(id);
};

const remove = async (id) => {
  await query('DELETE FROM leases WHERE id = $1', [id]);
};

const getActiveLeasesByUnit = async (unitId) => {
  const result = await query(
    "SELECT * FROM leases WHERE unit_id = $1 AND status = 'ACTIVE' ORDER BY created_at DESC",
    [unitId]
  );
  return result.rows;
};

const getActiveLeasesByTenant = async (tenantId) => {
  const result = await query(
    "SELECT l.*, u.unit_number, p.name AS property_name FROM leases l JOIN units u ON u.id = l.unit_id JOIN properties p ON p.id = u.property_id WHERE l.tenant_id = $1 AND l.status = 'ACTIVE'",
    [tenantId]
  );
  return result.rows;
};

export { findById, findAll, create, update, remove, getActiveLeasesByUnit, getActiveLeasesByTenant };

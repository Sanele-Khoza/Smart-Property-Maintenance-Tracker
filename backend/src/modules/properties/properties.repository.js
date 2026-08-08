import { query } from '../../db/connection.js';

const findById = async (id) => {
  const result = await query(
    `SELECT p.*, TRIM(CONCAT(m.name, ' ', m.surname)) AS manager_name,
            m.email AS manager_email, m.phone AS manager_phone
     FROM properties p
     LEFT JOIN users m ON m.id = p.manager_id
     WHERE p.id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

const findAll = async (filters = {}) => {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (filters.type) {
    conditions.push(`p.type = $${idx++}`);
    params.push(filters.type);
  }
  if (filters.status) {
    conditions.push(`p.status = $${idx++}`);
    params.push(filters.status);
  }
  if (filters.search) {
    conditions.push(`(p.name ILIKE $${idx} OR p.address ILIKE $${idx})`);
    params.push(`%${filters.search}%`);
    idx++;
  }
  if (filters.occupant_id) {
    conditions.push(`p.id IN (SELECT u.property_id FROM units u WHERE u.occupant_id = $${idx++})`);
    params.push(filters.occupant_id);
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  const limit = filters.limit ? parseInt(filters.limit) : null;
  const offset = filters.offset ? parseInt(filters.offset) : null;

  const countResult = await query(
    `SELECT COUNT(*) FROM properties p ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  let sql = `SELECT p.*, (SELECT COUNT(*) FROM units u WHERE u.property_id = p.id)::int AS unit_count,
            TRIM(CONCAT(m.name, ' ', m.surname)) AS manager_name,
            m.email AS manager_email, m.phone AS manager_phone
     FROM properties p
     LEFT JOIN users m ON m.id = p.manager_id ${whereClause} ORDER BY p.name ASC`;
  if (limit !== null) { sql += ` LIMIT $${idx++}`; params.push(limit); }
  if (offset !== null) { sql += ` OFFSET $${idx++}`; params.push(offset); }

  const result = await query(sql, params);
  return {
    properties: result.rows.map(row => ({ ...row, unitCount: row.unit_count })),
    total,
  };
};

const resolveManagerId = async (managerName, managerId) => {
  if (managerId) return managerId;
  if (!managerName) return null;
  const parts = String(managerName).trim().split(/\s+/);
  const name = parts[0] || '';
  const surname = parts.slice(1).join(' ') || '';
  const result = await query(
    `SELECT id FROM users WHERE name = $1 AND COALESCE(surname, '') = $2 AND role = 'PROPERTY_MANAGER' LIMIT 1`,
    [name, surname]
  );
  return result.rows[0]?.id || null;
};

const create = async (data) => {
  const managerId = await resolveManagerId(data.managerName, data.manager_id || data.managerId);
  const result = await query(
    `INSERT INTO properties (name, type, status, address, manager_id) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [data.name, data.type || 'Residential', data.status || 'Active', data.address, managerId]
  );
  return result.rows[0];
};

const update = async (id, data) => {
  const payload = { ...data };
  if (payload.managerName !== undefined) {
    if (payload.managerId === undefined) {
      payload.manager_id = await resolveManagerId(payload.managerName, null);
    }
    delete payload.managerName;
  }

  const entries = Object.entries(payload).filter(([_, v]) => v !== undefined);
  if (entries.length === 0) return findById(id);

  const columnMap = { managerId: 'manager_id', propertyId: 'property_id' };
  const setClauses = [];
  const params = [];
  let idx = 1;
  for (const [key, value] of entries) {
    setClauses.push(`${columnMap[key] || key} = $${idx++}`);
    params.push(value);
  }
  params.push(id);
  const result = await query(
    `UPDATE properties SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
    params
  );
  return result.rows[0];
};

const remove = async (id) => {
  await query('DELETE FROM properties WHERE id = $1', [id]);
};

export { findById, findAll, create, update, remove };

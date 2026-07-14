import { query } from '../../db/connection.js';

const findById = async (id) => {
  const result = await query('SELECT * FROM properties WHERE id = $1', [id]);
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

  let sql = `SELECT p.*, (SELECT COUNT(*) FROM units u WHERE u.property_id = p.id)::int AS unit_count
     FROM properties p ${whereClause} ORDER BY p.name ASC`;
  if (limit !== null) { sql += ` LIMIT $${idx++}`; params.push(limit); }
  if (offset !== null) { sql += ` OFFSET $${idx++}`; params.push(offset); }

  const result = await query(sql, params);
  return {
    properties: result.rows.map(row => ({ ...row, unitCount: row.unit_count })),
    total,
  };
};

const create = async (data) => {
  const result = await query(
    `INSERT INTO properties (name, type, status, address) VALUES ($1, $2, $3, $4) RETURNING *`,
    [data.name, data.type || 'Residential', data.status || 'Active', data.address]
  );
  return result.rows[0];
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

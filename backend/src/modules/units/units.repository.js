import { query } from '../../db/connection.js';

const findById = async (id) => {
  const result = await query(
    `SELECT u.*, p.name AS property_name, p.address AS property_address,
            TRIM(CONCAT(occ.name, ' ', occ.surname)) AS tenant_name
     FROM units u
     LEFT JOIN properties p ON p.id = u.property_id
     LEFT JOIN users occ ON occ.id = u.occupant_id
     WHERE u.id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

const findAll = async (filters = {}) => {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (filters.property_id || filters.propertyId) {
    conditions.push(`u.property_id = $${idx++}`);
    params.push(filters.property_id || filters.propertyId);
  }
  if (filters.status) {
    conditions.push(`u.status = $${idx++}`);
    params.push(filters.status);
  }
  if (filters.occupant_id || filters.occupantId) {
    conditions.push(`u.occupant_id = $${idx++}`);
    params.push(filters.occupant_id || filters.occupantId);
  }
  if (filters.search) {
    conditions.push(`(u.unit_number ILIKE $${idx} OR p.name ILIKE $${idx})`);
    params.push(`%${filters.search}%`);
    idx++;
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  const limit = filters.limit ? parseInt(filters.limit) : null;
  const offset = filters.offset ? parseInt(filters.offset) : null;

  const countResult = await query(
    `SELECT COUNT(*) FROM units u LEFT JOIN properties p ON p.id = u.property_id ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  let sql = `SELECT u.*, p.name AS property_name, p.address AS property_address,
            TRIM(CONCAT(occ.name, ' ', occ.surname)) AS tenant_name
     FROM units u
     LEFT JOIN properties p ON p.id = u.property_id
     LEFT JOIN users occ ON occ.id = u.occupant_id
     ${whereClause}
     ORDER BY p.name ASC, u.unit_number ASC`;
  if (limit !== null) { sql += ` LIMIT $${idx++}`; params.push(limit); }
  if (offset !== null) { sql += ` OFFSET $${idx++}`; params.push(offset); }

  const result = await query(sql, params);
  return { units: result.rows, total };
};

const create = async (data) => {
  const result = await query(
    `INSERT INTO units (property_id, unit_number, floor, type, bedrooms, bathrooms, size_sqm, monthly_rent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [
      data.property_id || data.propertyId, data.unit_number || data.unitNumber, data.floor || null,
      data.type || '1-Bed', data.bedrooms || 1, data.bathrooms || 1,
      data.size_sqm || data.sizeSqm || null, data.monthly_rent || data.monthlyRent || null,
    ]
  );
  return result.rows[0];
};

const update = async (id, data) => {
  const entries = Object.entries(data).filter(([_, v]) => v !== undefined);
  if (entries.length === 0) return findById(id);

  const columnMap = { propertyId: 'property_id', occupantId: 'occupant_id', unitNumber: 'unit_number' };
  const setClauses = [];
  const params = [];
  let idx = 1;
  for (const [key, value] of entries) {
    setClauses.push(`${columnMap[key] || key} = $${idx++}`);
    params.push(value);
  }
  params.push(id);
  const result = await query(
    `UPDATE units SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
    params
  );
  return result.rows[0];
};

const assign = async (unitId, tenantId) => {
  await query(
    "UPDATE units SET occupant_id = $1, status = 'Occupied' WHERE id = $2",
    [tenantId, unitId]
  );
};

const vacate = async (unitId) => {
  await query(
    "UPDATE units SET occupant_id = NULL, status = 'Vacant' WHERE id = $1",
    [unitId]
  );
};

const remove = async (id) => {
  await query('DELETE FROM units WHERE id = $1', [id]);
};

const findByOccupant = async (tenantId) => {
  const result = await query(
    `SELECT u.*, p.name AS property_name
     FROM units u
     JOIN properties p ON p.id = u.property_id
     WHERE u.occupant_id = $1 AND u.status = 'Occupied'
     LIMIT 1`,
    [tenantId]
  );
  return result.rows[0] || null;
};

const findTenantIdByName = async (name, surname) => {
  const result = await query(
    `SELECT id FROM users WHERE name = $1 AND COALESCE(surname, '') = $2 AND role = 'TENANT' LIMIT 1`,
    [name, surname]
  );
  return result.rows[0] || null;
};

export { findById, findAll, create, update, assign, vacate, remove, findByOccupant, findTenantIdByName };

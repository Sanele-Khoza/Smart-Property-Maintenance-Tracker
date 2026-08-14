import { query } from '../../db/connection.js';

const findById = async (id) => {
  const result = await query('SELECT * FROM service_providers WHERE id = $1', [id]);
  return result.rows[0] || null;
};

const findByEmail = async (email) => {
  const result = await query('SELECT * FROM service_providers WHERE email = $1', [email]);
  return result.rows[0] || null;
};

const updateByEmail = async (email, data) => {
  const provider = await findByEmail(email);
  if (!provider) return null;
  return update(provider.id, data);
};

const findAll = async (filters = {}) => {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (filters.status) {
    conditions.push(`sp.status = $${idx++}`);
    params.push(filters.status);
  }
  if (filters.search) {
    conditions.push(`(sp.name ILIKE $${idx} OR sp.company_name ILIKE $${idx})`);
    params.push(`%${filters.search}%`);
    idx++;
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  const result = await query(
    `SELECT sp.* FROM service_providers sp ${whereClause} ORDER BY sp.rating DESC`,
    params
  );
  return result.rows;
};

const create = async (data) => {
  const list = data.specialisations || [];
  const result = await query(
    `INSERT INTO service_providers (name, company_name, email, phone, specialisations)
     VALUES ($1, $2, $3, $4, $5::text[]) RETURNING *`,
    [data.name, data.companyName || null, data.email || null, data.phone || null, `{${list.join(',')}}`]
  );
  return result.rows[0];
};

const findUserByEmail = async (email) => {
  const result = await query(
    'SELECT id, name, surname, email, phone FROM users WHERE email = $1 AND deleted_at IS NULL',
    [email]
  );
  return result.rows[0] || null;
};

const COLUMN_MAP = {
  availability_status: 'status',
  companyName: 'company_name',
  currentWorkload: 'current_workload',
  gpsLatitude: 'gps_location',
  gpsLongitude: 'gps_location',
};

const update = async (id, data) => {
  const entries = Object.entries(data).filter(([_, v]) => v !== undefined);
  if (entries.length === 0) return findById(id);

  const setClauses = [];
  const params = [];
  let idx = 1;
  for (const [key, value] of entries) {
    const column = COLUMN_MAP[key] || key;
    if (column === 'gps_location') {
      const lat = data.gpsLatitude ?? data.gps_location_lat;
      const lng = data.gpsLongitude ?? data.gps_location_lng;
      setClauses.push(`${column} = point($${idx++}, $${idx++}), last_location_update = NOW()`);
      params.push(lat, lng);
      continue;
    }
    setClauses.push(`${column} = $${idx++}`);
    params.push(value);
  }
  params.push(id);
  const result = await query(
    `UPDATE service_providers SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
    params
  );
  return result.rows[0];
};

const updateLocation = async (id, latitude, longitude) => {
  await query(
    'UPDATE service_providers SET gps_location = point($1, $2), last_location_update = NOW() WHERE id = $3',
    [latitude, longitude, id]
  );
};

const remove = async (id) => {
  await query('DELETE FROM service_providers WHERE id = $1', [id]);
};

export { findById, findByEmail, updateByEmail, findAll, create, findUserByEmail, update, updateLocation, remove };

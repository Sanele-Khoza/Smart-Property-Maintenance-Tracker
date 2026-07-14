import { query } from '../../db/connection.js';

const findById = async (id) => {
  const result = await query('SELECT * FROM calendar_events WHERE id = $1', [id]);
  return result.rows[0] || null;
};

const findAll = async (filters = {}) => {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (filters.start_date) { conditions.push(`start_time >= $${idx++}`); params.push(filters.start_date); }
  if (filters.end_date) { conditions.push(`start_time <= $${idx++}`); params.push(filters.end_date); }
  if (filters.event_type) { conditions.push(`event_type = $${idx++}`); params.push(filters.event_type); }
  if (filters.created_by) { conditions.push(`created_by = $${idx++}`); params.push(filters.created_by); }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  const limit = filters.limit ? parseInt(filters.limit) : 100;
  const offset = filters.offset ? parseInt(filters.offset) : 0;

  const countResult = await query(`SELECT COUNT(*) FROM calendar_events ${where}`, params);
  const total = parseInt(countResult.rows[0].count, 10);

  const result = await query(
    `SELECT e.*, u.name AS created_by_name, u.surname AS created_by_surname
     FROM calendar_events e
     LEFT JOIN users u ON u.id = e.created_by
     ${where}
     ORDER BY start_time ASC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset]
  );
  return { events: result.rows, total };
};

const create = async (data) => {
  const result = await query(
    `INSERT INTO calendar_events (title, description, event_type, start_time, end_time, all_day, related_to_type, related_to_id, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [data.title, data.description || null, data.event_type || 'GENERAL',
     data.start_time, data.end_time || null, data.all_day || false,
     data.related_to_type || null, data.related_to_id || null, data.created_by || null]
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
    `UPDATE calendar_events SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${idx}`,
    params
  );
  return findById(id);
};

const remove = async (id) => {
  await query('DELETE FROM calendar_events WHERE id = $1', [id]);
};

export { findById, findAll, create, update, remove };

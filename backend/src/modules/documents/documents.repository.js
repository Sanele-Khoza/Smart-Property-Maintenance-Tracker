import { query } from '../../db/connection.js';

const findById = async (id) => {
  const result = await query('SELECT * FROM documents WHERE id = $1', [id]);
  return result.rows[0] || null;
};

const findAll = async (filters = {}) => {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (filters.uploaded_by) {
    conditions.push(`uploaded_by = $${idx++}`);
    params.push(filters.uploaded_by);
  }
  if (filters.type) {
    conditions.push(`type = $${idx++}`);
    params.push(filters.type);
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  const result = await query(
    `SELECT * FROM documents ${whereClause} ORDER BY uploaded_at DESC`,
    params
  );
  return result.rows;
};

const create = async (data) => {
  const result = await query(
    'INSERT INTO documents (name, type, file_path, file_url, uploaded_by, description) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
    [data.name, data.type, data.file_path || null, data.file_url || null, data.uploaded_by || null, data.description || null]
  );
  return result.rows[0];
};

const remove = async (id) => {
  await query('DELETE FROM documents WHERE id = $1', [id]);
};

export { findById, findAll, create, remove };

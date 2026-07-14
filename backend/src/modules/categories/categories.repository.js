import { query } from '../../db/connection.js';

const findById = async (id) => {
  const result = await query('SELECT * FROM categories WHERE id = $1', [Number(id)]);
  return result.rows[0] || null;
};

const findAll = async () => {
  const result = await query('SELECT * FROM categories ORDER BY name ASC');
  return result.rows;
};

const create = async (data) => {
  const result = await query(
    'INSERT INTO categories (name, icon, color) VALUES ($1, $2, $3) RETURNING *',
    [data.name, data.icon || '🔧', data.color || '#95a5a6']
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
  params.push(Number(id));
  const result = await query(
    `UPDATE categories SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
    params
  );
  return result.rows[0];
};

const remove = async (id) => {
  await query('DELETE FROM categories WHERE id = $1', [Number(id)]);
};

export { findById, findAll, create, update, remove };

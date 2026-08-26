import { query } from '../../db/connection.js';
const findById = async (id) => {
  const result = await query(
    'SELECT id, name, surname, email, role, phone, status FROM users WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
};
export { findById };

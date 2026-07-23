import { query } from '../../db/connection.js';

const getUsers = async (filters = {}) => {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (filters.status) {
    conditions.push(`status = $${idx++}`);
    params.push(filters.status);
  }
  if (filters.role) {
    conditions.push(`role = $${idx++}`);
    params.push(filters.role);
  }
  if (filters.search) {
    conditions.push(`(name ILIKE $${idx} OR surname ILIKE $${idx} OR email ILIKE $${idx})`);
    params.push(`%${filters.search}%`);
    idx++;
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  const result = await query(
    `SELECT id, name, surname, email, phone, role, status, approved, approved_at, last_login, created_at FROM users ${whereClause} ORDER BY created_at DESC`,
    params
  );
  return result.rows;
};

const approveUser = async (id) => {
  await query(
    "UPDATE users SET approved = TRUE, approved_at = NOW(), status = 'ACTIVE' WHERE id = $1",
    [id]
  );
};

const setAccountStatus = async (id, status) => {
  await query('UPDATE users SET status = $1 WHERE id = $2', [status, id]);
};

const changeRole = async (id, role) => {
  await query('UPDATE users SET role = $1 WHERE id = $2', [role, id]);
};

const unlockUser = async (id) => {
  await query('UPDATE users SET login_attempts = 0, locked_until = NULL WHERE id = $1', [id]);
};

export { getUsers, approveUser, setAccountStatus, changeRole, unlockUser };

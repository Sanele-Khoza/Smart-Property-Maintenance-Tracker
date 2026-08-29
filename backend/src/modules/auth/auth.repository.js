import { query } from '../../db/connection.js';

const SELECT_PROFILE = 'id, name, surname, email, role, phone, status, approved, approved_at, last_login, created_at';

const findByEmail = async (email) => {
  const result = await query('SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL', [email]);
  return result.rows[0] || null;
};

const findById = async (id) => {
  const result = await query(`SELECT ${SELECT_PROFILE} FROM users WHERE id = $1 AND deleted_at IS NULL`, [id]);
  return result.rows[0] || null;
};

const findByIdFull = async (id) => {
  const result = await query('SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL', [id]);
  return result.rows[0] || null;
};

const create = async ({ name, surname, email, phone, idNumber, passwordHash, role, status, approved }) => {
  const result = await query(
    `INSERT INTO users (name, surname, email, phone, id_number, password_hash, role, status, approved, email_verification_token, password_changed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
     RETURNING id, name, surname, email, role, phone, status`,
    [name, surname, email, phone || null, idNumber || null, passwordHash, role, status, approved, null]
  );
  return result.rows[0];
};

const updateLoginAttempts = async (userId, attempts) => {
  await query('UPDATE users SET login_attempts = $1 WHERE id = $2', [attempts, userId]);
};

const lockUser = async (userId, lockedUntil, attempts) => {
  await query('UPDATE users SET locked_until = $1, login_attempts = $2 WHERE id = $3', [lockedUntil, attempts, userId]);
};

const updateLastLogin = async (userId) => {
  await query('UPDATE users SET last_login = NOW() WHERE id = $1', [userId]);
};

const findByVerificationToken = async (token) => {
  const result = await query('SELECT * FROM users WHERE email_verification_token = $1 AND deleted_at IS NULL', [token]);
  return result.rows[0] || null;
};

const verifyUser = async (userId) => {
  await query("UPDATE users SET email_verification_token = NULL, status = 'ACTIVE', approved = TRUE WHERE id = $1", [userId]);
};

const setResetToken = async (userId, token, expiry) => {
  await query('UPDATE users SET password_reset_token = $1, password_reset_expiry = $2 WHERE id = $3', [token, expiry, userId]);
};

const findByResetToken = async (token) => {
  const result = await query('SELECT * FROM users WHERE password_reset_token = $1 AND password_reset_expiry > NOW() AND deleted_at IS NULL', [token]);
  return result.rows[0] || null;
};

const updatePassword = async (userId, passwordHash) => {
  await query('UPDATE users SET password_hash = $1, password_reset_token = NULL, password_reset_expiry = NULL, password_changed_at = NOW() WHERE id = $2', [passwordHash, userId]);
};

const deactivateAccount = async (userId) => {
  await query("UPDATE users SET status = 'DEACTIVATED', deactivated_at = NOW() WHERE id = $1", [userId]);
};

const reactivateAccount = async (userId) => {
  await query("UPDATE users SET status = 'ACTIVE', deactivated_at = NULL, login_attempts = 0, locked_until = NULL WHERE id = $1", [userId]);
};

const saveRefreshToken = async (userId, token, expiresAt) => {
  await query('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)', [userId, token, expiresAt]);
};

const findRefreshToken = async (token) => {
  const result = await query('SELECT * FROM refresh_tokens WHERE token = $1 AND revoked = FALSE AND expires_at > NOW()', [token]);
  return result.rows[0] || null;
};

const revokeRefreshToken = async (token) => {
  await query('UPDATE refresh_tokens SET revoked = TRUE WHERE token = $1', [token]);
};

const revokeAllUserRefreshTokens = async (userId) => {
  await query('UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1', [userId]);
};

const updateUser = async (userId, fields) => {
  const setClauses = [];
  const params = [];
  let idx = 1;
  for (const [key, value] of Object.entries(fields)) {
    setClauses.push(`${key} = $${idx++}`);
    params.push(value);
  }
  if (setClauses.length === 0) return null;
  setClauses.push('updated_at = NOW()');
  params.push(userId);
  const result = await query(
    `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING ${SELECT_PROFILE}`,
    params
  );
  return result.rows[0] || null;
};

const createServiceProvider = async ({ name, companyName, email, phone, specialisations }) => {
  const list = specialisations || [];
  const result = await query(
    `INSERT INTO service_providers (name, company_name, email, phone, specialisations)
     VALUES ($1, $2, $3, $4, $5::text[]) RETURNING id, name, company_name, email, phone, specialisations`,
    [name, companyName || null, email || null, phone || null, `{${list.join(',')}}`]
  );
  return result.rows[0];
};

export {
  findByEmail, findById, findByIdFull, create, createServiceProvider,
  updateLoginAttempts, lockUser, updateLastLogin,
  findByVerificationToken, verifyUser,
  setResetToken, findByResetToken, updatePassword,
  deactivateAccount, reactivateAccount,
  saveRefreshToken, findRefreshToken, revokeRefreshToken, revokeAllUserRefreshTokens,
  updateUser,
};

import { query } from '../../db/connection.js';
import AppError from '../../shared/errors/AppError.js';
import { notifyUserStatusChange } from '../../shared/utils/notifyUser.js';

function getIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
}

const getUsers = async (req, res, next) => {
  try {
    const conditions = ['deleted_at IS NULL'];
    const params = [];
    let idx = 1;
    if (req.query.status) { conditions.push(`status = $${idx++}`); params.push(req.query.status); }
    if (req.query.role) { conditions.push(`role = $${idx++}`); params.push(req.query.role); }
    if (req.query.search) { conditions.push(`(name ILIKE $${idx} OR surname ILIKE $${idx} OR email ILIKE $${idx})`); params.push(`%${req.query.search}%`); idx++; }
    const whereClause = 'WHERE ' + conditions.join(' AND ');
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const countResult = await query(`SELECT COUNT(*) FROM users ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    params.push(limit);
    params.push(offset);
    const result = await query(`SELECT id, name, surname, email, phone, role, status, approved, approved_at, last_login, created_at, login_attempts, locked_until FROM users ${whereClause} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`, params);
    res.json({ success: true, data: { users: result.rows }, error: null, meta: { timestamp: new Date().toISOString(), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } } });
  } catch (err) { next(err); }
};

const getPendingUsers = async (req, res, next) => {
  try {
    const result = await query("SELECT id, name, surname, email, phone, role, created_at FROM users WHERE status = 'PENDING' AND approved = FALSE AND deleted_at IS NULL ORDER BY created_at ASC");
    res.json({ success: true, data: { users: result.rows }, error: null, meta: { timestamp: new Date().toISOString() } });
  } catch (err) { next(err); }
};

const approveUser = async (req, res, next) => {
  try {
    const result = await query(
      "UPDATE users SET approved = TRUE, approved_at = NOW(), status = 'ACTIVE' WHERE id = $1 RETURNING id, name, surname, email, phone, role, status, approved, approved_at",
      [req.params.id]
    );
    if (result.rows.length === 0) throw AppError.notFound('User not found');
    const user = result.rows[0];
    await notifyUserStatusChange({
      userId: user.id,
      userEmail: user.email,
      userName: `${user.name} ${user.surname}`,
      action: 'ACCOUNT_APPROVED',
      title: 'Account approved',
      body: `Your ${user.role === 'PROPERTY_MANAGER' ? 'Property Manager' : 'account'} was approved by the System Administrator. You can now log in.`,
      performedBy: req.user?.id,
      ipAddress: getIp(req),
      severity: 'INFO',
    });
    res.json({ success: true, data: { user }, error: null, meta: { timestamp: new Date().toISOString() } });
  } catch (err) { next(err); }
};

const deactivateUser = async (req, res, next) => {
  try {
    const result = await query("UPDATE users SET status = 'DEACTIVATED', deactivated_at = NOW() WHERE id = $1 RETURNING id, name, surname, email, phone, role, status, approved, approved_at", [req.params.id]);
    if (result.rows.length === 0) throw AppError.notFound('User not found');
    const user = result.rows[0];
    await notifyUserStatusChange({
      userId: user.id,
      userEmail: user.email,
      userName: `${user.name} ${user.surname}`,
      action: 'ACCOUNT_DEACTIVATED',
      title: 'Account deactivated',
      body: 'Your account was deactivated by the System Administrator. You no longer have access to SPMT. Contact your property manager for help.',
      performedBy: req.user?.id,
      ipAddress: getIp(req),
    });
    res.json({ success: true, data: { user }, error: null, meta: { timestamp: new Date().toISOString() } });
  } catch (err) { next(err); }
};

const reactivateUser = async (req, res, next) => {
  try {
    const result = await query("UPDATE users SET status = 'ACTIVE', deactivated_at = NULL, login_attempts = 0, locked_until = NULL WHERE id = $1 RETURNING id, name, surname, email, phone, role, status, approved, approved_at", [req.params.id]);
    if (result.rows.length === 0) throw AppError.notFound('User not found');
    const user = result.rows[0];
    await notifyUserStatusChange({
      userId: user.id,
      userEmail: user.email,
      userName: `${user.name} ${user.surname}`,
      action: 'ACCOUNT_REACTIVATED',
      title: 'Account reactivated',
      body: 'Your account was reactivated by the System Administrator. You can log in again.',
      performedBy: req.user?.id,
      ipAddress: getIp(req),
      severity: 'INFO',
    });
    res.json({ success: true, data: { user }, error: null, meta: { timestamp: new Date().toISOString() } });
  } catch (err) { next(err); }
};

const changeRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!role || !['SYSTEM_ADMIN','PROPERTY_MANAGER','TENANT','SERVICE_PROVIDER'].includes(role)) throw AppError.badRequest('Invalid role');
    const result = await query('UPDATE users SET role = $1 WHERE id = $2 RETURNING id, name, surname, email, phone, role, status', [role, req.params.id]);
    if (result.rows.length === 0) throw AppError.notFound('User not found');
    const user = result.rows[0];
    await notifyUserStatusChange({
      userId: user.id,
      userEmail: user.email,
      userName: `${user.name} ${user.surname}`,
      action: 'ROLE_CHANGED',
      title: 'Role updated',
      body: `Your role was changed to ${user.role.replace(/_/g, ' ').toLowerCase()} by the System Administrator. Your menu and access have been updated.`,
      performedBy: req.user?.id,
      ipAddress: getIp(req),
      severity: 'INFO',
    });
    res.json({ success: true, data: { user }, error: null, meta: { timestamp: new Date().toISOString() } });
  } catch (err) { next(err); }
};

const unlockUser = async (req, res, next) => {
  try {
    const result = await query('UPDATE users SET login_attempts = 0, locked_until = NULL WHERE id = $1 RETURNING id, name, surname, email, phone, role, status, login_attempts', [req.params.id]);
    if (result.rows.length === 0) throw AppError.notFound('User not found');
    const user = result.rows[0];
    await notifyUserStatusChange({
      userId: user.id,
      userEmail: user.email,
      userName: `${user.name} ${user.surname}`,
      action: 'ACCOUNT_UNLOCKED',
      title: 'Account unlocked',
      body: 'Your account was unlocked by the System Administrator. You can try logging in again.',
      performedBy: req.user?.id,
      ipAddress: getIp(req),
      severity: 'INFO',
    });
    res.json({ success: true, data: { user }, error: null, meta: { timestamp: new Date().toISOString() } });
  } catch (err) { next(err); }
};

const updateUser = async (req, res, next) => {
  try {
    const fields = ['name', 'surname', 'email', 'phone', 'role'];
    const updates = [];
    const params = [];
    let idx = 1;
    for (const f of fields) {
      if (req.body[f] !== undefined) { updates.push(`${f} = $${idx++}`); params.push(req.body[f]); }
    }
    if (updates.length === 0) throw AppError.badRequest('No fields to update');
    params.push(req.params.id);
    await query(`UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${idx}`, params);
    const result = await query('SELECT id, name, surname, email, phone, role, status FROM users WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) throw AppError.notFound('User not found');
    const user = result.rows[0];
    await notifyUserStatusChange({
      userId: user.id,
      userEmail: user.email,
      userName: `${user.name} ${user.surname}`,
      action: 'USER_UPDATED',
      title: 'Account updated',
      body: 'Your account details were updated by the System Administrator.',
      performedBy: req.user?.id,
      ipAddress: getIp(req),
      severity: 'INFO',
    });
    res.json({ success: true, data: { user }, error: null, meta: { timestamp: new Date().toISOString() } });
  } catch (err) { next(err); }
};

export { getUsers, getPendingUsers, approveUser, deactivateUser, reactivateUser, changeRole, unlockUser, updateUser };

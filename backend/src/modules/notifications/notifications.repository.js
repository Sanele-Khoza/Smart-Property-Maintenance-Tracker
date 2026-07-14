import { query } from '../../db/connection.js';

const findForUser = async (userId, email, filters = {}) => {
  const conditions = ['(user_id = $1 OR recipient = $2)'];
  const params = [userId, email];
  let idx = 3;

  if (filters.read !== undefined) {
    conditions.push(`read = $${idx++}`);
    params.push(filters.read);
  }
  if (filters.type) {
    conditions.push(`type = $${idx++}`);
    params.push(filters.type);
  }

  const whereClause = 'WHERE ' + conditions.join(' AND ');

  const countResult = await query(`SELECT COUNT(*) FROM notifications ${whereClause}`, params.slice(0, idx - 1));
  const total = parseInt(countResult.rows[0].count, 10);

  let sql = `SELECT * FROM notifications ${whereClause} ORDER BY created_at DESC`;

  if (filters.limit) {
    sql += ` LIMIT $${idx++}`;
    params.push(parseInt(filters.limit));
  }
  if (filters.offset) {
    sql += ` OFFSET $${idx++}`;
    params.push(parseInt(filters.offset));
  }

  const result = await query(sql, params);
  return { notifications: result.rows, total };
};

const findById = async (id) => {
  const result = await query('SELECT * FROM notifications WHERE id = $1', [id]);
  return result.rows[0] || null;
};

const create = async (data) => {
  const result = await query(
    'INSERT INTO notifications (user_id, type, title, body, is_emergency) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [data.user_id || null, data.type || 'info', data.title || null, data.body, !!data.is_emergency]
  );
  return result.rows[0];
};

const markRead = async (id) => {
  const result = await query('UPDATE notifications SET read = TRUE WHERE id = $1 RETURNING *', [id]);
  return result.rows[0];
};

const markAllRead = async (userId, email) => {
  await query('UPDATE notifications SET read = TRUE WHERE (user_id = $1 OR recipient = $2) AND read = FALSE', [userId, email]);
};

const updateDeliveryStatus = async (id, status) => {
  const result = await query('UPDATE notifications SET delivery_status = $1 WHERE id = $2 RETURNING *', [status, id]);
  return result.rows[0];
};

const remove = async (id) => {
  await query('DELETE FROM notifications WHERE id = $1', [id]);
};

const countUnread = async (userId, email) => {
  const result = await query('SELECT COUNT(*)::int AS count FROM notifications WHERE (user_id = $1 OR recipient = $2) AND read = FALSE', [userId, email]);
  return result.rows[0].count;
};

export { findForUser, findById, create, markRead, markAllRead, updateDeliveryStatus, remove, countUnread };

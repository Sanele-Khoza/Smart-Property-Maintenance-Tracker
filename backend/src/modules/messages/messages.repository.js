import { query } from '../../db/connection.js';

const findForUser = async (userId, filters = {}) => {
  let condition;
  const params = [];
  let idx = 1;

  if (filters.folder === 'sent') {
    condition = `sender_id = $${idx++}`;
    params.push(userId);
  } else if (filters.folder === 'inbox') {
    condition = `receiver_id = $${idx++}`;
    params.push(userId);
  } else {
    condition = `(sender_id = $${idx} OR receiver_id = $${idx})`;
    params.push(userId);
    idx++;
  }

  if (filters.read !== undefined) {
    condition += ` AND read = $${idx++}`;
    params.push(filters.read === 'true');
  }

  const result = await query(
    `SELECT m.*, s.name AS sender_name, s.surname AS sender_surname,
            r.name AS receiver_name, r.surname AS receiver_surname
     FROM messages m
     LEFT JOIN users s ON s.id = m.sender_id
     LEFT JOIN users r ON r.id = m.receiver_id
     WHERE ${condition}
     ORDER BY m.created_at DESC`,
    params
  );
  return result.rows.map(row => ({
    ...row,
    sender_name: row.sender_name,
    sender_surname: row.sender_surname,
    receiver_name: row.receiver_name,
    receiver_surname: row.receiver_surname,
  }));
};

const findById = async (id) => {
  const result = await query('SELECT * FROM messages WHERE id = $1', [id]);
  return result.rows[0] || null;
};

const create = async (data) => {
  const result = await query(
    'INSERT INTO messages (sender_id, receiver_id, subject, body, category) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [data.sender_id, data.receiver_id, data.subject, data.body, data.category || 'general']
  );
  return result.rows[0];
};

const markRead = async (id) => {
  const result = await query('UPDATE messages SET read = TRUE WHERE id = $1 RETURNING *', [id]);
  return result.rows[0];
};

const countUnread = async (userId) => {
  const result = await query('SELECT COUNT(*)::int AS count FROM messages WHERE receiver_id = $1 AND read = FALSE', [userId]);
  return result.rows[0].count;
};

export { findForUser, findById, create, markRead, countUnread };

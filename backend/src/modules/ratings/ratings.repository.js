import { query } from '../../db/connection.js';

const findTicket = async (ticketId) => {
  const result = await query(
    `SELECT id, tenant_id, status
     FROM tickets
     WHERE id = $1`,
    [ticketId]
  );

  return result.rows[0];
};

const findExistingRating = async (ticketId, userId) => {
  const result = await query(
    `SELECT id
     FROM ratings
     WHERE ticket_id = $1
     AND rated_by = $2`,
    [ticketId, userId]
  );

  return result.rows[0];
};

const createRating = async (ticketId, userId, rating, comment) => {
  const result = await query(
    `INSERT INTO ratings
      (ticket_id, rated_by, rating_value, comment)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [ticketId, userId, rating, comment]
  );

  return result.rows[0];
};


const getTicketRatings = async (ticketId) => {
  const result = await query(
    `SELECT
        r.id,
        r.rating_value,
        r.comment,
        r.created_at,
        u.name,
        u.surname
     FROM ratings r
     LEFT JOIN users u
       ON r.rated_by = u.id
     WHERE r.ticket_id = $1
     ORDER BY r.created_at DESC`,
    [ticketId]
  );

  return result.rows;
};

export {
  findTicket,
  findExistingRating,
  createRating,
  getTicketRatings,
};
import { query, getClient } from '../../db/connection.js';

const findTicket = async (ticketId) => {
  const result = await query(
    `SELECT id, tenant_id, status, assigned_to
     FROM tickets
     WHERE id = $1 AND deleted_at IS NULL`,
    [ticketId]
  );

  return result.rows[0];
};

const findExistingRating = async (ticketId, userId) => {
  const result = await query(
    `SELECT id
     FROM performance_ratings
     WHERE ticket_id = $1
     AND rated_by = $2`,
    [ticketId, userId]
  );

  return result.rows[0];
};

const createRating = async (ticketId, userId, rating, comment) => {
  const result = await query(
    `INSERT INTO performance_ratings
      (ticket_id, rated_by, rating, comment)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [ticketId, userId, rating, comment]
  );

  return result.rows[0];
};

const PROVIDER_SYNC_SQL = `
  UPDATE service_providers
  SET rating = ROUND(((rating * rating_count + $2)::numeric) / (rating_count + 1), 2)::float,
      rating_count = rating_count + 1,
      updated_at = NOW()
  WHERE id = $1
  RETURNING rating, rating_count
`;

/*
 * Atomic: insert the tenant rating and roll the provider's aggregate rating
 * forward in the same transaction so service_providers.rating always stays
 * in sync with the ratings table.
 */
const createRatingWithSync = async ({ ticketId, userId, rating, comment, providerId }) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const createdResult = await client.query(
      `INSERT INTO performance_ratings
        (ticket_id, rated_by, rating, comment)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [ticketId, userId, rating, comment || null]
    );
    let provider = null;
    if (providerId) {
      const providerResult = await client.query(PROVIDER_SYNC_SQL, [providerId, rating]);
      provider = providerResult.rows[0] || null;
    }
    await client.query('COMMIT');
    return { created: createdResult.rows[0], provider };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const syncProviderRating = async (providerId, rating) => {
  const result = await query(PROVIDER_SYNC_SQL, [providerId, rating]);
  return result.rows[0] || null;
};


const getTicketRatings = async (ticketId) => {
  const result = await query(
    `SELECT
        r.id,
        r.rating,
        r.comment,
        r.created_at,
        u.name,
        u.surname
     FROM performance_ratings r
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
  createRatingWithSync,
  syncProviderRating,
  getTicketRatings,
};
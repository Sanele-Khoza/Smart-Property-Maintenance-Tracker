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

/*
 * Role-scoped list of individual ratings:
 *  - TENANT           → only ratings submitted by the caller
 *  - SERVICE_PROVIDER → only ratings on tickets assigned to the caller
 *  - PROPERTY_MANAGER → only ratings on tickets in the caller's properties
 *  - SYSTEM_ADMIN     → every rating in the system
 */
const listRatings = async ({ userId, role }) => {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (role === 'TENANT') {
    conditions.push(`r.rated_by = $${idx++}`);
    params.push(userId);
  } else if (role === 'SERVICE_PROVIDER') {
    conditions.push(
      `t.assigned_to = (
         SELECT sp.id FROM service_providers sp
         WHERE sp.email = (SELECT u.email FROM users u WHERE u.id = $${idx++})
       )`
    );
    params.push(userId);
  } else if (role === 'PROPERTY_MANAGER') {
    conditions.push(`p.manager_id = $${idx++}`);
    params.push(userId);
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  const result = await query(
    `SELECT
        r.id,
        r.rating,
        r.comment,
        r.created_at,
        r.rated_by AS rated_by_id,
        TRIM(CONCAT(tenant_user.name, ' ', tenant_user.surname)) AS tenant_name,
        t.id AS ticket_id,
        t.title AS ticket_title,
        t.status AS ticket_status,
        t.assigned_to AS provider_id,
        sp.name AS provider_name,
        sp.rating AS provider_rating,
        sp.rating_count AS provider_rating_count,
        p.name AS property_name,
        u.unit_number,
        p.manager_id
     FROM performance_ratings r
     JOIN tickets t ON t.id = r.ticket_id
     LEFT JOIN users tenant_user ON tenant_user.id = r.rated_by
     LEFT JOIN service_providers sp ON sp.id = t.assigned_to
     LEFT JOIN units u ON u.id = t.unit_id
     LEFT JOIN properties p ON p.id = u.property_id
     ${whereClause}
     ORDER BY r.created_at DESC`,
    params
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
  listRatings,
};
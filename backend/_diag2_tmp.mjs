import { query } from './src/db/connection.js';
try {
  const r = await query(`
    UPDATE service_providers sp
    SET rating = ROUND(agg.avg_rating::numeric, 2)::float,
        rating_count = agg.cnt
    FROM (
      SELECT t.assigned_to AS provider_id,
             AVG(r.rating_value) AS avg_rating,
             COUNT(*)::int AS cnt
      FROM ratings r
      JOIN tickets t ON t.id = r.ticket_id
      WHERE t.assigned_to IS NOT NULL
        AND t.deleted_at IS NULL
      GROUP BY t.assigned_to
    ) agg
    WHERE sp.id = agg.provider_id
  `);
  console.log('backfill OK rows:', r.rowCount);
} catch (e) {
  console.log('backfill ERR:', e.message);
}
process.exit(0);

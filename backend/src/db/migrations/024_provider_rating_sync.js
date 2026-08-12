async function up(query) {
  await query(`
    ALTER TABLE service_providers ADD COLUMN IF NOT EXISTS rating_count INTEGER NOT NULL DEFAULT 0
  `);

  /* Backfill: providers with existing tenant ratings get their true average and count.
     Reads from performance_ratings — the live UUID-based rating store that both the
     ratings module and the reports aggregation share. */
  await query(`
    UPDATE service_providers sp
    SET rating = ROUND(agg.avg_rating::numeric, 2)::float,
        rating_count = agg.cnt
    FROM (
      SELECT t.assigned_to AS provider_id,
             AVG(pr.rating) AS avg_rating,
             COUNT(pr.ticket_id)::int AS cnt
      FROM performance_ratings pr
      JOIN tickets t ON t.id = pr.ticket_id
      WHERE t.assigned_to IS NOT NULL
        AND t.deleted_at IS NULL
      GROUP BY t.assigned_to
    ) agg
    WHERE sp.id = agg.provider_id
  `);

  /* Providers with no tenant ratings yet: treat the seeded rating as one prior
     rating so the moving-average formula starts from a meaningful baseline */
  await query(`
    UPDATE service_providers SET rating_count = 1 WHERE rating_count = 0
  `);
}

async function down(query) {
  await query('ALTER TABLE service_providers DROP COLUMN IF EXISTS rating_count');
}

export { up, down };

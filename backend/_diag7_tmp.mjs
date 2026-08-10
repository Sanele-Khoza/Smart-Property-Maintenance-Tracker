import { query } from './src/db/connection.js';
try {
  const r = await query(`SELECT ROUND(((rating * rating_count + $2)::numeric) / (rating_count + 1), 2)::float AS new_rating, rating_count + 1 AS new_count FROM service_providers WHERE id = $1`, ['c0000000-0000-0000-0000-000000000003', 5]);
  console.log('FIXED SQL OK:', JSON.stringify(r.rows[0]));
} catch (e) {
  console.log('ERR:', e.message);
}
process.exit(0);

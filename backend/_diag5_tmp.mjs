import { query } from './src/db/connection.js';
const mig = await query(`SELECT 1 FROM _migrations WHERE name = '024_provider_rating_sync'`);
console.log('migration recorded:', mig.rows.length === 1);
const dist = await query(`SELECT rating, rating_count, COUNT(*)::int AS n FROM service_providers GROUP BY rating, rating_count ORDER BY rating_count`);
dist.rows.forEach(r => console.log(`rating=${r.rating} count=${r.rating_count} providers=${r.n}`));
process.exit(0);

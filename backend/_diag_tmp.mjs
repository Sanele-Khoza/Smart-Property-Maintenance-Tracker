import { query } from './src/db/connection.js';
try {
  const r = await query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('ratings','performance_ratings','service_providers','tickets')`);
  console.log('tables:', r.rows.map(x => x.tablename).join(', '));
  const c = await query(`SELECT COUNT(*)::int AS n FROM service_providers`);
  console.log('providers:', c.rows[0].n);
  const rc = await query(`SELECT rating_count, COUNT(*)::int AS n FROM service_providers GROUP BY rating_count`);
  console.log('rating_count dist:', JSON.stringify(rc.rows));
} catch (e) {
  console.log('ERR:', e.message);
}
process.exit(0);

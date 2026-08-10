import { query } from './src/db/connection.js';
console.log('ratings rows:', (await query('SELECT COUNT(*)::int AS n FROM ratings')).rows[0].n);
console.log('performance_ratings rows:', (await query('SELECT COUNT(*)::int AS n FROM performance_ratings')).rows[0].n);
const pr = await query(`SELECT pr.ticket_id, pr.rating, t.assigned_to FROM performance_ratings pr LEFT JOIN tickets t ON t.id = pr.ticket_id LIMIT 5`);
pr.rows.forEach(r => console.log('perf row:', JSON.stringify({ ticket_id: r.ticket_id, rating: r.rating, assigned_to: r.assigned_to })));
process.exit(0);

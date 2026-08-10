import { query } from './src/db/connection.js';
const rows = (await query(`SELECT id, status, assigned_to, tenant_id, deleted_at FROM tickets WHERE title = 'E2E rating sync test' ORDER BY created_at DESC LIMIT 3`)).rows;
rows.forEach(r => console.log(JSON.stringify(r)));
process.exit(0);

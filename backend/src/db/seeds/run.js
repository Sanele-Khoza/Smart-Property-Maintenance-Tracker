import pkg from 'pg';
import dotenv from 'dotenv';
import { seed } from './index.js';

dotenv.config();

const pool = new pkg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  database: process.env.DB_NAME || 'spmt',
  user: process.env.DB_USER || 'spmt_user',
  password: process.env.DB_PASSWORD || 'spmt_pass',
  connectionTimeoutMillis: 5000,
});

async function main() {
  await seed((text, params) => pool.query(text, params));
  await pool.end();
  console.log(`
────────────────────────────────────────────────────────────
  Demo logins added (already-existing accounts untouched):
────────────────────────────────────────────────────────────
  SYSTEM_ADMIN     admin@spmt.com              admin123
  PROPERTY_MANAGER john@spmt.com / sarah.m@spmt.com / nomsa@spmt.com   manager123
  TENANT           sarah / mike / jane / linda / thabo / zanele @spmt.com   tenant123
  SERVICE_PROVIDER bob / alice / tom / lisa / david / henry / grace / ivy @spmt.com   provider123
────────────────────────────────────────────────────────────
  NOTE: Run migrations first (npm run migrate) if tables are missing.
`);
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});

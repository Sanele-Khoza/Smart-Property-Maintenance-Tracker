import pkg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const { Pool } = pkg;
async function main() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT,10)||5432,
    database: process.env.DB_NAME||'spmt',
    user: process.env.DB_USER||'spmt_user',
    password: process.env.DB_PASSWORD||'spmt_pass'
  });
  const res = await pool.query("SELECT event_object_table AS t, trigger_name AS n FROM information_schema.triggers WHERE event_object_schema = 'public' ORDER BY 1,2");
  for (const x of res.rows) console.log(x.t + ' -> ' + x.n);
  await pool.end();
}
main();

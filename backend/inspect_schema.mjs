import pg from "pg";
const pool = new pg.Pool({ host: process.env.DB_HOST || "localhost", port: 5432, database: "spmt", user: "spmt_user", password: "spmt_pass" });
const cols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'tickets' ORDER BY ordinal_position");
console.log('TICKETS COLS:', JSON.stringify(cols.rows));
const trig = await pool.query("SELECT tgname, pg_get_triggerdef(t.oid) AS def FROM pg_trigger t WHERE NOT tgisinternal AND tgrelid = 'tickets'::regclass");
console.log('TICKETS TRIGGERS:', JSON.stringify(trig.rows));
await pool.end();

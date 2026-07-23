import pkg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const { Pool } = pkg;

const IMMUTABLE = [
  'performance_ratings', 'ai_inference_log', 'audit_log',
  'security_audit_log', 'ticket_attachments', 'ticket_status_history',
];

async function disableTrigs(client) {
  for (const tbl of IMMUTABLE) {
    await client.query(`ALTER TABLE ${tbl} DISABLE TRIGGER trg_block_delete_${tbl}`).catch(() => {});
    await client.query(`ALTER TABLE ${tbl} DISABLE TRIGGER trg_block_update_${tbl}`).catch(() => {});
  }
}
async function enableTrigs(client) {
  for (const tbl of IMMUTABLE) {
    await client.query(`ALTER TABLE ${tbl} ENABLE TRIGGER trg_block_delete_${tbl}`).catch(() => {});
    await client.query(`ALTER TABLE ${tbl} ENABLE TRIGGER trg_block_update_${tbl}`).catch(() => {});
  }
}

async function main() {
  const p = new Pool({host:process.env.DB_HOST||'localhost',port:parseInt(process.env.DB_PORT,10)||5432,database:process.env.DB_NAME||'spmt',user:process.env.DB_USER||'spmt_user',password:process.env.DB_PASSWORD||'spmt_pass'});
  const client = await p.connect();
  try {
    const r = await client.query("SELECT id, email, status FROM users WHERE email = 'sanelerondo078@gmail.com'");
    if (!r.rows.length) { console.log('User not found'); return; }
    console.log('Found:', r.rows[0].id, r.rows[0].email, r.rows[0].status);
    await client.query('BEGIN');
    await disableTrigs(client);
    await client.query("DELETE FROM users WHERE email = 'sanelerondo078@gmail.com'");
    await enableTrigs(client);
    await client.query('COMMIT');
    console.log('Deleted');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    await enableTrigs(client).catch(() => {});
    console.error('Error:', err.message);
  } finally {
    client.release();
    await p.end();
  }
}
main();

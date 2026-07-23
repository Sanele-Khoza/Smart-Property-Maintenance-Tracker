import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  database: process.env.DB_NAME || 'spmt',
  user: process.env.DB_USER || 'spmt_user',
  password: process.env.DB_PASSWORD || 'spmt_pass',
});

const DEMO_USER_IDS = [
  'a0000000-0000-0000-0000-000000000002',  // Manager
  'a0000000-0000-0000-0000-000000000003',  // Sarah
  'a0000000-0000-0000-0000-000000000004',  // Mike
  'a0000000-0000-0000-0000-000000000005',  // Jane
  'a0000000-0000-0000-0000-000000000006',  // Bob
];

const DEMO_SP_IDS = [
  'c0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000002',
  'c0000000-0000-0000-0000-000000000003',
  'c0000000-0000-0000-0000-000000000004',
  'c0000000-0000-0000-0000-000000000005',
];

const DEMO_PROPERTY_IDS = [
  'b0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000002',
  'b0000000-0000-0000-0000-000000000003',
  'b0000000-0000-0000-0000-000000000004',
  'b0000000-0000-0000-0000-000000000005',
];

function fmt(arr) {
  return arr.map(id => `'${id}'`).join(',');
}

/* Tables with INSERT-only triggers that block cascade updates/deletes */
const IMMUTABLE = [
  'performance_ratings',
  'ai_inference_log',
  'audit_log',
  'security_audit_log',
  'ticket_attachments',
  'ticket_status_history',
];

async function disableImmutableTriggers(client) {
  for (const tbl of IMMUTABLE) {
    await client.query(`ALTER TABLE ${tbl} DISABLE TRIGGER trg_block_delete_${tbl}`).catch(() => {});
    await client.query(`ALTER TABLE ${tbl} DISABLE TRIGGER trg_block_update_${tbl}`).catch(() => {});
  }
}

async function enableImmutableTriggers(client) {
  for (const tbl of IMMUTABLE) {
    await client.query(`ALTER TABLE ${tbl} ENABLE TRIGGER trg_block_delete_${tbl}`).catch(() => {});
    await client.query(`ALTER TABLE ${tbl} ENABLE TRIGGER trg_block_update_${tbl}`).catch(() => {});
  }
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    /* Temporarily disable INSERT-only triggers that would block cascade FROM users */
    await disableImmutableTriggers(client);

    /* 1. Delete demo users — cascades to refresh_tokens, notification_preferences,
          password_reset_tokens, messages, leases, notifications.
          ON DELETE SET NULL handles tickets.tenant_id, units.occupant_id,
          and performance_ratings.rated_by. */
    const r1 = await client.query(`DELETE FROM users WHERE id IN (${fmt(DEMO_USER_IDS)})`);
    console.log(`  deleted users: ${r1.rowCount}`);

    /* 2. Delete demo service_providers — ON DELETE SET NULL handles tickets.assigned_to */
    const r2 = await client.query(`DELETE FROM service_providers WHERE id IN (${fmt(DEMO_SP_IDS)})`);
    console.log(`  deleted service_providers: ${r2.rowCount}`);

    /* 3. Delete demo properties — cascades to units.
          ON DELETE SET NULL handles tickets.unit_id */
    const r3 = await client.query(`DELETE FROM properties WHERE id IN (${fmt(DEMO_PROPERTY_IDS)})`);
    console.log(`  deleted properties: ${r3.rowCount}`);

    /* Re-enable triggers */
    await enableImmutableTriggers(client);

    await client.query('COMMIT');
    console.log('\nDone. Admin user preserved.');
  } catch (err) {
    await client.query('ROLLBACK');
    await enableImmutableTriggers(client).catch(() => {});
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();

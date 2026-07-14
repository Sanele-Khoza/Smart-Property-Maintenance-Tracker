async function up(query) {
  await query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token VARCHAR(255) UNIQUE NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      revoked BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token)`);

  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS remember_me_token VARCHAR(255)`);
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS session_token VARCHAR(255)`);

  await query(`
    CREATE TABLE IF NOT EXISTS permissions (
      id VARCHAR(100) PRIMARY KEY,
      label VARCHAR(255) NOT NULL,
      "group" VARCHAR(50) NOT NULL
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      role VARCHAR(20) NOT NULL,
      permission_id VARCHAR(100) NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
      PRIMARY KEY (role, permission_id)
    )
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_role_permissions_perm ON role_permissions(permission_id)`);

  await query(`
    CREATE OR REPLACE FUNCTION block_audit_mutation()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'audit_logs, security_audit_logs, and inference_logs are INSERT-only (BR-004 / immutability). UPDATE and DELETE are prohibited at the database level.';
    END;
    $$ LANGUAGE plpgsql
  `);

  const auditTables = ['audit_logs', 'security_audit_logs', 'inference_logs'];
  for (const tbl of auditTables) {
    await query(`DROP TRIGGER IF EXISTS trg_block_update_${tbl.replace('_', '_')} ON ${tbl}`);
    await query(`DROP TRIGGER IF EXISTS trg_block_delete_${tbl.replace('_', '_')} ON ${tbl}`);
    await query(`CREATE TRIGGER trg_block_update_${tbl.replace('_', '_')} BEFORE UPDATE ON ${tbl} FOR EACH ROW EXECUTE FUNCTION block_audit_mutation()`);
    await query(`CREATE TRIGGER trg_block_delete_${tbl.replace('_', '_')} BEFORE DELETE ON ${tbl} FOR EACH ROW EXECUTE FUNCTION block_audit_mutation()`);
  }
}

async function down(query) {
  const auditTables = ['audit_logs', 'security_audit_logs', 'inference_logs'];
  for (const tbl of auditTables) {
    await query(`DROP TRIGGER IF EXISTS trg_block_update_${tbl.replace('_', '_')} ON ${tbl}`);
    await query(`DROP TRIGGER IF EXISTS trg_block_delete_${tbl.replace('_', '_')} ON ${tbl}`);
  }
  await query('DROP FUNCTION IF EXISTS block_audit_mutation');
  await query('DROP TABLE IF EXISTS role_permissions CASCADE');
  await query('DROP TABLE IF EXISTS permissions CASCADE');
  await query('DROP TABLE IF EXISTS refresh_tokens CASCADE');
  await query('ALTER TABLE users DROP COLUMN IF EXISTS password_changed_at');
  await query('ALTER TABLE users DROP COLUMN IF EXISTS deleted_at');
  await query('ALTER TABLE users DROP COLUMN IF EXISTS deactivated_at');
  await query('ALTER TABLE users DROP COLUMN IF EXISTS remember_me_token');
  await query('ALTER TABLE users DROP COLUMN IF EXISTS session_token');
}

export { up, down };

async function up(query) {
  await query(`
    CREATE TABLE IF NOT EXISTS system_settings (
      id SERIAL PRIMARY KEY,
      key VARCHAR(100) UNIQUE NOT NULL,
      value TEXT NOT NULL,
      type VARCHAR(10) NOT NULL DEFAULT 'string'
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS sla_config (
      id SERIAL PRIMARY KEY,
      priority VARCHAR(10) UNIQUE NOT NULL,
      response_minutes INTEGER NOT NULL,
      resolution_minutes INTEGER NOT NULL
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS ai_threshold_config (
      id SERIAL PRIMARY KEY,
      key VARCHAR(100) UNIQUE NOT NULL,
      value TEXT NOT NULL,
      description TEXT
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token VARCHAR(255) NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_pwreset_user ON password_reset_tokens(user_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_pwreset_token ON password_reset_tokens(token)');
}

async function down(query) {
  await query('DROP TABLE IF EXISTS password_reset_tokens CASCADE');
  await query('DROP TABLE IF EXISTS ai_threshold_config CASCADE');
  await query('DROP TABLE IF EXISTS sla_config CASCADE');
  await query('DROP TABLE IF EXISTS system_settings CASCADE');
}

export { up, down };

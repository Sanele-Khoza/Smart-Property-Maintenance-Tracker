async function up(query) {
  await query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      action VARCHAR(255) NOT NULL,
      user_id INTEGER,
      user_name VARCHAR(200),
      details TEXT,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS security_audit_logs (
      id SERIAL PRIMARY KEY,
      event_type VARCHAR(255) NOT NULL,
      user_id INTEGER,
      details TEXT,
      ip_address VARCHAR(45),
      severity VARCHAR(10) NOT NULL DEFAULT 'INFO',
      timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action)');
  await query('CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_logs(timestamp)');
  await query('CREATE INDEX IF NOT EXISTS idx_sec_audit_severity ON security_audit_logs(severity)');
  await query('CREATE INDEX IF NOT EXISTS idx_sec_audit_time ON security_audit_logs(timestamp)');
}

async function down(query) {
  await query('DROP TABLE IF EXISTS security_audit_logs CASCADE');
  await query('DROP TABLE IF EXISTS audit_logs CASCADE');
}

export { up, down };

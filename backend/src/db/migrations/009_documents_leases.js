async function up(query) {
  await query(`
    CREATE TABLE IF NOT EXISTS documents (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(50) NOT NULL,
      file_path TEXT,
      file_url TEXT,
      uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      description TEXT,
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS leases (
      id SERIAL PRIMARY KEY,
      unit_id INTEGER REFERENCES units(id) ON DELETE CASCADE,
      tenant_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      tenant_name VARCHAR(200),
      start_date DATE NOT NULL,
      end_date DATE,
      rent_amount FLOAT,
      deposit FLOAT,
      status VARCHAR(20) DEFAULT 'active',
      terms TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_docs_uploader ON documents(uploaded_by)');
  await query('CREATE INDEX IF NOT EXISTS idx_leases_unit ON leases(unit_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_leases_tenant ON leases(tenant_id)');
}

async function down(query) {
  await query('DROP TABLE IF EXISTS leases CASCADE');
  await query('DROP TABLE IF EXISTS documents CASCADE');
}

export { up, down };

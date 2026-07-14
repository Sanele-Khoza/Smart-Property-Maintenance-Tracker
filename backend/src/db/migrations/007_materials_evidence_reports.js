async function up(query) {
  await query(`
    CREATE TABLE IF NOT EXISTS materials (
      id SERIAL PRIMARY KEY,
      ticket_id INTEGER REFERENCES tickets(id) ON DELETE SET NULL,
      name VARCHAR(200) NOT NULL,
      quantity FLOAT DEFAULT 1,
      unit_cost FLOAT,
      provided_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS job_evidence (
      id SERIAL PRIMARY KEY,
      ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      provider_name VARCHAR(200),
      file_url TEXT NOT NULL,
      type VARCHAR(10) DEFAULT 'image',
      description TEXT,
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS completion_reports (
      id SERIAL PRIMARY KEY,
      ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      provider_name VARCHAR(200),
      description TEXT NOT NULL,
      materials_used TEXT,
      hours_worked FLOAT,
      notes TEXT,
      completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_materials_ticket ON materials(ticket_id)');
}

async function down(query) {
  await query('DROP TABLE IF EXISTS completion_reports CASCADE');
  await query('DROP TABLE IF EXISTS job_evidence CASCADE');
  await query('DROP TABLE IF EXISTS materials CASCADE');
}

export { up, down };

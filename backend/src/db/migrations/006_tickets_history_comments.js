async function up(query) {
  await query(`
    CREATE TABLE IF NOT EXISTS ticket_status_history (
      id SERIAL PRIMARY KEY,
      ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      status VARCHAR(30) NOT NULL,
      changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      changed_by_name VARCHAR(200),
      reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS ticket_comments (
      id SERIAL PRIMARY KEY,
      ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      comment TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_ticket_history ON ticket_status_history(ticket_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_ticket_comments ON ticket_comments(ticket_id)');
}

async function down(query) {
  await query('DROP TABLE IF EXISTS ticket_comments CASCADE');
  await query('DROP TABLE IF EXISTS ticket_status_history CASCADE');
}

export { up, down };

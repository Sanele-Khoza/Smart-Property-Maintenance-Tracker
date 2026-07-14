async function up(query) {
  await query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      recipient VARCHAR(255),
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(10) NOT NULL DEFAULT 'info',
      message TEXT NOT NULL,
      is_emergency BOOLEAN DEFAULT FALSE,
      delivery_status VARCHAR(10) DEFAULT 'Pending',
      read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS ratings (
      id SERIAL PRIMARY KEY,
      ticket_id INTEGER REFERENCES tickets(id) ON DELETE CASCADE,
      rated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      rating_value INTEGER NOT NULL,
      comment TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_notif_recipient ON notifications(recipient)');
  await query('CREATE INDEX IF NOT EXISTS idx_notif_read ON notifications(read)');
  await query('CREATE INDEX IF NOT EXISTS idx_ratings_ticket ON ratings(ticket_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_ratings_user ON ratings(rated_by)');
}

async function down(query) {
  await query('DROP TABLE IF EXISTS ratings CASCADE');
  await query('DROP TABLE IF EXISTS notifications CASCADE');
}

export { up, down };

async function up(query) {
  await query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subject VARCHAR(300) NOT NULL,
      body TEXT NOT NULL,
      category VARCHAR(50) DEFAULT 'general',
      read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_messages_read ON messages(read)');
}

async function down(query) {
  await query('DROP TABLE IF EXISTS messages CASCADE');
}

export { up, down };

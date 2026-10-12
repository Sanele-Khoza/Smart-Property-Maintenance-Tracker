async function up(query) {
  const typeRow = await query(
    `SELECT format_type(a.atttypid, a.atttypmod) AS coltype
     FROM pg_attribute a
     JOIN pg_class c ON c.oid = a.attrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
     WHERE c.relname = 'users' AND a.attname = 'id' AND NOT a.attisdropped`
  );
  const coltype = String(typeRow.rows[0]?.coltype || 'integer').toLowerCase();
  const userIdType = coltype.includes('uuid') ? 'UUID' : 'INTEGER';
  await query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      sender_id ${userIdType} NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      receiver_id ${userIdType} NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subject VARCHAR(300) NOT NULL,
      body TEXT NOT NULL,
      category VARCHAR(50) DEFAULT 'general',
      read BOOLEAN DEFAULT FALSE,
      is_popup BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_popup BOOLEAN DEFAULT FALSE`);
  await query(`CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_messages_read ON messages(read)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_messages_popup ON messages(receiver_id) WHERE is_popup = TRUE AND read = FALSE`);
}

async function down(query) {
  await query(`DROP INDEX IF EXISTS idx_messages_popup`);
  await query(`ALTER TABLE messages DROP COLUMN IF EXISTS is_popup`);
}

export { up, down };
async function up(query) {
  await query(`
    CREATE TABLE IF NOT EXISTS notification_channel_preferences (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      channel VARCHAR(20) NOT NULL CHECK (channel IN ('in_app', 'email', 'push')),
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, channel)
    )
  `);
}

async function down(query) {
  await query('DROP TABLE IF EXISTS notification_channel_preferences');
}

export { up, down };

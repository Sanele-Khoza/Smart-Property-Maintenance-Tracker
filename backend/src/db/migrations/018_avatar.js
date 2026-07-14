async function up(query) {
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500)`);
}

async function down(query) {
  await query(`ALTER TABLE users DROP COLUMN IF EXISTS avatar_url`);
}

export { up, down };

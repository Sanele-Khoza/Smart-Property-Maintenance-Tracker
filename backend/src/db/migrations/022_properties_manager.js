async function up(query) {
  await query(`
    ALTER TABLE properties ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES users(id) ON DELETE SET NULL
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_properties_manager ON properties(manager_id)');
}

async function down(query) {
  await query('DROP INDEX IF EXISTS idx_properties_manager');
  await query('ALTER TABLE properties DROP COLUMN IF EXISTS manager_id');
}

export { up, down };

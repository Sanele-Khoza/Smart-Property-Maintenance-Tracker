async function up(query) {
  await query(`
    ALTER TABLE service_providers ADD COLUMN IF NOT EXISTS location_name TEXT
  `);
}

async function down(query) {
  await query('ALTER TABLE service_providers DROP COLUMN IF EXISTS location_name');
}

export { up, down };
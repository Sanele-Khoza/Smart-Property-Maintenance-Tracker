async function up(query) {
  await query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS id_number VARCHAR(20)
  `);
  await query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS age INTEGER
  `);
}

async function down(query) {
  await query('ALTER TABLE users DROP COLUMN IF EXISTS age');
  await query('ALTER TABLE users DROP COLUMN IF EXISTS id_number');
}

export { up, down };

async function up(query) {
  await query(`
    ALTER TABLE tickets ADD COLUMN IF NOT EXISTS postponed_until TIMESTAMPTZ
  `);
  await query(`
    ALTER TABLE tickets ADD COLUMN IF NOT EXISTS postponed_reason TEXT
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_tickets_postponed_until ON tickets(postponed_until)');
}

async function down(query) {
  await query('DROP INDEX IF EXISTS idx_tickets_postponed_until');
  await query('ALTER TABLE tickets DROP COLUMN IF EXISTS postponed_reason');
  await query('ALTER TABLE tickets DROP COLUMN IF EXISTS postponed_until');
}

export { up, down };

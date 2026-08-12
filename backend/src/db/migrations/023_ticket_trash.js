async function up(query) {
  await query(`
    ALTER TABLE tickets ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ
  `);
  await query(`
    ALTER TABLE tickets ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) ON DELETE SET NULL
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_tickets_deleted_at ON tickets(deleted_at)');
}

async function down(query) {
  await query('DROP INDEX IF EXISTS idx_tickets_deleted_at');
  await query('ALTER TABLE tickets DROP COLUMN IF EXISTS deleted_by');
  await query('ALTER TABLE tickets DROP COLUMN IF EXISTS deleted_at');
}

export { up, down };

/**
 * Migration 033 — link notifications back to the ticket they're about.
 *
 * The `notifications` table (rebuilt in 015_sdd_schema.js) has no way to
 * know which ticket a notification refers to — just free-text title/body.
 * That's why a provider notification saying "Tap to accept or decline"
 * couldn't actually do either: there was nothing to act on.
 */

async function up(query) {
  await query(`
    ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_notifications_ticket ON notifications(ticket_id)
  `);
}

async function down(query) {
  await query('DROP INDEX IF EXISTS idx_notifications_ticket');
  await query('ALTER TABLE notifications DROP COLUMN IF EXISTS ticket_id');
}

export { up, down };

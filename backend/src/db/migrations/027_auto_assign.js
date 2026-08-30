/*
 * PROMPT 22 (v2) §4/§8 — full automatic assignment for every priority.
 *
 * - sla_config.auto_assign_minutes: per-priority delay before the system
 *   auto-assigns an unassigned, classification-finished ticket
 *   (backfilled from response_minutes so existing rows become active).
 * - tickets.auto_assigned / auto_assigned_at: UI + audit trail marking that
 *   the current assignment was made by the system rather than a person.
 * - tickets.no_provider_flagged_at: set when Section 3 filtering leaves zero
 *   eligible providers, so the scheduler stops retrying and the ticket is
 *   surfaced to managers (low_confidence_queue) instead of sitting silently.
 * - system_config.AUTO_ASSIGN_ENABLED: System Admin toggle for the whole
 *   feature (same admin-configurable pattern as AI_* thresholds).
 */
async function up(query) {
  await query(
    'ALTER TABLE sla_config ADD COLUMN IF NOT EXISTS auto_assign_minutes INTEGER'
  );
  await query(
    `UPDATE sla_config SET auto_assign_minutes = response_minutes
     WHERE auto_assign_minutes IS NULL`
  );

  await query(
    'ALTER TABLE tickets ADD COLUMN IF NOT EXISTS auto_assigned BOOLEAN NOT NULL DEFAULT FALSE'
  );
  await query(
    'ALTER TABLE tickets ADD COLUMN IF NOT EXISTS auto_assigned_at TIMESTAMPTZ'
  );
  await query(
    'ALTER TABLE tickets ADD COLUMN IF NOT EXISTS no_provider_flagged_at TIMESTAMPTZ'
  );

  await query(
    `INSERT INTO system_config (key, value, description) VALUES
       ('AUTO_ASSIGN_ENABLED', 'true', 'Enable automatic provider assignment for all priorities (Prompt 22 v2 §8)')
     ON CONFLICT (key) DO NOTHING`
  );
}

async function down(query) {
  await query('ALTER TABLE tickets DROP COLUMN IF EXISTS no_provider_flagged_at');
  await query('ALTER TABLE tickets DROP COLUMN IF EXISTS auto_assigned_at');
  await query('ALTER TABLE tickets DROP COLUMN IF EXISTS auto_assigned');
  await query('ALTER TABLE sla_config DROP COLUMN IF EXISTS auto_assign_minutes');
  await query("DELETE FROM system_config WHERE key = 'AUTO_ASSIGN_ENABLED'");
}

export { up, down };
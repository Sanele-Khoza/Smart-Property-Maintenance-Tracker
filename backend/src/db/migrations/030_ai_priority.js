/**
 * Migration 030 — AI priority intelligence columns.
 * Stores the AI-detected priority and whether it overrode the tenant's claim,
 * plus a human-readable reason (keyword/visual signal matched).
 */

export async function up(query) {
  await query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS ai_priority VARCHAR(10)`);
  await query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS ai_priority_overridden BOOLEAN NOT NULL DEFAULT FALSE`);
  await query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS ai_priority_reason TEXT`);
}

export async function down(query) {
  await query(`ALTER TABLE tickets DROP COLUMN IF EXISTS ai_priority_reason`);
  await query(`ALTER TABLE tickets DROP COLUMN IF EXISTS ai_priority_overridden`);
  await query(`ALTER TABLE tickets DROP COLUMN IF EXISTS ai_priority`);
}
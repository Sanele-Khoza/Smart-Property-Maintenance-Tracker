/**
 * Migration 029 — Convert auto-assign delay from minutes to seconds.
 *   EMERGENCY  → 5 seconds
 *   HIGH/MEDIUM/LOW → 20 seconds
 *
 * Drops auto_assign_minutes, adds auto_assign_seconds.
 */

export async function up(query) {
  await query(`ALTER TABLE sla_config DROP COLUMN IF EXISTS auto_assign_seconds`);
  await query(`ALTER TABLE sla_config ADD COLUMN auto_assign_seconds INTEGER NOT NULL DEFAULT 20`);

  await query(`UPDATE sla_config SET auto_assign_seconds = 5  WHERE priority = 'EMERGENCY'`);
  await query(`UPDATE sla_config SET auto_assign_seconds = 20 WHERE priority IN ('HIGH', 'MEDIUM', 'LOW')`);
}

export async function down(query) {
  await query(`ALTER TABLE sla_config DROP COLUMN IF EXISTS auto_assign_seconds`);
}

/**
 * Migration 031 — BR-001 database enforcement.
 * Unique partial index prevents a tenant from being assigned to
 * more than one occupied unit at the database level.
 */

export async function up(query) {
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_units_occupied_tenant_unique
    ON units (occupant_id)
    WHERE status = 'Occupied' AND occupant_id IS NOT NULL
  `);
}

export async function down(query) {
  await query('DROP INDEX IF EXISTS idx_units_occupied_tenant_unique');
}

/**
 * Migration 032 — enforce unit-number uniqueness per property.
 *
 * Existing duplicate data is deliberately left untouched (business
 * decision). A unique index cannot be created while duplicates exist, so
 * this migration checks first: if any are found, it logs a warning and
 * returns without creating the index — server startup is NOT affected.
 *
 * Because it doesn't throw, run()'s INSERT INTO _migrations still marks
 * this as "applied" even when skipped, so it will NOT auto-retry on a
 * later restart. If the duplicates are ever cleaned up, re-run this
 * migration manually (see note in units.service.js) or reset its row in
 * _migrations to make it retry.
 */

async function up(query) {
  const dupes = await query(`
    SELECT property_id, LOWER(TRIM(unit_number)) AS norm_number,
           ARRAY_AGG(id ORDER BY id) AS ids,
           ARRAY_AGG(unit_number ORDER BY id) AS unit_numbers
    FROM units
    GROUP BY property_id, LOWER(TRIM(unit_number))
    HAVING COUNT(*) > 1
  `);

  if (dupes.rows.length > 0) {
    const details = dupes.rows
      .map(r => `property ${r.property_id}: unit ids [${r.ids.join(', ')}] all named "${r.unit_numbers[0]}"`)
      .join('; ');
    console.warn(
      `[migration 032] Skipped creating unique index — existing duplicate unit numbers found (left untouched): ${details}. ` +
      `The application-level check in units.service.js already blocks new duplicates. ` +
      `To add this DB-level constraint later: resolve the duplicates above, then delete the ` +
      `'032_units_unique_constraint' row from the _migrations table and restart.`
    );
    return; // don't throw — server must still start
  }

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_units_property_number_unique
    ON units (property_id, LOWER(TRIM(unit_number)))
  `);
}

async function down(query) {
  await query('DROP INDEX IF EXISTS idx_units_property_number_unique');
}

export { up, down };
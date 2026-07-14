async function up(query) {
  await query(`
    CREATE TABLE IF NOT EXISTS units (
      id SERIAL PRIMARY KEY,
      property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      unit_number VARCHAR(20) NOT NULL,
      floor VARCHAR(10),
      type VARCHAR(30) DEFAULT '1-Bed',
      status VARCHAR(30) NOT NULL DEFAULT 'Vacant',
      bedrooms INTEGER DEFAULT 1,
      bathrooms INTEGER DEFAULT 1,
      size_sqm REAL,
      monthly_rent REAL,
      square_meters REAL,
      occupant_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_units_property ON units(property_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_units_occupant ON units(occupant_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_units_status ON units(status)');
}

async function down(query) {
  await query('DROP TABLE IF EXISTS units CASCADE');
}

export { up, down };

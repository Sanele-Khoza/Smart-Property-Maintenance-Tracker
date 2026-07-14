async function up(query) {
  await query(`
    CREATE TABLE IF NOT EXISTS technicians (
      id SERIAL PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      company_name VARCHAR(200),
      email VARCHAR(255),
      phone VARCHAR(20),
      specialisations JSONB DEFAULT '[]',
      rating FLOAT DEFAULT 0,
      current_workload INTEGER DEFAULT 0,
      total_jobs_completed INTEGER DEFAULT 0,
      availability_status VARCHAR(20) DEFAULT 'AVAILABLE',
      gps_latitude FLOAT,
      gps_longitude FLOAT,
      last_location_update TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS availability_slots (
      id SERIAL PRIMARY KEY,
      technician_id INTEGER NOT NULL REFERENCES technicians(id) ON DELETE CASCADE,
      day_of_week INTEGER NOT NULL,
      start_time VARCHAR(5) NOT NULL,
      end_time VARCHAR(5) NOT NULL
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_technicians_status ON technicians(availability_status)');
  await query('CREATE INDEX IF NOT EXISTS idx_avail_tech ON availability_slots(technician_id)');
}

async function down(query) {
  await query('DROP TABLE IF EXISTS availability_slots CASCADE');
  await query('DROP TABLE IF EXISTS technicians CASCADE');
}

export { up, down };

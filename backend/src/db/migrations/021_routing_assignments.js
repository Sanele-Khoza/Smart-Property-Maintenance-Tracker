async function up(query) {
  await query(`
    CREATE TABLE IF NOT EXISTS routing_assignments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      provider_id UUID NOT NULL REFERENCES service_providers(id) ON DELETE CASCADE,
      assignment_type VARCHAR(20) NOT NULL CHECK (assignment_type IN ('emergency', 'auto', 'manual')),
      status VARCHAR(20) NOT NULL DEFAULT 'offered' CHECK (status IN ('offered', 'accepted', 'declined', 'expired', 'assigned')),
      score_data JSONB DEFAULT '{}',
      offered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      responded_at TIMESTAMPTZ,
      accepted_by UUID REFERENCES users(id) ON DELETE SET NULL,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_ra_ticket ON routing_assignments(ticket_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_ra_provider ON routing_assignments(provider_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_ra_status ON routing_assignments(status)');

  await query(`
    CREATE TABLE IF NOT EXISTS provider_availability (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      provider_id UUID UNIQUE NOT NULL REFERENCES service_providers(id) ON DELETE CASCADE,
      is_available BOOLEAN NOT NULL DEFAULT TRUE,
      auto_accept BOOLEAN NOT NULL DEFAULT FALSE,
      max_concurrent_jobs INTEGER NOT NULL DEFAULT 5,
      current_jobs INTEGER NOT NULL DEFAULT 0,
      last_heartbeat TIMESTAMPTZ,
      preferred_radius_km INTEGER DEFAULT 50,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_pa_avail ON provider_availability(is_available)');
}

async function down(query) {
  await query('DROP TABLE IF EXISTS provider_availability CASCADE');
  await query('DROP TABLE IF EXISTS routing_assignments CASCADE');
}

export { up, down };

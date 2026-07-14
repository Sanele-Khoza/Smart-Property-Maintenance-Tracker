async function up(query) {
  /* ── 1. leases ── */
  await query(`
    CREATE TABLE IF NOT EXISTS leases (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
      tenant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      monthly_rent DECIMAL(10,2) NOT NULL,
      deposit DECIMAL(10,2) DEFAULT 0,
      status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT chk_lease_dates CHECK (end_date > start_date)
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_leases_unit ON leases(unit_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_leases_tenant ON leases(tenant_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_leases_status ON leases(status)');

  /* ── 2. invoices ── */
  await query(`
    CREATE TABLE IF NOT EXISTS invoices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
      invoice_number VARCHAR(50) UNIQUE NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      due_date DATE NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'UNPAID',
      description TEXT,
      line_items JSONB DEFAULT '[]',
      paid_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status)');
  await query('CREATE INDEX IF NOT EXISTS idx_invoices_due ON invoices(due_date)');

  /* ── 3. payments ── */
  await query(`
    CREATE TABLE IF NOT EXISTS payments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      amount DECIMAL(10,2) NOT NULL,
      payment_method VARCHAR(30) NOT NULL DEFAULT 'CARD',
      reference VARCHAR(100),
      status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
      paid_at TIMESTAMPTZ,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id)');

  /* ── 4. calendar_events ── */
  await query(`
    CREATE TABLE IF NOT EXISTS calendar_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(255) NOT NULL,
      description TEXT,
      event_type VARCHAR(30) NOT NULL DEFAULT 'GENERAL',
      start_time TIMESTAMPTZ NOT NULL,
      end_time TIMESTAMPTZ,
      all_day BOOLEAN DEFAULT FALSE,
      related_to_type VARCHAR(30),
      related_to_id UUID,
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_events_time ON calendar_events(start_time, end_time)');
  await query('CREATE INDEX IF NOT EXISTS idx_events_type ON calendar_events(event_type)');
  await query('CREATE INDEX IF NOT EXISTS idx_events_created_by ON calendar_events(created_by)');
}

async function down(query) {
  await query('DROP TABLE IF EXISTS payments CASCADE');
  await query('DROP TABLE IF EXISTS invoices CASCADE');
  await query('DROP TABLE IF EXISTS leases CASCADE');
  await query('DROP TABLE IF EXISTS calendar_events CASCADE');
}

export { up, down };

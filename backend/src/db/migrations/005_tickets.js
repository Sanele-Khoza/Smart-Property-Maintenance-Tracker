async function up(query) {
  await query(`
    CREATE TABLE IF NOT EXISTS tickets (
      id SERIAL PRIMARY KEY,
      property_id INTEGER REFERENCES properties(id) ON DELETE SET NULL,
      unit_id INTEGER REFERENCES units(id) ON DELETE SET NULL,
      tenant_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      category_name VARCHAR(100),
      category_icon VARCHAR(10),
      category_color VARCHAR(10),
      assigned_to_id INTEGER REFERENCES technicians(id) ON DELETE SET NULL,
      assigned_to_name VARCHAR(200),
      title VARCHAR(300) NOT NULL,
      description TEXT NOT NULL,
      priority VARCHAR(10) NOT NULL DEFAULT 'MEDIUM',
      status VARCHAR(30) NOT NULL DEFAULT 'Open',
      source VARCHAR(20) DEFAULT 'tenant_portal',
      tenant_rating INTEGER,
      sla_breached BOOLEAN DEFAULT FALSE,
      ai_classification JSONB,
      conflict_detected BOOLEAN DEFAULT FALSE,
      manual_review_required BOOLEAN DEFAULT FALSE,
      due_date TIMESTAMPTZ,
      created_by_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status)');
  await query('CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority)');
  await query('CREATE INDEX IF NOT EXISTS idx_tickets_tenant ON tickets(tenant_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_tickets_assigned ON tickets(assigned_to_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_tickets_property ON tickets(property_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_tickets_unit ON tickets(unit_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_tickets_date ON tickets(created_by_date)');
}

async function down(query) {
  await query('DROP TABLE IF EXISTS tickets CASCADE');
}

export { up, down };

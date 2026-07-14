async function up(query) {
  /* ── Drop all old tables (reverse dependency order) ── */
  const oldTables = [
    'password_reset_tokens', 'role_permissions', 'permissions', 'refresh_tokens',
    'messages', 'leases', 'documents', 'completion_reports', 'job_evidence',
    'materials', 'ticket_comments', 'ticket_status_history', 'availability_slots',
    'technicians', 'inference_logs', 'security_audit_logs', 'audit_logs',
    'performance_ratings', 'notifications', 'sla_config', 'ai_threshold_config',
    'system_settings', 'ticket_attachments', 'ai_inference_log', 'tickets',
    'categories', 'units', 'service_providers', 'properties', 'users',
    'system_config',
    /* SDD singular names — may exist from a previous 015 run */
    'audit_log', 'security_audit_log',
  ];
  for (const t of oldTables) {
    await query(`DROP TABLE IF EXISTS ${t} CASCADE`);
  }
  await query('DROP FUNCTION IF EXISTS block_audit_mutation CASCADE');
  /* DON'T drop _migrations */

  /* ── 1. users ── */
  await query(`
    CREATE TABLE users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(100) NOT NULL,
      surname VARCHAR(100) NOT NULL DEFAULT '',
      phone VARCHAR(20),
      role VARCHAR(20) NOT NULL DEFAULT 'TENANT',
      status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
      approved BOOLEAN DEFAULT FALSE,
      approved_at TIMESTAMPTZ,
      last_login TIMESTAMPTZ,
      email_verification_token VARCHAR(255),
      password_reset_token VARCHAR(255),
      password_reset_expiry TIMESTAMPTZ,
      login_attempts INTEGER DEFAULT 0,
      locked_until TIMESTAMPTZ,
      password_changed_at TIMESTAMPTZ,
      deleted_at TIMESTAMPTZ,
      deactivated_at TIMESTAMPTZ,
      remember_me_token VARCHAR(255),
      session_token VARCHAR(255),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
  await query('CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)');
  await query('CREATE INDEX IF NOT EXISTS idx_users_status ON users(status)');

  /* ── 2. properties ── */
  await query(`
    CREATE TABLE properties (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(200) NOT NULL,
      address TEXT NOT NULL,
      type VARCHAR(20) NOT NULL DEFAULT 'Residential',
      status VARCHAR(30) NOT NULL DEFAULT 'Active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  /* ── 3. service_providers ── (created BEFORE tickets) */
  await query(`
    CREATE TABLE service_providers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(200) NOT NULL,
      company_name VARCHAR(200),
      email VARCHAR(255),
      phone VARCHAR(20),
      specialisations TEXT[] DEFAULT '{}',
      rating FLOAT DEFAULT 0,
      current_workload INTEGER DEFAULT 0,
      status VARCHAR(20) DEFAULT 'AVAILABLE',
      gps_location POINT,
      last_location_update TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  /* ── 4. units ── */
  await query(`
    CREATE TABLE units (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      unit_number VARCHAR(20) NOT NULL,
      floor VARCHAR(10),
      type VARCHAR(30) DEFAULT '1-Bed',
      bedrooms INTEGER DEFAULT 1,
      bathrooms INTEGER DEFAULT 1,
      size_sqm REAL,
      status VARCHAR(30) NOT NULL DEFAULT 'Vacant',
      occupant_id UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_units_property ON units(property_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_units_occupant ON units(occupant_id)');

  /* ── 5. tickets ── */
  await query(`
    CREATE TABLE tickets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
      tenant_id UUID REFERENCES users(id) ON DELETE SET NULL,
      category VARCHAR(100) NOT NULL,
      title VARCHAR(300) NOT NULL,
      description TEXT NOT NULL CHECK (char_length(description) >= 20),
      priority VARCHAR(10) NOT NULL DEFAULT 'MEDIUM',
      status VARCHAR(30) NOT NULL DEFAULT 'Open',
      assigned_to UUID REFERENCES service_providers(id) ON DELETE SET NULL,
      ai_text_label VARCHAR(100),
      ai_visual_label VARCHAR(100),
      conflict_detected BOOLEAN DEFAULT FALSE,
      source VARCHAR(20) DEFAULT 'tenant_portal',
      due_date TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status)');
  await query('CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority)');
  await query('CREATE INDEX IF NOT EXISTS idx_tickets_tenant ON tickets(tenant_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_tickets_assigned ON tickets(assigned_to)');
  await query('CREATE INDEX IF NOT EXISTS idx_tickets_unit ON tickets(unit_id)');

  /* ── 6. ticket_attachments ── */
  await query(`
    CREATE TABLE ticket_attachments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      file_key TEXT NOT NULL,
      file_type VARCHAR(50) NOT NULL,
      uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_attach_ticket ON ticket_attachments(ticket_id)');

  /* ── 7. ai_inference_log (INSERT-ONLY) ── */
  await query(`
    CREATE TABLE ai_inference_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
      service VARCHAR(20) NOT NULL,
      text_result TEXT,
      visual_result TEXT,
      text_confidence FLOAT,
      visual_confidence FLOAT,
      arbitrated_label VARCHAR(100),
      conflict_detected BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_ai_inference_ticket ON ai_inference_log(ticket_id)');

  /* ── 8. audit_log (INSERT-ONLY) ── */
  await query(`
    CREATE TABLE audit_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      action VARCHAR(255) NOT NULL,
      performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
      target_type VARCHAR(50),
      target_id VARCHAR(255),
      details TEXT,
      ip_address VARCHAR(45),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action)');
  await query('CREATE INDEX IF NOT EXISTS idx_audit_performed ON audit_log(performed_by)');
  await query('CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at)');

  /* ── 9. notifications ── */
  await query(`
    CREATE TABLE notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(20) NOT NULL DEFAULT 'info',
      title VARCHAR(255),
      body TEXT NOT NULL,
      is_emergency BOOLEAN DEFAULT FALSE,
      delivery_status VARCHAR(20) DEFAULT 'Pending',
      read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id)');

  /* ── 10. performance_ratings ── */
  await query(`
    CREATE TABLE performance_ratings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ticket_id UUID UNIQUE REFERENCES tickets(id) ON DELETE CASCADE,
      rated_by UUID REFERENCES users(id) ON DELETE SET NULL,
      rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
      comment TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_perf_rating_ticket ON performance_ratings(ticket_id)');

  /* ── 11. sla_config ── */
  await query(`
    CREATE TABLE sla_config (
      priority VARCHAR(10) PRIMARY KEY,
      response_minutes INTEGER NOT NULL,
      resolution_minutes INTEGER NOT NULL
    )
  `);

  /* ── 12. security_audit_log (INSERT-ONLY) ── */
  await query(`
    CREATE TABLE security_audit_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      event_type VARCHAR(255) NOT NULL,
      details TEXT,
      ip_address VARCHAR(45),
      severity VARCHAR(10) NOT NULL DEFAULT 'INFO',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_sec_audit_severity ON security_audit_log(severity)');
  await query('CREATE INDEX IF NOT EXISTS idx_sec_audit_created ON security_audit_log(created_at)');

  /* ── Auth tables ── */
  await query(`
    CREATE TABLE refresh_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token VARCHAR(255) UNIQUE NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      revoked BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens(user_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_refresh_token ON refresh_tokens(token)');

  await query(`
    CREATE TABLE permissions (
      id VARCHAR(100) PRIMARY KEY,
      label VARCHAR(255) NOT NULL,
      "group" VARCHAR(50) NOT NULL
    )
  `);

  await query(`
    CREATE TABLE role_permissions (
      role VARCHAR(20) NOT NULL,
      permission_id VARCHAR(100) NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
      PRIMARY KEY (role, permission_id)
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_rp_role ON role_permissions(role)');

  /* ── system_config (SDD §5 thresholds) ── */
  await query(`
    CREATE TABLE system_config (
      key VARCHAR(100) PRIMARY KEY,
      value TEXT NOT NULL,
      description TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  /* ── BR-004: INSERT-only triggers ── */
  await query(`
    CREATE OR REPLACE FUNCTION block_audit_mutation()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION
        'audit_log, security_audit_log, and ai_inference_log are INSERT-only (BR-004 / immutability). UPDATE and DELETE are prohibited at the database level.';
    END;
    $$ LANGUAGE plpgsql
  `);

  const immutableTables = ['audit_log', 'security_audit_log', 'ai_inference_log'];
  for (const tbl of immutableTables) {
    await query(`DROP TRIGGER IF EXISTS trg_block_update_${tbl} ON ${tbl}`);
    await query(`DROP TRIGGER IF EXISTS trg_block_delete_${tbl} ON ${tbl}`);
    await query(`CREATE TRIGGER trg_block_update_${tbl} BEFORE UPDATE ON ${tbl} FOR EACH ROW EXECUTE FUNCTION block_audit_mutation()`);
    await query(`CREATE TRIGGER trg_block_delete_${tbl} BEFORE DELETE ON ${tbl} FOR EACH ROW EXECUTE FUNCTION block_audit_mutation()`);
  }
}

async function down(query) {
  const tables = [
    'refresh_tokens', 'role_permissions', 'permissions', 'system_config',
    'security_audit_log', 'sla_config', 'performance_ratings', 'notifications',
    'audit_log', 'ai_inference_log', 'ticket_attachments', 'tickets',
    'units', 'service_providers', 'properties', 'users',
  ];
  for (const t of tables) {
    await query(`DROP TABLE IF EXISTS ${t} CASCADE`);
  }
  await query('DROP FUNCTION IF EXISTS block_audit_mutation CASCADE');
}

export { up, down };

async function up(query) {
  /* BR-001: unique occupant_id so one tenant per unit */
  await query(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_units_occupant_unique ON units(occupant_id) WHERE occupant_id IS NOT NULL'
  );

  /* ticket_status_history — needed by BR-004 for state tracking */
  await query(`
    CREATE TABLE IF NOT EXISTS ticket_status_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      status VARCHAR(30) NOT NULL,
      changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
      changed_by_name VARCHAR(200),
      reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_tsh_ticket ON ticket_status_history(ticket_id)');

  /* ticket_comments — referenced by repository */
  await query(`
    CREATE TABLE IF NOT EXISTS ticket_comments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      comment TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_tc_ticket ON ticket_comments(ticket_id)');

  /* BR-004: INSERT-only triggers on ticket audit tables */
  const immutableTicketTables = ['ticket_status_history', 'performance_ratings', 'ticket_attachments'];
  for (const tbl of immutableTicketTables) {
    await query(`DROP TRIGGER IF EXISTS trg_block_update_${tbl} ON ${tbl}`);
    await query(`DROP TRIGGER IF EXISTS trg_block_delete_${tbl} ON ${tbl}`);
    await query(`
      CREATE OR REPLACE FUNCTION block_ticket_mutation_${tbl}()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION '${tbl} is INSERT-only. UPDATE and DELETE are prohibited.';
      END;
      $$ LANGUAGE plpgsql
    `);
    await query(`
      CREATE TRIGGER trg_block_update_${tbl}
      BEFORE UPDATE ON ${tbl} FOR EACH ROW EXECUTE FUNCTION block_ticket_mutation_${tbl}()
    `);
    await query(`
      CREATE TRIGGER trg_block_delete_${tbl}
      BEFORE DELETE ON ${tbl} FOR EACH ROW EXECUTE FUNCTION block_ticket_mutation_${tbl}()
    `);
  }

  /* Add AI confidence columns (code uses these but SDD schema doesn't have them) */
  const confCols = await query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'ai_text_confidence'`
  );
  if (confCols.rows.length === 0) {
    await query(`ALTER TABLE tickets ADD COLUMN ai_text_confidence REAL`);
    await query(`ALTER TABLE tickets ADD COLUMN ai_visual_confidence REAL`);
  }

  /* BR-006: AI override tracking — store original + corrected label */
  const ticketCols = await query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'ai_original_label'`
  );
  if (ticketCols.rows.length === 0) {
    await query(`ALTER TABLE tickets ADD COLUMN ai_original_label VARCHAR(100)`);
    await query(`ALTER TABLE tickets ADD COLUMN ai_corrected_label VARCHAR(100)`);
    await query(`ALTER TABLE tickets ADD COLUMN ai_overridden_by UUID REFERENCES users(id) ON DELETE SET NULL`);
    await query(`ALTER TABLE tickets ADD COLUMN ai_overridden_at TIMESTAMPTZ`);
  }

  /* BR-009: visual_emergency flag */
  const visCols = await query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'visual_emergency'`
  );
  if (visCols.rows.length === 0) {
    await query(`ALTER TABLE tickets ADD COLUMN visual_emergency BOOLEAN DEFAULT FALSE`);
    await query(`ALTER TABLE tickets ADD COLUMN visual_emergency_escalated_by VARCHAR(20)`);
    await query(`ALTER TABLE tickets ADD COLUMN visual_emergency_downgraded_at TIMESTAMPTZ`);
    await query(`ALTER TABLE tickets ADD COLUMN visual_emergency_downgraded_by UUID REFERENCES users(id) ON DELETE SET NULL`);
  }

  /* BR-010: pm_confirmed flag */
  const pmCols = await query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'pm_confirmed'`
  );
  if (pmCols.rows.length === 0) {
    await query(`ALTER TABLE tickets ADD COLUMN pm_confirmed BOOLEAN DEFAULT FALSE`);
    await query(`ALTER TABLE tickets ADD COLUMN pm_confirmed_by UUID REFERENCES users(id) ON DELETE SET NULL`);
    await query(`ALTER TABLE tickets ADD COLUMN pm_confirmed_at TIMESTAMPTZ`);
  }

  /* BR-003: emergency_assigned_at + sla_breached columns */
  const slaCols = await query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'emergency_assigned_at'`
  );
  if (slaCols.rows.length === 0) {
    await query(`ALTER TABLE tickets ADD COLUMN emergency_assigned_at TIMESTAMPTZ`);
    await query(`ALTER TABLE tickets ADD COLUMN sla_breached BOOLEAN DEFAULT FALSE`);
    await query(`ALTER TABLE tickets ADD COLUMN sla_breached_at TIMESTAMPTZ`);
  }

  /* SLA seed (SRS §4.1.5) */
  const slaExists = await query(`SELECT COUNT(*)::int AS cnt FROM sla_config`);
  if (slaExists.rows[0].cnt === 0) {
    await query(`INSERT INTO sla_config (priority, response_minutes, resolution_minutes) VALUES
      ('EMERGENCY', 30, 240),
      ('HIGH', 240, 1440),
      ('MEDIUM', 1440, 4320),
      ('LOW', 4320, 10080)
    `);
  }

  /* BR-005: Add Rejected state to ticket status choices if needed
     (already handled at app level via ticketStates.js transitions) */
}

async function down(query) {
  await query('DROP INDEX IF EXISTS idx_units_occupant_unique');
  for (const tbl of ['ticket_status_history', 'performance_ratings', 'ticket_attachments']) {
    await query(`DROP TRIGGER IF EXISTS trg_block_update_${tbl} ON ${tbl}`);
    await query(`DROP TRIGGER IF EXISTS trg_block_delete_${tbl} ON ${tbl}`);
    await query(`DROP FUNCTION IF EXISTS block_ticket_mutation_${tbl}`);
  }
  await query('DROP TABLE IF EXISTS ticket_comments CASCADE');
  await query('DROP TABLE IF EXISTS ticket_status_history CASCADE');
}

export { up, down };

async function up(query) {
  const colCheck = await query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'entity_tags'`
  );
  if (colCheck.rows.length === 0) {
    await query(`ALTER TABLE tickets ADD COLUMN entity_tags JSONB DEFAULT '[]'::jsonb`);
    await query(`ALTER TABLE tickets ADD COLUMN duplicate_group_id UUID`);
    await query(`ALTER TABLE tickets ADD COLUMN ai_confidence REAL`);
    await query(`ALTER TABLE tickets ADD COLUMN ai_category VARCHAR(100)`);
  }

  await query(`
    CREATE TABLE IF NOT EXISTS ai_entity_tags (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('location', 'item', 'issue')),
      value VARCHAR(100) NOT NULL,
      confidence REAL DEFAULT 1.0,
      source VARCHAR(20) NOT NULL DEFAULT 'comprehend',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_aet_ticket ON ai_entity_tags(ticket_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_aet_type ON ai_entity_tags(entity_type)');

  await query(`
    CREATE TABLE IF NOT EXISTS low_confidence_queue (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ticket_id UUID UNIQUE NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      text_confidence REAL,
      visual_confidence REAL,
      combined_confidence REAL NOT NULL,
      reason VARCHAR(255) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
      reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
      reviewed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_lcq_status ON low_confidence_queue(status)');
  await query('CREATE INDEX IF NOT EXISTS idx_lcq_created ON low_confidence_queue(created_at)');

  await query(`
    CREATE TABLE IF NOT EXISTS duplicate_ticket_suggestions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      duplicate_ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      similarity_score REAL NOT NULL CHECK (similarity_score >= 0 AND similarity_score <= 1),
      match_reason TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'dismissed')),
      confirmed_by UUID REFERENCES users(id) ON DELETE SET NULL,
      confirmed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(ticket_id, duplicate_ticket_id)
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_dts_ticket ON duplicate_ticket_suggestions(ticket_id)');
  await query('CREATE INDEX IF NOT EXISTS idx_dts_dup ON duplicate_ticket_suggestions(duplicate_ticket_id)');
}

async function down(query) {
  await query('DROP TABLE IF EXISTS duplicate_ticket_suggestions CASCADE');
  await query('DROP TABLE IF EXISTS low_confidence_queue CASCADE');
  await query('DROP TABLE IF EXISTS ai_entity_tags CASCADE');
}

export { up, down };

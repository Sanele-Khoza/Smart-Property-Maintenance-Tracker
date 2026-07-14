async function up(query) {
  await query(`
    CREATE TABLE IF NOT EXISTS inference_logs (
      id SERIAL PRIMARY KEY,
      ticket_id INTEGER REFERENCES tickets(id) ON DELETE CASCADE,
      service VARCHAR(20) NOT NULL,
      type VARCHAR(10) NOT NULL,
      result TEXT,
      confidence FLOAT,
      conflict_detected BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_inference_ticket ON inference_logs(ticket_id)');
}

async function down(query) {
  await query('DROP TABLE IF EXISTS inference_logs CASCADE');
}

export { up, down };

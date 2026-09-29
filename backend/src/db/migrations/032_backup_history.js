/**
 * Migration 032 — backup history tracking.
 * Records every pg_dump backup (manual or scheduled): where it was written,
 * its size, integrity hash, verification state and any error.
 */

export async function up(query) {
  await query(`
    CREATE TABLE IF NOT EXISTS backup_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      filename TEXT NOT NULL,
      backup_path TEXT NOT NULL,
      backup_type VARCHAR(20) NOT NULL DEFAULT 'MANUAL'
        CHECK (backup_type IN ('MANUAL', 'SCHEDULED')),
      status VARCHAR(20) NOT NULL DEFAULT 'RUNNING'
        CHECK (status IN ('RUNNING', 'SUCCESS', 'FAILED')),
      size_bytes BIGINT,
      sha256 VARCHAR(64),
      verified BOOLEAN DEFAULT FALSE,
      error_message TEXT,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ,
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query('CREATE INDEX IF NOT EXISTS idx_backup_history_created ON backup_history(created_at DESC)');
  await query('CREATE INDEX IF NOT EXISTS idx_backup_history_status ON backup_history(status)');
}

export async function down(query) {
  await query('DROP TABLE IF EXISTS backup_history CASCADE');
}
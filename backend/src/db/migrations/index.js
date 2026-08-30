import logger from '../../shared/utils/logger.js';

async function run(query) {
  logger.info('Running migrations...');

  const migrations = [
    { name: '001_users', file: '001_users.js' },
    { name: '002_properties_categories', file: '002_properties_categories.js' },
    { name: '003_units', file: '003_units.js' },
    { name: '004_technicians_availability', file: '004_technicians_availability.js' },
    { name: '005_tickets', file: '005_tickets.js' },
    { name: '006_tickets_history_comments', file: '006_tickets_history_comments.js' },
    { name: '007_materials_evidence_reports', file: '007_materials_evidence_reports.js' },
    { name: '008_notifications_ratings', file: '008_notifications_ratings.js' },
    { name: '009_documents_leases', file: '009_documents_leases.js' },
    { name: '010_messages', file: '010_messages.js' },
    { name: '011_settings_sla_thresholds', file: '011_settings_sla_thresholds.js' },
    { name: '012_audit_logs', file: '012_audit_logs.js' },
    { name: '013_inference_logs', file: '013_inference_logs.js' },
    { name: '014_auth_features', file: '014_auth_features.js' },
    { name: '015_sdd_schema', file: '015_sdd_schema.js' },
    { name: '016_feature_tables', file: '016_feature_tables.js' },
    { name: '017_br_rules', file: '017_br_rules.js' },
    { name: '018_avatar', file: '018_avatar.js' },
    { name: '019_notification_preferences', file: '019_notification_preferences.js' },
    { name: '020_ai_entity_queue', file: '020_ai_entity_queue.js' },
    { name: '021_routing_assignments', file: '021_routing_assignments.js' },
    { name: '022_properties_manager', file: '022_properties_manager.js' },
    { name: '023_ticket_trash', file: '023_ticket_trash.js' },
    { name: '024_provider_rating_sync', file: '024_provider_rating_sync.js' },
    { name: '025_decline_postpone', file: '025_decline_postpone.js' },
    { name: '026_users_id_number', file: '026_users_id_number.js' },
    { name: '027_auto_assign', file: '027_auto_assign.js' },
  ];

  await query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name VARCHAR(255) PRIMARY KEY,
      run_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  for (const m of migrations) {
    const exists = await query('SELECT 1 FROM _migrations WHERE name = $1', [m.name]);
    if (exists.rows.length > 0) {
      logger.info(`Migration ${m.name} already applied, skipping`);
      continue;
    }
    logger.info(`Running migration: ${m.name}`);
    const { up } = await import(`./${m.file}`);
    await up(query);
    await query('INSERT INTO _migrations (name) VALUES ($1)', [m.name]);
    logger.info(`Migration ${m.name} complete`);
  }

  logger.info('All migrations complete');
}

export { run };

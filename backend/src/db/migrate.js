import logger from '../shared/utils/logger.js';
import { query } from './connection.js';
import { run as runMigrations } from './migrations/index.js';
import { seed } from './seeds/index.js';

async function migrate() {
  try {
    await query('SELECT 1');
    logger.info('PostgreSQL connected');

    await runMigrations(query);
    await seed(query);

    logger.info('Migrations + seed complete');
    process.exit(0);
  } catch (err) {
    logger.error('Migration failed', {
      error: err.message,
      stack: err.stack,
    });
    process.exit(1);
  }
}

migrate();

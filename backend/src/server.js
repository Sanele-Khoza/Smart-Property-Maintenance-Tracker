import app from './app.js';
import config from './config/index.js';
import logger from './shared/utils/logger.js';
import { query } from './db/connection.js';
import { run as runMigrations } from './db/migrations/index.js';
import { seed } from './db/seeds/index.js';
import { start as startSlaWorker } from './modules/ai/slaWorker.js';

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection', { error: reason?.message || reason, stack: reason?.stack });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', { error: err.message, stack: err.stack });
  process.exit(1);
});

async function start() {
  try {
    await query('SELECT 1');
    logger.info('PostgreSQL connected');

    await runMigrations(query);
    await seed(query);

    startSlaWorker();

    app.listen(config.port, () => {
      logger.info(`SPMT API running on port ${config.port} (${config.nodeEnv})`);
    });
  } catch (err) {
    logger.error('Failed to start server', { error: err.message, stack: err.stack });
    process.exit(1);
  }
}

start();

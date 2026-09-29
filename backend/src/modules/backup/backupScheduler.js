import cron from 'node-cron';
import config from '../../config/index.js';
import logger from '../../shared/utils/logger.js';
import { createBackup, reconcileStaleBackups } from './backup.service.js';

let task = null;

function timezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

async function start() {
  reconcileStaleBackups();
  if (!config.backup.scheduleEnabled) {
    logger.info('Scheduled backups are disabled (BACKUP_SCHEDULE_ENABLED=false)');
    return;
  }
  const expr = config.backup.scheduleCron;
  if (!expr || !cron.validate(expr)) {
    logger.error(`Invalid BACKUP_SCHEDULE_CRON '${expr}' — scheduled backups disabled`);
    return;
  }
  task = cron.schedule(
    expr,
    () => {
      logger.info('Running scheduled backup…');
      createBackup({ type: 'SCHEDULED' }).catch((err) => {
        logger.error(`Scheduled backup failed: ${err.message}`);
      });
    },
    { timezone: timezone() }
  );
  logger.info(`Scheduled backups enabled: cron '${expr}' (${timezone() || 'server tz'})`);
}

function stop() {
  if (task) {
    task.stop();
    task = null;
  }
}

export { start, stop };
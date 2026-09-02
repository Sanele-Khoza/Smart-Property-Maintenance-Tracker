import logger from '../../shared/utils/logger.js';
import { autoAssignTickets, markSlaBreaches } from '../../shared/utils/emergencyScheduler.js';
import { markBreachedTickets } from '../../shared/utils/slaChecker.js';
import { query } from '../../db/connection.js';

let intervalId = null;

async function checkSla() {
  try {
    /* PROMPT 22 (v2) §4 — auto-assign every priority past its per-priority delay */
    const result = await autoAssignTickets();
    if (result.assigned > 0) {
      logger.info(`Auto-assigned ${result.assigned} ticket(s) (scanned ${result.scanned})`);
    }

    /* Mark SLA breaches across all priorities */
    await markBreachedTickets();

    /* Notify tenants of breached tickets */
    const breachedTickets = await query(
      `SELECT t.*, u.name, u.surname FROM tickets t
       JOIN users u ON u.id = t.tenant_id
       WHERE t.sla_breached = TRUE AND t.deleted_at IS NULL AND t.sla_breached_at > NOW() - INTERVAL '2 minutes'`
    );

    for (const ticket of breachedTickets.rows) {
      await query(
        `INSERT INTO notifications (user_id, type, title, body, is_emergency)
         VALUES ($1, 'warning', 'SLA Breached', $2, TRUE)`,
        [ticket.tenant_id, `Ticket #${ticket.id}: ${ticket.title} has exceeded the resolution SLA.`]
      );
      logger.warn(`SLA breached notification sent for ticket #${ticket.id}`);
    }
  } catch (err) {
    logger.error('SLA worker error', { error: err.message });
  }
}

function start() {
  if (intervalId) return;
  logger.info('SLA worker started (auto-assign every 5s, SLA breach every 2 min)');
  checkSla();
  intervalId = setInterval(checkSla, 5 * 1000);
}

function stop() {
  if (intervalId) { clearInterval(intervalId); intervalId = null; logger.info('SLA worker stopped'); }
}

export { start, stop };

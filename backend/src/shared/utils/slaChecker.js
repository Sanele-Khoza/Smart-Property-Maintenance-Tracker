import { query } from '../../db/connection.js';

const SLA_WARNING_THRESHOLD = 0.75;

/**
 * Load SLA config from database (SRS §4.1.5)
 * @returns {Object} { EMERGENCY: {responseMinutes, resolutionMinutes}, ... }
 */
async function loadSlaConfig() {
  const result = await query('SELECT * FROM sla_config');
  const config = {};
  for (const row of result.rows) {
    config[row.priority] = {
      responseMinutes: row.response_minutes,
      resolutionMinutes: row.resolution_minutes,
    };
  }
  return config;
}

/**
 * Check if a ticket is approaching or has breached SLA.
 * Returns { breached, warning, responseDeadline, resolutionDeadline, elapsedPct }
 */
async function checkTicketSla(ticket) {
  const slaConfig = await loadSlaConfig();
  const priority = ticket.priority || 'MEDIUM';
  const sla = slaConfig[priority];
  if (!sla) return { breached: false, warning: false };

  const now = new Date();
  const created = new Date(ticket.created_at || now);
  const elapsedMs = now - created;
  const responseMs = sla.responseMinutes * 60 * 1000;
  const resolutionMs = sla.resolutionMinutes * 60 * 1000;

  const responseElapsedPct = elapsedMs / responseMs;
  const resolutionElapsedPct = elapsedMs / resolutionMs;

  return {
    breached: resolutionElapsedPct >= 1.0,
    warning: responseElapsedPct >= SLA_WARNING_THRESHOLD || resolutionElapsedPct >= SLA_WARNING_THRESHOLD,
    responseDeadline: new Date(created.getTime() + responseMs),
    resolutionDeadline: new Date(created.getTime() + resolutionMs),
    responseElapsedPct: Math.round(responseElapsedPct * 100) / 100,
    resolutionElapsedPct: Math.round(resolutionElapsedPct * 100) / 100,
  };
}

/**
 * Find all tickets that have breached SLA and mark them
 */
async function markBreachedTickets() {
  const slaConfig = await loadSlaConfig();
  for (const [priority, sla] of Object.entries(slaConfig)) {
    const now = new Date();
    const cutoff = new Date(now.getTime() - sla.resolutionMinutes * 60 * 1000);
    await query(
      `UPDATE tickets SET sla_breached = TRUE, sla_breached_at = NOW()
       WHERE priority = $1
         AND status NOT IN ('Completed', 'Cancelled', 'Archived')
         AND created_at < $2
         AND sla_breached = FALSE`,
      [priority, cutoff]
    );
  }
}

export { loadSlaConfig, checkTicketSla, markBreachedTickets, SLA_WARNING_THRESHOLD };

import { query } from '../../db/connection.js';
import { scoreProviders } from './routingScore.js';
import { sendToUser } from './sse.js';
import { publishTopic as snsPublishTopic } from '../adapters/snsAdapter.js';

/*
 * BR-003: Emergency tickets auto-assigned if unassigned by PM within 20 minutes;
 *         SLA breach at 30 minutes.
 */
const AUTO_ASSIGN_MINUTES = 20;
const SLA_BREACH_MINUTES = 30;

/**
 * Find emergency tickets that have been unassigned for >20 minutes
 * and auto-assign the highest-scored available provider.
 */
async function autoAssignEmergencyTickets() {
  const cutoff = new Date(Date.now() - AUTO_ASSIGN_MINUTES * 60 * 1000);
  const tickets = await query(
    `SELECT t.* FROM tickets t
     WHERE t.priority = 'EMERGENCY'
       AND t.status IN ('Open', 'Manual Review')
       AND t.deleted_at IS NULL
       AND t.created_at < $1
       AND t.emergency_assigned_at IS NULL
     ORDER BY t.created_at ASC`,
    [cutoff]
  );

  for (const ticket of tickets.rows) {
    const topProviders = await scoreProviders(ticket);
    if (topProviders.length > 0) {
      const best = topProviders[0];
      await query(
        `UPDATE tickets SET assigned_to = $1, status = 'Assigned',
         emergency_assigned_at = NOW(), updated_at = NOW()
         WHERE id = $2`,
        [best.id, ticket.id]
      );
      await query(
        `INSERT INTO ticket_status_history (ticket_id, status, changed_by, reason)
         VALUES ($1, 'Assigned', NULL, $2)`,
        [ticket.id, `Auto-assigned to ${best.name} (emergency timeout)`]
      );
      /* Notify PM and provider via SSE */
      if (ticket.tenant_id && best.id) {
        sendToUser(ticket.tenant_id, 'ticket_assigned', {
          ticketId: ticket.id,
          providerName: best.name,
        });
      }

      /* BR-003: Publish emergency notification via SNS */
      await snsPublishTopic(
        `Emergency ticket #${ticket.id} auto-assigned`,
        `Ticket "${ticket.title}" assigned to ${best.name}. SLA deadline: ${new Date(Date.now() + 10 * 60 * 1000).toISOString()}`,
      );
    }
  }
  return tickets.rows.length;
}

/**
 * Mark tickets as SLA-breached if they exceed limits.
 */
async function markSlaBreaches() {
  const cutoff = new Date(Date.now() - SLA_BREACH_MINUTES * 60 * 1000);
  const result = await query(
    `UPDATE tickets SET sla_breached = TRUE, sla_breached_at = NOW()
     WHERE priority = 'EMERGENCY'
       AND deleted_at IS NULL
       AND status NOT IN ('Completed', 'Cancelled', 'Archived')
       AND created_at < $1
       AND sla_breached = FALSE`,
    [cutoff]
  );
  return result.rowCount || 0;
}

export { autoAssignEmergencyTickets, markSlaBreaches };

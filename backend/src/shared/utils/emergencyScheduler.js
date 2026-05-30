import { AUTO_ASSIGNED_STATUSES, getAutoAssignCutoff, isEligibleForAutoAssign } from './autoAssignGate.js';
import { query } from '../../db/connection.js';
import { scoreProviders } from './routingScore.js';
import { commitAutoAssignment } from './assignmentCommitter.js';
import { sendToUser } from './sse.js';
import { publishTopic as snsPublishTopic } from '../adapters/snsAdapter.js';
import * as notificationsRepo from '../../modules/notifications/notifications.repository.js';
import { sendNotificationEmail } from './email.service.js';

/*
 * PROMPT 22 (v2) §4 — automatic assignment for EVERY priority, not just
 * Emergency. Sourced from sla_config.auto_assign_minutes (no hardcoded
 * per-priority timers), respects the AUTO_ASSIGN_ENABLED System Admin toggle,
 * and is a superset of the old BR-003 emergency auto-assign (defaults the
 * EMERGENCY delay to its SLA response_minutes via migration 027).
 */

const MAX_AUTO_ASSIGN_TOP_N = 5;

async function loadAutoAssignConfig() {
  const flag = await query(
    `SELECT value FROM system_config WHERE key = 'AUTO_ASSIGN_ENABLED'`
  );
  /* Default ON if the config row is missing/legacy. */
  const enabled = flag.rows.length === 0 ? true : flag.rows[0].value !== 'false';

  const sla = await query(
    `SELECT priority, auto_assign_minutes FROM sla_config ORDER BY priority ASC`
  );
  const delays = {};
  for (const row of sla.rows) delays[row.priority] = row.auto_assign_minutes;
  return { enabled, delays };
}

/**
 * Auto-assign every unassigned, classification-finished ticket whose
 * per-priority delay has elapsed and that a manager hasn't handled first.
 * Returns { enabled, scanned, assigned }.
 */
async function autoAssignTickets() {
  const { enabled, delays } = await loadAutoAssignConfig();
  if (!enabled) return { enabled: false, scanned: 0, assigned: 0 };

  const now = Date.now();
  let scanned = 0;
  let assigned = 0;

  for (const [priority, minutes] of Object.entries(delays)) {
    if (minutes == null || Number(minutes) <= 0) continue;
    const cutoff = getAutoAssignCutoff(new Date(now), Number(minutes));

    const result = await query(
      `SELECT t.*, p.manager_id AS manager_id,
              mgr.name AS manager_name, mgr.email AS manager_email
       FROM tickets t
       LEFT JOIN units u ON u.id = t.unit_id
       LEFT JOIN properties p ON p.id = u.property_id
       LEFT JOIN users mgr ON mgr.id = p.manager_id
       WHERE t.priority = $1
         AND t.assigned_to IS NULL
         AND t.deleted_at IS NULL
         AND t.ai_confidence IS NOT NULL
         AND t.status = ANY($2::text[])
         AND t.no_provider_flagged_at IS NULL
         AND t.auto_assigned_at IS NULL
         AND t.created_at < $3
       ORDER BY t.created_at ASC`,
      [priority, AUTO_ASSIGNED_STATUSES, cutoff]
    );

    for (const ticket of result.rows) {
      scanned++;
      /* Belt-and-braces: SQL + pure gate must agree. */
      if (!isEligibleForAutoAssign(ticket, cutoff)) continue;
      if (await tryAutoAssignOne(ticket)) assigned++;
    }
  }

  return { enabled, scanned, assigned };
}

async function tryAutoAssignOne(ticket) {
  const category = ticket.ai_category || ticket.category || 'Other';
  const top = await scoreProviders(ticket, {
    topN: MAX_AUTO_ASSIGN_TOP_N,
    requireSpecialisation: true,
    category,
  });

  /* §4 — zero eligible providers: surface to the manager, stop retrying. */
  if (top.length === 0) {
    await flagNoProvider(ticket);
    return false;
  }

  const best = top[0];

  /* §4 — race-condition guard: this UPDATE only wins while the ticket is
   * still unassigned and not already auto-assigned. If a manager (or a prior
   * scheduler tick) assigned a provider a split second earlier, rowCount = 0
   * and we record nothing — exactly one assignment survives. */
  const updated = await query(
    `UPDATE tickets
     SET assigned_to = $1, status = 'Assigned',
         auto_assigned = TRUE, auto_assigned_at = NOW(), updated_at = NOW()
     WHERE id = $2
       AND assigned_to IS NULL
       AND auto_assigned_at IS NULL
       AND status = ANY($3::text[])`,
    [best.id, ticket.id, AUTO_ASSIGNED_STATUSES]
  );
  if ((updated.rowCount || 0) === 0) return false;

  const manager = ticket.manager_id
    ? { id: ticket.manager_id, name: ticket.manager_name, email: ticket.manager_email }
    : null;

  await commitAutoAssignment({ ticket, provider: best, manager });

  /* Legacy BR-003 emergency broadcast. */
  if (ticket.priority === 'EMERGENCY') {
    await snsPublishTopic(
      `Emergency ticket #${ticket.id} auto-assigned`,
      `Ticket "${ticket.title}" assigned to ${best.name}.`,
    ).catch(() => {});
  }

  return true;
}

/** §4 — no eligible provider: flag once for manager attention; the timer
 *  (no_provider_flagged_at) will not keep retrying silently. */
async function flagNoProvider(ticket) {
  const reason = 'No eligible provider with matching specialisation — requires manager attention';

  await query(
    `UPDATE tickets
     SET no_provider_flagged_at = NOW(), status = 'Manual Review', updated_at = NOW()
     WHERE id = $1`,
    [ticket.id]
  );
  await query(
    `INSERT INTO ticket_status_history (ticket_id, status, changed_by, changed_by_name, reason)
     VALUES ($1, 'Manual Review', NULL, 'System', $2)`,
    [ticket.id, reason]
  );
  await query(
    `INSERT INTO low_confidence_queue (ticket_id, text_confidence, visual_confidence, combined_confidence, reason)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (ticket_id) DO UPDATE SET
       combined_confidence = EXCLUDED.combined_confidence,
       reason = EXCLUDED.reason,
       status = 'pending',
       reviewed_by = NULL,
       reviewed_at = NULL`,
    [ticket.id, ticket.ai_text_confidence ?? null, ticket.ai_visual_confidence ?? null,
     ticket.ai_confidence || 0, reason]
  );

  if (ticket.manager_id) {
    try {
      await notificationsRepo.create({
        user_id: ticket.manager_id,
        type: 'warning',
        title: 'Ticket needs your attention — no matching provider',
        body: `Ticket "${ticket.title}" (${ticket.priority}) has no available provider with the matching specialisation and needs manual assignment.`,
        is_emergency: ticket.priority === 'EMERGENCY',
      });
      sendToUser(ticket.manager_id, 'ticket_needs_attention', {
        ticketId: ticket.id, reason,
      });
      if (ticket.manager_name && ticket.manager_email) {
        sendNotificationEmail(ticket.manager_email, ticket.manager_name, {
          title: 'Ticket needs your attention — no matching provider',
          body: `Ticket "${ticket.title}" (${ticket.priority}) has no available provider with the matching specialisation and needs manual assignment.`,
        }).catch(() => {});
      }
    } catch (err) {
      console.error('no-provider flag notification failed:', err.message);
    }
  }
}

/** Mark Emergency tickets as SLA-breached if they exceed the 30-min window. */
const SLA_BREACH_MINUTES = 30;
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

/* Backward-compatible alias for the original BR-003 entry point. */
const autoAssignEmergencyTickets = autoAssignTickets;

export {
  autoAssignTickets,
  autoAssignEmergencyTickets,
  markSlaBreaches,
  isEligibleForAutoAssign,
  getAutoAssignCutoff,
  AUTO_ASSIGNED_STATUSES,
};
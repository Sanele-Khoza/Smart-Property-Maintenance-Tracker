/*
 * PROMPT 22 (v2) §4/§6 — shared side-effects for a system-initiated
 * assignment: routing_assignments + status history + workload + audit log
 * (system-generated events use performed_by = NULL) + clear the
 * "no provider found" flag and the low-confidence queue entry, then notify
 * tenant, provider and property manager (DB notification + SSE + email).
 */
import { query } from '../../db/connection.js';
import * as notificationsRepo from '../../modules/notifications/notifications.repository.js';
import { sendToUser } from './sse.js';
import { sendTicketAssignedNotification, sendNotificationEmail } from './email.service.js';

/** Map a service_provider id to the matching users.id (seeds share the UUID). */
async function resolveProviderUserId(providerId) {
  const result = await query(
    `SELECT u.id AS user_id
     FROM service_providers sp
     JOIN users u ON u.email = sp.email
     WHERE sp.id = $1`,
    [providerId]
  );
  return result.rows[0]?.user_id || null;
}

/**
 * Persist a system auto-assignment and notify all three parties.
 * Returns { committed } — the caller already performed the guarded
 * tickets UPDATE; this only records results that must happen once.
 */
async function commitAutoAssignment({ ticket, provider, manager = null }) {
  const providerScore = provider.totalScore ?? null;

  await query(
    `INSERT INTO routing_assignments (ticket_id, provider_id, assignment_type, status, score_data)
     VALUES ($1, $2, 'auto', 'assigned', $3)`,
    [ticket.id, provider.id, JSON.stringify(provider)]
  );

  await query(
    `INSERT INTO ticket_status_history (ticket_id, status, changed_by, changed_by_name, reason)
     VALUES ($1, 'Assigned', NULL, 'System', $2)`,
    [ticket.id, `Auto-assigned to ${provider.name} (score: ${providerScore})`]
  );

  await query(
    'UPDATE service_providers SET current_workload = current_workload + 1 WHERE id = $1',
    [provider.id]
  );

  /* System-generated event → performed_by NULL (Prompt 22 v2 §4). */
  await query(
    `INSERT INTO audit_log (action, performed_by, target_type, target_id, details)
     VALUES ('routing.auto_assigned', NULL, 'ticket', $1, $2)`,
    [ticket.id, JSON.stringify({ ticketId: ticket.id, providerId: provider.id, providerName: provider.name, score: providerScore })]
  );

  /* No longer awaiting manager attention. */
  await query('UPDATE tickets SET no_provider_flagged_at = NULL WHERE id = $1', [ticket.id]);
  await query(
    `UPDATE low_confidence_queue SET status = 'resolved' WHERE ticket_id = $1 AND status = 'pending'`,
    [ticket.id]
  );

  await notifyAutoAssignment({ ticket, provider, manager });

  return { committed: true };
}

/**
 * S6 — generate real notifications (not just visibility) for an automatic
 * assignment: tenant, provider, and the property manager.
 */
async function notifyAutoAssignment({ ticket, provider, manager = null }) {
  const isEmergency = ticket.priority === 'EMERGENCY';

  const tenantNotified = ticket.tenant_id
    ? asyncResult(notificationsRepo.create({
        user_id: ticket.tenant_id,
        type: 'assignment',
        title: 'Ticket auto-assigned',
        body: `Your ticket "${ticket.title}" was auto-assigned to ${provider.name}.`,
        is_emergency: isEmergency,
      }), () => {
        sendToUser(ticket.tenant_id, 'ticket_assigned', {
          ticketId: ticket.id, providerName: provider.name, method: 'auto',
        });
      })
    : false;

  const providerUserId = await resolveProviderUserId(provider.id);
  const providerNotified = providerUserId
    ? asyncResult(notificationsRepo.create({
        user_id: providerUserId,
        type: 'assignment',
        title: 'New job auto-assigned',
        body: `Ticket "${ticket.title}" (${ticket.priority}) was auto-assigned to you. Tap to accept or decline.`,
        is_emergency: isEmergency,
      }), () => {
        sendToUser(providerUserId, 'job_assigned', {
          ticketId: ticket.id, title: ticket.title, providerId: provider.id,
        });
        sendTicketAssignedNotification(providerUserId, ticket).catch(() => {});
      })
    : false;

  const managerNotified = manager?.id
    ? asyncResult(notificationsRepo.create({
        user_id: manager.id,
        type: 'info',
        title: 'Ticket auto-assigned by system',
        body: `Ticket "${ticket.title}" (${ticket.priority}) was auto-assigned to ${provider.name} on your behalf.`,
        is_emergency: isEmergency,
      }), () => {
        sendToUser(manager.id, 'ticket_auto_assigned', {
          ticketId: ticket.id, providerName: provider.name,
        });
        if (manager.name && manager.email) {
          sendNotificationEmail(manager.email, manager.name, {
            title: 'Ticket auto-assigned by system',
            body: `Ticket "${ticket.title}" (${ticket.priority}) was auto-assigned to ${provider.name} on your behalf.`,
          }).catch(() => {});
        }
      })
    : false;

  return { tenantNotified, providerNotified, managerNotified };
}

/** Await a notification insert, run a side-channel on success (best effort). */
async function asyncResult(promise, onSuccess) {
  try {
    await promise;
    if (onSuccess) onSuccess();
    return true;
  } catch (err) {
    console.error('auto-assign notification failed:', err.message);
    return false;
  }
}

export { commitAutoAssignment, notifyAutoAssignment, resolveProviderUserId };
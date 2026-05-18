import { query } from '../../db/connection.js';
import AppError from '../../shared/errors/AppError.js';
import { scoreProviders } from '../../shared/utils/routingScore.js';
import { sendToUser, broadcast } from '../../shared/utils/sse.js';
import { commitAutoAssignment, notifyAutoAssignment } from '../../shared/utils/assignmentCommitter.js';

const SDD_CATEGORIES = [
  'Plumbing', 'Electrical', 'HVAC', 'Appliances',
  'Structural', 'Security', 'Landscaping', 'Pest Control', 'Other',
];

/* Statuses a ticket can be in while eligible for (re)routing. */
const ROUTABLE_AUTO_STATUSES = ['New', 'Open', 'AI Classified'];

async function findTicket(ticketId) {
  const result = await query('SELECT * FROM tickets WHERE id = $1', [ticketId]);
  if (result.rows.length === 0) throw AppError.notFound('Ticket not found');
  return result.rows[0];
}

async function assertNotReadOnly(ticket) {
  const readonly = ['Closed', 'Cancelled', 'Archived'];
  if (readonly.includes(ticket.status)) {
    throw AppError.forbidden(`Ticket is ${ticket.status} and cannot be routed`);
  }
}

async function assertRoutingAllowed(ticket) {
  if (ticket.pm_confirmed) return;
  if (ticket.ai_text_confidence != null && ticket.ai_visual_confidence != null) {
    const combined = 0.4 * (ticket.ai_text_confidence || 0) + 0.6 * (ticket.ai_visual_confidence || 0);
    if (combined < 0.6) {
      throw AppError.forbidden(
        'Combined AI confidence is below 0.60. A Property Manager must manually confirm this ticket before routing.'
      );
    }
  }
}

async function auditLog(ticketId, action, userId, userName, details) {
  try {
    await query(
      `INSERT INTO audit_log (action, performed_by, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [`routing.${action}`, userId || null, 'ticket', ticketId,
       JSON.stringify({ ticketId, ...(details || {}) })]
    );
  } catch (err) {
    console.error('routing audit_log insert failed:', err.message);
  }
}

async function getTopProviders(ticketId, opts = {}) {
  const ticket = await findTicket(ticketId);
  await assertNotReadOnly(ticket);

  const category = ticket.ai_category || ticket.category || 'Other';
  const providers = await scoreProviders(ticket, { ...opts, category });

  return {
    success: true,
    data: {
      ticketId,
      ticketCategory: category,
      ticketPriority: ticket.priority,
      providers,
    },
  };
}

async function autoAssign(ticketId, userId, userName, requireSpecialisation = true) {
  const ticket = await findTicket(ticketId);
  await assertNotReadOnly(ticket);
  await assertRoutingAllowed(ticket);

  if (ticket.assigned_to) {
    throw AppError.badRequest('Ticket already has an assigned provider');
  }

  const category = ticket.ai_category || ticket.category || 'Other';
  const providers = await scoreProviders(ticket, { topN: 1, requireSpecialisation, category });

  if (providers.length === 0) {
    throw AppError.badRequest('No suitable providers available for auto-assignment');
  }

  const top = providers[0];

  /* §4 — race-condition guard: if a manager/scheduler assigned this ticket a
   * split second before this UPDATE, rowCount is 0 and nothing is recorded. */
  const updated = await query(
    `UPDATE tickets
     SET assigned_to = $1, status = 'Assigned', updated_at = NOW(),
         auto_assigned = TRUE, auto_assigned_at = NOW(),
         no_provider_flagged_at = NULL
     WHERE id = $2
       AND assigned_to IS NULL
       AND auto_assigned_at IS NULL
       AND status = ANY($3::text[])`,
    [top.id, ticketId, ROUTABLE_AUTO_STATUSES]
  );
  if ((updated.rowCount || 0) === 0) {
    throw AppError.conflict('Ticket was just assigned by another process — no duplicate assignment recorded');
  }

  await query(
    `UPDATE low_confidence_queue SET status = 'resolved'
     WHERE ticket_id = $1 AND status = 'pending'`,
    [ticketId]
  );

  await query(
    `INSERT INTO ticket_status_history (ticket_id, status, changed_by, changed_by_name, reason)
     VALUES ($1, 'Assigned', $2, $3, $4)`,
    [ticketId, userId, userName, `Auto-assigned to ${top.name} (score: ${top.totalScore})`]
  );

  await query(
    `INSERT INTO routing_assignments (ticket_id, provider_id, assignment_type, status, score_data)
     VALUES ($1, $2, 'auto', 'assigned', $3)`,
    [ticketId, top.id, JSON.stringify(top)]
  );

  await query(
    `UPDATE service_providers SET current_workload = current_workload + 1 WHERE id = $1`,
    [top.id]
  );

  await auditLog(ticketId, 'auto_assigned', userId, userName, {
    providerId: top.id, providerName: top.name, score: top.totalScore,
  });

  /* §6 — notify tenant, provider and property manager that the system
   * assigned on the manager's behalf. */
  const manager = await resolveTicketManager(ticketId);
  await notifyAutoAssignment({ ticket, provider: top, manager });

  sendToUser(ticket.tenant_id, 'ticket_assigned', {
    ticketId, providerName: top.name, method: 'auto',
  });

  return {
    success: true,
    data: {
      provider: top,
      autoAccepted: top.autoAccept,
    },
    message: `Auto-assigned to ${top.name}`,
  };
}

/** Load the property manager (id/name/email) responsible for a ticket. */
async function resolveTicketManager(ticketId) {
  const result = await query(
    `SELECT p.manager_id AS id, mgr.name AS name, mgr.email AS email
     FROM tickets t
     LEFT JOIN units u ON u.id = t.unit_id
     LEFT JOIN properties p ON p.id = u.property_id
     LEFT JOIN users mgr ON mgr.id = p.manager_id
     WHERE t.id = $1`,
    [ticketId]
  );
  const row = result.rows[0];
  return row?.id ? row : null;
}

async function dispatchEmergency(ticketId, userId, userName, opts = {}) {
  const ticket = await findTicket(ticketId);
  await assertNotReadOnly(ticket);

  if (ticket.priority !== 'EMERGENCY') {
    throw AppError.badRequest('Only EMERGENCY tickets can be dispatched');
  }

  const category = ticket.ai_category || ticket.category || 'Other';
  const requireSpecialisation = opts.requireSpecialisation !== false;
  const qualified = await scoreProviders(ticket, {
    topN: 50, requireSpecialisation, category,
  });

  const eligible = qualified.filter(p =>
    p.status !== 'OFF_DUTY' && (p.autoAccept || p.status === 'AVAILABLE')
  );

  if (eligible.length === 0) {
    const fallback = await scoreProviders(ticket, {
      topN: 10, requireSpecialisation: false, category,
    });
    const offDutyOk = fallback.filter(p => p.status !== 'OFF_DUTY');
    if (offDutyOk.length === 0) {
      throw AppError.badRequest('No eligible providers available for emergency dispatch');
    }
    eligible.push(...offDutyOk.slice(0, 5));
  }

  const offers = [];
  for (const provider of eligible.slice(0, 10)) {
    const result = await query(
      `INSERT INTO routing_assignments (ticket_id, provider_id, assignment_type, status, score_data)
       VALUES ($1, $2, 'emergency', 'offered', $3)
       RETURNING id`,
      [ticketId, provider.id, JSON.stringify(provider)]
    );
    offers.push({
      assignmentId: result.rows[0].id,
      providerId: provider.id,
      providerName: provider.name,
      companyName: provider.companyName,
      score: provider.totalScore,
      autoAccept: provider.autoAccept,
    });
  }

  const customMessage = opts.customMessage || `Emergency: ${ticket.title}`;
  for (const offer of offers) {
    broadcast('emergency_dispatch', {
      ticketId,
      assignmentId: offer.assignmentId,
      title: ticket.title,
      priority: ticket.priority,
      message: customMessage,
      providerId: offer.providerId,
    });
  }

  let autoAssigned = null;
  const autoAcceptProviders = offers.filter(o => o.autoAccept);
  if (autoAcceptProviders.length > 0) {
    autoAcceptProviders.sort((a, b) => b.score - a.score);
    const first = autoAcceptProviders[0];
    await acceptAssignment(first.assignmentId, first.providerId, userId, ticket, true);
    autoAssigned = first;
  }

  if (!autoAssigned) {
    await query(
      `UPDATE tickets SET status = 'ESCALATED', updated_at = NOW() WHERE id = $1`,
      [ticketId]
    );
    await query(
      `INSERT INTO ticket_status_history (ticket_id, status, changed_by, changed_by_name, reason)
       VALUES ($1, 'ESCALATED', $2, $3, $4)`,
      [ticketId, userId, userName, 'Emergency dispatch — awaiting provider acceptance']
    );
  }

  await auditLog(ticketId, 'emergency_dispatched', userId, userName, {
    offersCount: offers.length, autoAssigned: !!autoAssigned,
  });

  return {
    success: true,
    data: {
      offers,
      autoAssigned,
      notifiedCount: offers.length,
    },
    message: autoAssigned
      ? `Emergency dispatched — ${autoAssigned.providerName} auto-accepted`
      : `Emergency dispatched to ${offers.length} providers — awaiting acceptance`,
  };
}

async function acceptAssignment(assignmentId, providerId, userId, ticketFromCaller, isAuto = false) {
  const result = await query(
    `SELECT ra.*, t.priority, t.title, t.tenant_id
     FROM routing_assignments ra
     JOIN tickets t ON t.id = ra.ticket_id
     WHERE ra.id = $1 AND ra.provider_id = $2 AND ra.status = 'offered'`,
    [assignmentId, providerId]
  );

  if (result.rows.length === 0) {
    const existing = await query(
      'SELECT status FROM routing_assignments WHERE id = $1',
      [assignmentId]
    );
    if (existing.rows.length === 0) {
      return { error: 'Assignment offer not found', statusCode: 404 };
    }
    return { error: `Offer already ${existing.rows[0].status}`, statusCode: 409 };
  }

  const assignment = result.rows[0];
  const ticket = ticketFromCaller || await findTicket(assignment.ticket_id);

  await query(
    `UPDATE routing_assignments
     SET status = 'accepted', responded_at = NOW(), accepted_by = $1
     WHERE id = $2`,
    [userId, assignmentId]
  );

  const otherOffers = await query(
    `UPDATE routing_assignments
     SET status = 'expired', responded_at = NOW()
     WHERE ticket_id = $1 AND id != $2 AND status = 'offered'`,
    [assignment.ticket_id, assignmentId]
  );

  await query(
    `UPDATE tickets SET assigned_to = $1, status = 'Assigned', updated_at = NOW() WHERE id = $2`,
    [providerId, assignment.ticket_id]
  );

  await query(
    `UPDATE service_providers SET current_workload = current_workload + 1 WHERE id = $1`,
    [providerId]
  );

  await query(
    `INSERT INTO ticket_status_history (ticket_id, status, changed_by, reason)
     VALUES ($1, 'Assigned', $2, $3)`,
    [assignment.ticket_id, userId,
     isAuto ? 'Auto-accepted (emergency dispatch)' : 'Accepted emergency dispatch']
  );

  broadcast('emergency_accepted', {
    ticketId: assignment.ticket_id,
    providerId,
    assignmentId,
  });

  if (ticket.tenant_id) {
    sendToUser(ticket.tenant_id, 'ticket_assigned', {
      ticketId: assignment.ticket_id,
      method: 'emergency',
    });
  }

  return { accepted: true, ticketId: assignment.ticket_id, assignmentId };
}

const accept = async (assignmentId, providerId, userId) => {
  const result = await acceptAssignment(assignmentId, providerId, userId, null, false);
  if (result.error) return result;
  await auditLog(result.ticketId, 'emergency_accepted', userId, null, { assignmentId });
  return { success: true, data: result, message: 'Emergency dispatch accepted' };
};

async function manualAssign(ticketId, providerId, userId, userName, note) {
  const ticket = await findTicket(ticketId);
  await assertNotReadOnly(ticket);
  await assertRoutingAllowed(ticket);

  const provider = await query('SELECT * FROM service_providers WHERE id = $1', [providerId]);
  if (provider.rows.length === 0) throw AppError.notFound('Service provider not found');

  const prevAssigned = ticket.assigned_to;
  if (prevAssigned && prevAssigned !== providerId) {
    await query(
      'UPDATE service_providers SET current_workload = GREATEST(current_workload - 1, 0) WHERE id = $1',
      [prevAssigned]
    );
  }

  await query(
    `UPDATE tickets
     SET assigned_to = $1, status = 'Assigned', updated_at = NOW(),
         auto_assigned = FALSE, auto_assigned_at = NULL,
         no_provider_flagged_at = NULL
     WHERE id = $2`,
    [providerId, ticketId]
  );

  await query(
    `UPDATE low_confidence_queue SET status = 'resolved'
     WHERE ticket_id = $1 AND status = 'pending'`,
    [ticketId]
  );

  await query(
    `INSERT INTO ticket_status_history (ticket_id, status, changed_by, changed_by_name, reason)
     VALUES ($1, 'Assigned', $2, $3, $4)`,
    [ticketId, userId, userName, note || `Assigned to ${provider.rows[0].name}`]
  );

  if (!prevAssigned || prevAssigned !== providerId) {
    await query(
      'UPDATE service_providers SET current_workload = current_workload + 1 WHERE id = $1',
      [providerId]
    );
  }

  await query(
    `INSERT INTO routing_assignments (ticket_id, provider_id, assignment_type, status)
     VALUES ($1, $2, 'manual', 'assigned')`,
    [ticketId, providerId]
  );

  await auditLog(ticketId, 'manually_assigned', userId, userName, {
    providerId, providerName: provider.rows[0].name, note,
  });

  sendToUser(ticket.tenant_id, 'ticket_assigned', {
    ticketId, providerName: provider.rows[0].name, method: 'manual',
  });

  return {
    success: true,
    data: { provider: provider.rows[0] },
    message: `Assigned to ${provider.rows[0].name}`,
  };
}

/**
 * §4 — decline triggers automatic fallback: move to the next-ranked candidate
 * from the original scoring, excluding providers who already declined/expired.
 * System-generated → audit actor NULL. If nobody remains, flag for the
 * manager instead of leaving the ticket silently unassigned.
 * Returns { success: true } or { success: false, reason }.
 */
async function reassignAfterDecline(ticketId) {
  /*
   * This runs at the tail of a provider decline and must NEVER break the
   * decline response: it is a best-effort auto-routing fallback. Any failure
   * (DB hiccup, no record, invalid state) degrades to { success: false } and
   * the decline itself stands.
   */
  try {
    const ticket = await findTicket(ticketId);
    if (ticket.status !== 'Declined') {
      return { success: false, reason: `Ticket is not Declined (${ticket.status})` };
    }

    const category = ticket.ai_category || ticket.category || 'Other';
    const providers = await scoreProviders(ticket, {
      topN: 10, requireSpecialisation: true, category,
    });

    const prior = await query(
      `SELECT provider_id FROM routing_assignments
       WHERE ticket_id = $1 AND status IN ('declined', 'accepted', 'expired', 'assigned')`,
      [ticketId]
    );
    const tried = new Set(prior.rows.map((r) => r.provider_id));

    const next = providers.find((p) => !tried.has(p.id));
    if (!next) {
      const reason = 'Declined by provider; no eligible fallback remaining — requires manager attention';
      await query(
        `UPDATE tickets
         SET no_provider_flagged_at = NOW(), status = 'Manual Review', updated_at = NOW()
         WHERE id = $1`,
        [ticketId]
      );
      await query(
        `INSERT INTO ticket_status_history (ticket_id, status, changed_by, changed_by_name, reason)
         VALUES ($1, 'Manual Review', NULL, 'System', $2)`,
        [ticketId, reason]
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
        [ticketId, ticket.ai_text_confidence ?? null, ticket.ai_visual_confidence ?? null,
         ticket.ai_confidence || 0, reason]
      );
      const manager = await resolveTicketManager(ticketId);
      try {
        sendToUser(manager?.id, 'ticket_needs_attention', { ticketId, reason });
      } catch { /* best effort */ }
      return { success: false, reason };
    }

    /* Guarded: only wins while still Declined + unassigned. */
    const updated = await query(
      `UPDATE tickets
       SET assigned_to = $1, status = 'Assigned', updated_at = NOW(),
           auto_assigned = TRUE, auto_assigned_at = NOW(),
           no_provider_flagged_at = NULL
       WHERE id = $2 AND status = 'Declined' AND assigned_to IS NULL`,
      [next.id, ticketId]
    );
    if ((updated.rowCount || 0) === 0) {
      return { success: false, reason: 'Ticket was reassigned concurrently' };
    }

    const manager = await resolveTicketManager(ticketId);
    await commitAutoAssignment({ ticket, provider: next, manager });

    return { success: true, data: { provider: next } };
  } catch {
    return { success: false, reason: 'Best-effort fallback failed — decline still succeeded' };
  }
}

async function getAssignmentHistory(ticketId) {
  const result = await query(
    `SELECT ra.*, sp.name AS provider_name, sp.company_name
     FROM routing_assignments ra
     JOIN service_providers sp ON sp.id = ra.provider_id
     WHERE ra.ticket_id = $1
     ORDER BY ra.created_at DESC`,
    [ticketId]
  );
  return result.rows;
}

async function getProviderStatus(providerId) {
  const result = await query(
    `SELECT sp.*, pa.auto_accept, pa.max_concurrent_jobs,
            pa.current_jobs, pa.last_heartbeat,
            pa.preferred_radius_km, pa.is_available
     FROM service_providers sp
     LEFT JOIN provider_availability pa ON pa.provider_id = sp.id
     WHERE sp.id = $1`,
    [providerId]
  );
  if (result.rows.length === 0) throw AppError.notFound('Provider not found');
  return result.rows[0];
}

export {
  getTopProviders,
  autoAssign,
  dispatchEmergency,
  accept,
  manualAssign,
  reassignAfterDecline,
  getAssignmentHistory,
  getProviderStatus,
};

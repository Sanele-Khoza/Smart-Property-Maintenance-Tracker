import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { query } from '../../db/connection.js';
import * as repo from './tickets.repository.js';
import AppError from '../../shared/errors/AppError.js';
import { isValidTransition, TicketStates, isTerminal } from '../../shared/constants/ticketStates.js';
import { findById as findServiceProvider } from '../technicians/technicians.repository.js';
import { classify } from '../../shared/utils/aiClassifier.js';
import { checkTicketSla, loadSlaConfig } from '../../shared/utils/slaChecker.js';
import { scoreProviders } from '../../shared/utils/routingScore.js';
import { sendToUser } from '../../shared/utils/sse.js';
import classifyTextWithFallback from '../../shared/utils/classifyWithFallback.js';
import { moderateImage, detectLabels } from '../../shared/adapters/rekognitionAdapter.js';
import { persistClassification, logSingleInference } from '../ai/ai.service.js';
import { checkForDuplicate } from '../ai/duplicateDetector.js';
import { reassignAfterDecline } from '../routing/routing.service.js';
import { resolveProviderUserId } from '../../shared/utils/assignmentCommitter.js';
import * as notificationsRepo from '../notifications/notifications.repository.js';
import { getPresignedUrl, isS3Healthy } from '../../shared/adapters/s3Adapter.js';
import { isAwsEnabled } from '../../shared/adapters/retry.js';
import config from '../../config/index.js';
import {
  sendTicketCreatedNotification,
  sendTicketAssignedNotification,
  sendTicketStatusChangedNotification,
} from '../../shared/utils/email.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const UPLOADS_PATH = path.resolve(__dirname, '..', '..', '..', config.upload.uploadDir);
const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

async function auditLog(ticketId, action, userId, userName, details) {
  try {
    await query(
      `INSERT INTO audit_log (action, performed_by, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [`ticket.${action}`, userId || null, 'ticket', ticketId,
       JSON.stringify({ ticketId, ...(details || {}) })]
    );
  } catch (err) {
    console.error('audit_log insert failed:', err.message);
  }
}

const STATUS_NOTIFICATION_TITLES = {
  [TicketStates.ACCEPTED]: 'Service provider accepted your ticket',
  [TicketStates.IN_PROGRESS]: 'Work started on your ticket',
  [TicketStates.WAITING_FOR_PARTS]: 'Your ticket is waiting for parts',
  [TicketStates.COMPLETED]: 'Your ticket has been marked complete',
  [TicketStates.TENANT_CONFIRMED]: 'Ticket completion confirmed',
  [TicketStates.CLOSED]: 'Your ticket has been closed',
  [TicketStates.REOPENED]: 'Your ticket has been reopened',
};

async function performTransition(ticketId, toStatus, userId, userName, reason, sseEvent) {
  const ticket = await repo.findById(ticketId);
  if (!ticket) throw AppError.notFound('Ticket not found');

  if (isTerminal(ticket.status)) {
    throw AppError.forbidden(`Ticket is ${ticket.status} and cannot be modified`);
  }

  if (!isValidTransition(ticket.status, toStatus)) {
    throw AppError.badRequest(`Cannot transition from '${ticket.status}' to '${toStatus}'`);
  }

  const updated = await repo.update(ticketId, { status: toStatus });
  await repo.addHistory(ticketId, toStatus, userId, userName, reason);
  await auditLog(ticketId, `status.${toStatus}`, userId, userName, {
    from: ticket.status, to: toStatus, reason,
  });

  if (sseEvent && updated.tenant_id) {
    sendToUser(updated.tenant_id, sseEvent, {
      ticketId, status: toStatus, title: ticket.title,
    });
  }

  const sla = await checkTicketSla(updated);
  if (sla.warning && updated.tenant_id) {
    sendToUser(updated.tenant_id, 'sla_warning', {
      ticketId, status: toStatus, title: ticket.title,
    });
  }

  if (updated.tenant_id) {
    // Same gap decline used to have: this previously only emailed + live-
    // pushed, so a tenant who wasn't online at that exact moment, or whose
    // email didn't arrive, never saw it — not now, not on a later visit to
    // their Notifications page, since nothing was ever persisted. Now every
    // status change (accept, start, waiting-for-parts, parts-received,
    // complete, tenant-confirm, close) reliably shows up.
    await notificationsRepo.create({
      user_id: updated.tenant_id,
      type: 'status',
      title: STATUS_NOTIFICATION_TITLES[toStatus] || `Ticket status updated to ${toStatus}`,
      body: `Ticket "${ticket.title}": ${reason}`,
      is_emergency: ticket.priority === 'EMERGENCY',
      ticket_id: ticketId,
    }).catch(() => {});

    sendTicketStatusChangedNotification(
      updated.tenant_id, updated, toStatus, ticket.status, reason
    ).catch(() => {});
  }

  return updated;
}

const READONLY_STATUSES = ['Closed', 'Cancelled', 'Archived'];
const REOPENABLE_FROM = ['Completed', 'Archived'];

async function assertNotReadOnly(ticket) {
  if (READONLY_STATUSES.includes(ticket.status)) {
    throw AppError.forbidden(`Ticket is ${ticket.status} and cannot be modified`);
  }
}

async function assertRoutingAllowed(ticket) {
  if (ticket.pm_confirmed) return;
  if (ticket.ai_text_label && ticket.ai_visual_label) {
    const textConf = ticket.ai_text_confidence || 0;
    const visConf = ticket.ai_visual_confidence || 0;
    const combined = 0.4 * textConf + 0.6 * visConf;
    if (combined < 0.60) {
      throw AppError.forbidden(
        'Combined AI confidence is below 0.60. A Property Manager must manually confirm this ticket before routing.'
      );
    }
  }
}

async function attachSlaDeadlines(tickets) {
  if (!tickets || tickets.length === 0) return tickets;
  const slaConfig = await loadSlaConfig();
  const now = Date.now();
  for (const t of tickets) {
    const sla = slaConfig[t.priority || 'MEDIUM'];
    if (!sla) continue;
    const createdMs = new Date(t.created_at || now).getTime();
    if (Number.isNaN(createdMs)) continue;
    t.slaResponseBefore = createdMs + sla.responseMinutes * 60 * 1000;
    t.slaResolutionBefore = createdMs + sla.resolutionMinutes * 60 * 1000;
  }
  return tickets;
}

async function attachPhotoData(tickets) {
  if (!tickets || tickets.length === 0) return tickets;

  const attachments = await repo.getAttachmentsForTickets(tickets.map((t) => t.id));
  const byTicket = new Map();
  for (const att of attachments) {
    if (!att.file_type?.startsWith('image/')) continue;
    if (!byTicket.has(att.ticket_id)) byTicket.set(att.ticket_id, []);
    byTicket.get(att.ticket_id).push(att);
  }

  await Promise.all(tickets.map(async (t) => {
    const atts = byTicket.get(t.id) || [];
    t.attachments = atts;
    t.photoUrls = (await Promise.all(atts.map(async (att) => {
      if (!isAwsEnabled() || !(await isS3Healthy())) return `/uploads/${att.file_key}`;
      try {
        return await getPresignedUrl(att.file_key, undefined, config.aws.s3.presignedUrlTtlImages);
      } catch (err) {
        console.warn('Presign failed:', err.message);
        return `/uploads/${att.file_key}`;
      }
    }))).filter(Boolean);
  }));

  return tickets;
}

async function list(filters) {
  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 20;
  const offset = (page - 1) * limit;
  const queryFilters = { ...filters, limit, offset };
  const { tickets, total } = await repo.findAll(queryFilters);
  await attachPhotoData(tickets);
  await attachSlaDeadlines(tickets);
  const totalPages = Math.ceil(total / limit);
  return {
    success: true,
    data: { tickets },
    pagination: { page, limit, total, totalPages },
  };
}

async function getById(id) {
  const ticket = await repo.findById(id);
  if (!ticket) throw AppError.notFound('Ticket not found');
  const history = await repo.getHistory(id);
  const comments = await repo.getComments(id);
  const [withPhotos] = await attachPhotoData([ticket]);
  await attachSlaDeadlines([withPhotos]);
  return { success: true, data: { ticket: withPhotos, history, comments } };
}

async function runAiPipeline(ticketId) {
  const ticket = await repo.findById(ticketId);
  if (!ticket) return null;

  let textResult = { category: null, confidence: 0, service: 'none' };
  let awsTextAvailable = false;
  if (ticket.description) {
    textResult = await classifyTextWithFallback(ticket.description);
    awsTextAvailable = textResult.service === 'COMPREHEND' || textResult.service === 'PYTHON_SKLEARN';
    await logSingleInference(ticketId, textResult.service, { ...textResult, source: textResult.source });
  }

  let visualResult = { category: null, confidence: 0, service: 'none', visualEmergency: false, labels: [] };
  let awsVisualAvailable = false;
  let imageIsEmergency = false;

  try {
    const attachments = await repo.getAttachments(ticketId);
    const imageAttachments = attachments.filter(a => IMAGE_MIMES.includes(a.file_type));

    if (imageAttachments.length > 0) {
      const buffers = [];
      for (const att of imageAttachments) {
        try {
          const filePath = att.file_key.startsWith('/') || att.file_key.includes(':\\')
            ? att.file_key
            : path.join(UPLOADS_PATH, att.file_key);
          const buffer = await fs.readFile(filePath);
          buffers.push(buffer);
        } catch { }
      }

      if (buffers.length > 0) {
        const rawResults = await Promise.all(buffers.map(async (buffer) => {
          const mod = await moderateImage(buffer);
          if (!mod.safe) return null;
          const labels = await detectLabels(buffer);
          if (labels) {
            await logSingleInference(ticketId, 'REKOGNITION', labels);
          }
          return labels;
        }));

        const validResults = rawResults.filter(r => r !== null);
        if (validResults.length > 0) {
          validResults.sort((a, b) => b.confidence - a.confidence);
          visualResult = validResults[0];
          awsVisualAvailable = visualResult.service === 'REKOGNITION';
          imageIsEmergency = validResults.some(r => r.category === 'Emergency');
        }
      }
    }
  } catch { }

  const opts = { imageIsEmergency, awsTextAvailable, awsVisualAvailable };

  const classification = classify(
    { category: textResult.category, confidence: textResult.confidence, service: textResult.service },
    { category: visualResult.category, confidence: visualResult.confidence, service: visualResult.service },
    opts
  );

  return persistClassification(ticketId, textResult, visualResult, classification);
}

async function create(data, userId) {
  const duplicates = await checkForDuplicate(data.unit_id, data.title, data.description);

  if (duplicates.length > 0 && !data.force) {
    const best = duplicates[0];
    return {
      success: false,
      duplicates: true,
      matches: duplicates,
      message: best.matchReason,
      bestScore: best.similarityScore,
    };
  }

  const ticket = await repo.create({ ...data, tenant_id: userId, status: 'New' });
  await attachSlaDeadlines([ticket]);
  await repo.addHistory(ticket.id, ticket.status, userId, null, 'Ticket created');
  await auditLog(ticket.id, 'created', userId, null, { status: ticket.status, title: ticket.title });
  runAiPipeline(ticket.id).catch(() => {});

  if (ticket.unit_id) {
    (async () => {
      try {
        const unitRow = (await query(
          `SELECT u.property_id, u.unit_number FROM units u WHERE u.id = $1`, [ticket.unit_id]
        )).rows[0];

        ticket.unit_number = unitRow?.unit_number || null;

        if (unitRow?.property_id) {
          const propRow = (await query(
            `SELECT p.id, p.name, p.manager_id FROM properties p WHERE p.id = $1`, [unitRow.property_id]
          )).rows[0];
          ticket.property_name = propRow?.name || null;

          if (propRow?.manager_id) {
            sendTicketCreatedNotification(propRow.manager_id, ticket).catch(() => {});
          }
        }
      } catch (e) {
        console.error('Ticket creation notification failed:', e.message);
      }
    })();
  }

  return { success: true, data: { ticket }, message: 'Ticket created' };
}

/* ── Workflow step functions ── */

async function markAiClassified(id, classificationResult) {
  const ticket = await repo.findById(id);
  if (!ticket) throw AppError.notFound('Ticket not found');

  if (isTerminal(ticket.status)) {
    throw AppError.forbidden(`Ticket is ${ticket.status} and cannot be modified`);
  }

  const fromStatus = ticket.status;
  let toStatus = 'AI Classified';

  if (classificationResult.outcome === 'MANUAL_REVIEW') {
    toStatus = 'Manual Review';
  } else if (classificationResult.visualEmergency) {
    toStatus = 'ESCALATED';
  }

  if (!isValidTransition(fromStatus, toStatus)) {
    const allowed = fromStatus;
    if (fromStatus === 'New' || fromStatus === 'Manual Review') {
    } else {
      toStatus = fromStatus;
    }
  }

  const updates = {
    ai_text_label: classificationResult.textLabel,
    ai_visual_label: classificationResult.imageLabel,
    ai_text_confidence: classificationResult.textConfidence,
    ai_visual_confidence: classificationResult.imageConfidence,
    conflict_detected: classificationResult.conflictDetected,
    status: toStatus,
  };

  if (classificationResult.visualEmergency) {
    updates.visual_emergency = true;
    updates.visual_emergency_escalated_by = 'AI';
  }

  if (classificationResult.combinedConfidence < 0.6 && classificationResult.outcome !== 'EMERGENCY') {
    updates.pm_confirmed = false;
  }

  await repo.update(id, updates);
  await repo.addHistory(id, toStatus, null, 'AI', `AI classification: ${classificationResult.outcome}`);
  await auditLog(ticket.id, 'ai_classified', null, 'AI', {
    classification: classificationResult,
  });

  return { success: true, data: { classification: classificationResult } };
}

async function update(id, data, userId, userName, role) {
  const ticket = await repo.findById(id);
  if (!ticket) throw AppError.notFound('Ticket not found');
  await assertNotReadOnly(ticket);
  const updated = await repo.update(id, data);
  await auditLog(ticket.id, 'updated', userId, userName, { changes: data });
  return { success: true, data: { ticket: updated }, message: 'Ticket updated' };
}

async function changeStatus(id, status, reason, userId, userName, role) {
  const ticket = await repo.findById(id);
  if (!ticket) throw AppError.notFound('Ticket not found');
  await assertNotReadOnly(ticket);

  if (status === 'Reopened') {
    if (!REOPENABLE_FROM.includes(ticket.status)) {
      throw AppError.badRequest(`Only ${REOPENABLE_FROM.join(' or ')} tickets can be reopened`);
    }
    if (role === 'TENANT') {
      throw AppError.forbidden('Only a Property Manager can reopen tickets');
    }
    if (!reason || reason.trim().length === 0) {
      throw AppError.badRequest('A justification is required to reopen this ticket');
    }
  }

  if (!isValidTransition(ticket.status, status)) {
    throw AppError.badRequest(`Cannot transition from '${ticket.status}' to '${status}'`);
  }

  const updated = await repo.update(id, { status });
  await repo.addHistory(id, status, userId, userName, reason);
  await auditLog(ticket.id, `status.${status}`, userId, userName, {
    from: ticket.status, to: status, reason,
  });

  const sla = await checkTicketSla(updated);
  if (sla.warning && updated.tenant_id) {
    sendToUser(updated.tenant_id, 'sla_warning', { ticketId: id, priority: updated.priority, deadline: sla.responseDeadline });
  }

  if (updated.tenant_id) {
    sendTicketStatusChangedNotification(
      updated.tenant_id, updated, status, ticket.status, reason
    ).catch(() => {});
  }

  return { success: true, data: { ticket: updated }, message: 'Status updated' };
}

async function assign(id, technicianId, note, userId, userName, role) {
  const ticket = await repo.findById(id);
  if (!ticket) throw AppError.notFound('Ticket not found');
  await assertNotReadOnly(ticket);

  if (ticket.assigned_to && role !== 'PROPERTY_MANAGER' && role !== 'SYSTEM_ADMIN') {
    throw AppError.forbidden('Only a Property Manager can reassign providers');
  }
  if (role !== 'PROPERTY_MANAGER' && role !== 'SYSTEM_ADMIN') {
    throw AppError.forbidden('Only a Property Manager can assign providers');
  }

  await assertRoutingAllowed(ticket);

  const provider = await findServiceProvider(technicianId);
  if (!provider) throw AppError.notFound('Service provider not found');

  const updated = await repo.update(id, {
    assigned_to: technicianId,
    status: 'Assigned',
    auto_assigned: false,
    auto_assigned_at: null,
    no_provider_flagged_at: null,
    postponed_until: null,
    postponed_reason: null,
  });
  await query(
    `UPDATE low_confidence_queue SET status = 'resolved'
     WHERE ticket_id = $1 AND status = 'pending'`,
    [id]
  );
  await repo.addHistory(id, 'Assigned', userId, userName, note || `Assigned to ${provider.name}`);
  await auditLog(ticket.id, 'assigned', userId, userName, {
    providerId: technicianId, provider: provider.name, note,
  });

  // BUG FIX: technicianId is a service_providers.id, but the provider's
  // real login/notification identity is a users.id — a different UUID,
  // joined only by matching email (see resolveProviderUserId). The old
  // code here called sendTicketAssignedNotification(technicianId, ...)
  // directly, which silently did nothing for manually-assigned providers:
  // it looked up a "user" by a service_providers id, found nothing, and
  // the email never sent. No persisted notification or live push existed
  // for this path at all, so a manually-assigned provider previously had
  // no way to find out a job existed until they happened to check MyJobs.
  const providerUserId = await resolveProviderUserId(technicianId);
  if (providerUserId) {
    await notificationsRepo.create({
      user_id: providerUserId,
      type: 'assignment',
      title: 'New job assigned',
      body: `Ticket "${updated.title}" (${updated.priority}) was assigned to you by ${userName}. Tap to accept or decline.`,
      is_emergency: updated.priority === 'EMERGENCY',
      ticket_id: id,
    }).catch(() => {});

    sendToUser(providerUserId, 'job_assigned', {
      ticketId: id, title: updated.title, providerId: technicianId,
    });

    sendTicketAssignedNotification(providerUserId, updated).catch(() => {});
  }

  return { success: true, data: { ticket: updated }, message: `Assigned to ${provider.name}` };
}

async function acceptTicket(id, userId, userName, note) {
  const updated = await performTransition(id, TicketStates.ACCEPTED, userId, userName,
    note || 'Provider accepted the assignment', 'ticket_accepted');
  return { success: true, data: { ticket: updated }, message: 'Ticket accepted' };
}

async function declineTicket(id, userId, userName, note, postponeUntil) {
  const ticket = await repo.findById(id);
  if (!ticket) throw AppError.notFound('Ticket not found');
  await assertNotReadOnly(ticket);

  if (!isValidTransition(ticket.status, TicketStates.DECLINED)) {
    throw AppError.badRequest(`Cannot decline a '${ticket.status}' ticket`);
  }

  let parsedUntil = null;
  if (postponeUntil) {
    parsedUntil = new Date(postponeUntil);
    if (Number.isNaN(parsedUntil.getTime())) {
      throw AppError.badRequest('postponeUntil must be a valid date/time');
    }
  }

  const updates = { status: TicketStates.DECLINED, assigned_to: null };
  if (parsedUntil) updates.postponed_until = parsedUntil;
  if (note) updates.postponed_reason = note;

  const updated = await repo.update(id, updates);
  await repo.addHistory(id, TicketStates.DECLINED, userId, userName,
    note || 'Provider declined the assignment');
  await auditLog(ticket.id, 'declined', userId, userName, {
    from: ticket.status, postponeUntil: parsedUntil ? parsedUntil.toISOString() : null, note,
  });

  if (updated.tenant_id) {
    // Was previously an SSE-only ping — invisible to the tenant unless their
    // browser happened to be open at that exact moment, and never showed up
    // later in their Notifications page or inbox. Now persisted (so it's
    // there on next login/refresh regardless) + emailed, same pattern used
    // for every other ticket status change.
    const declineMessage = parsedUntil
      ? `${userName} declined your ticket "${ticket.title}" and requested to postpone until ${parsedUntil.toLocaleDateString()}.${note ? ` Reason: ${note}` : ''}`
      : `${userName} declined your ticket "${ticket.title}".${note ? ` Reason: ${note}` : ''}`;

    await notificationsRepo.create({
      user_id: updated.tenant_id,
      type: 'status',
      title: 'Service provider declined your ticket',
      body: declineMessage,
      is_emergency: ticket.priority === 'EMERGENCY',
      ticket_id: id,
    }).catch(() => {});

    sendToUser(updated.tenant_id, 'ticket_declined', {
      ticketId: id, title: ticket.title, status: TicketStates.DECLINED,
    });

    sendTicketStatusChangedNotification(
      updated.tenant_id, updated, TicketStates.DECLINED, ticket.status, note
    ).catch(() => {});
  }

  /* BUG FIX: reassignAfterDecline() only excludes providers who already have
   * a routing_assignments row for this ticket — but that table is only ever
   * written by the *auto*-routing flow. A manually-assigned ticket has no
   * such row at all, so the provider who just declined it wasn't excluded
   * from anything, and pickProviders() could legitimately re-offer the same
   * ticket right back to them. Record this decline here too, regardless of
   * how the ticket got assigned, so the exclusion actually works.
   */
  if (ticket.assigned_to) {
    await query(
      `INSERT INTO routing_assignments (ticket_id, provider_id, assignment_type, status, responded_at)
       VALUES ($1, $2, 'manual', 'declined', NOW())`,
      [id, ticket.assigned_to]
    ).catch(() => {});
  }

  /* §4 — a decline must trigger real fallback (unless the provider is
   * postponing, in which case the ticket stays open for them later):
   * auto-move to the next-ranked candidate from the original scoring. */
  if (!parsedUntil) {
    const fallback = await reassignAfterDecline(id);
    if (fallback.success) {
      return {
        success: true,
        data: { ticket: { ...updated, assigned_to: fallback.data.provider.id, status: 'Assigned', auto_assigned: true } },
        message: `Provider declined — automatically reassigned to ${fallback.data.provider.name}`,
      };
    }
    return {
      success: true,
      data: { ticket: updated },
      message: 'Provider declined — no automatic fallback available; flagged for manager attention',
    };
  }

  const message = parsedUntil
    ? `Ticket declined — postponed to ${parsedUntil.toLocaleString()}`
    : 'Ticket declined';
  return { success: true, data: { ticket: updated }, message };
}

async function startWork(id, userId, userName, note) {
  const updated = await performTransition(id, TicketStates.IN_PROGRESS, userId, userName,
    note || 'Work started', 'ticket_in_progress');
  return { success: true, data: { ticket: updated }, message: 'Work started' };
}

async function markWaitingParts(id, userId, userName, note) {
  const updated = await performTransition(id, TicketStates.WAITING_FOR_PARTS, userId, userName,
    note || 'Waiting for parts', 'ticket_waiting_parts');
  return { success: true, data: { ticket: updated }, message: 'Waiting for parts' };
}

async function markPartsReceived(id, userId, userName, note) {
  const updated = await performTransition(id, TicketStates.IN_PROGRESS, userId, userName,
    note || 'Parts received, resuming work', 'ticket_parts_received');
  return { success: true, data: { ticket: updated }, message: 'Parts received, work resumed' };
}

async function complete(id, userId) {
  const updated = await performTransition(id, TicketStates.COMPLETED, userId, null,
    'Job completed', 'ticket_completed');
  return { success: true, data: { ticket: updated }, message: 'Ticket completed' };
}

async function tenantConfirm(id, userId, userName, satisfied, note) {
  const fromStatus = (await repo.findById(id)).status;
  if (fromStatus !== 'Completed') {
    throw AppError.badRequest('Only completed tickets can be confirmed by tenant');
  }

  if (satisfied === false) {
    const updated = await repo.update(id, { status: 'Reopened' });
    await repo.addHistory(id, 'Reopened', userId, null, note || 'Tenant not satisfied — reopened');
    await auditLog(id, 'tenant_rejected', userId, userName, { note });
    sendToUser(id, 'ticket_reopened', { ticketId: id, reason: note });
    return { success: true, data: { ticket: updated }, message: 'Ticket reopened — tenant not satisfied' };
  }

  const updated = await performTransition(id, TicketStates.TENANT_CONFIRMED, userId, userName,
    note || 'Tenant confirmed completion', 'ticket_confirmed');
  return { success: true, data: { ticket: updated }, message: 'Tenant confirmed completion' };
}

async function closeTicket(id, userId, userName, note) {
  const updated = await performTransition(id, TicketStates.CLOSED, userId, userName,
    note || 'Ticket closed', 'ticket_closed');
  return { success: true, data: { ticket: updated }, message: 'Ticket closed' };
}

async function reopen(id, reason, userId) {
  const ticket = await repo.findById(id);
  if (!ticket) throw AppError.notFound('Ticket not found');
  if (!REOPENABLE_FROM.includes(ticket.status)) {
    throw AppError.badRequest(`Only ${REOPENABLE_FROM.join(' or ')} tickets can be reopened`);
  }
  if (!reason || reason.trim().length === 0) {
    throw AppError.badRequest('A justification is required to reopen this ticket');
  }
  const updated = await repo.update(id, { status: 'Reopened' });
  await repo.addHistory(id, 'Reopened', userId, null, reason);
  await auditLog(ticket.id, 'reopened', userId, null, { reason });
  return { success: true, data: { ticket: updated }, message: 'Ticket reopened' };
}

async function rate(id, userId, ratingValue, comment) {
  const ticket = await repo.findById(id);
  if (!ticket) throw AppError.notFound('Ticket not found');
  if (ticket.tenant_id !== userId) {
    throw AppError.forbidden('Only the ticket creator can rate');
  }
  await repo.addRating(id, userId, ratingValue, comment);
  await auditLog(ticket.id, 'rated', userId, null, { rating: ratingValue });
  return { success: true, message: 'Rating submitted' };
}

async function classifyTicket(id, textResult, visualResult, opts = {}, debugOverride = false) {
  if (debugOverride) {
    const ticket = await repo.findById(id);
    if (!ticket) throw AppError.notFound('Ticket not found');

    const classification = classify(textResult, visualResult, opts);

    const updates = {
      ai_text_label: classification.textLabel,
      ai_visual_label: classification.imageLabel,
      ai_text_confidence: classification.textConfidence,
      ai_visual_confidence: classification.imageConfidence,
      conflict_detected: classification.conflictDetected,
    };

    if (classification.visualEmergency) {
      updates.status = 'ESCALATED';
      updates.visual_emergency = true;
      updates.visual_emergency_escalated_by = 'AI';
      updates.priority = 'EMERGENCY';
    }

    if (classification.combinedConfidence < 0.60 && classification.outcome !== 'EMERGENCY') {
      updates.pm_confirmed = false;
    }

    if (classification.outcome === 'MANUAL_REVIEW') {
      updates.status = 'Manual Review';
    }

    await repo.update(id, updates);
    await repo.addHistory(id, updates.status || ticket.status, null, 'AI', `AI classification: ${classification.outcome}`);
    await auditLog(ticket.id, 'ai_classified', null, 'AI', { classification });

    return { success: true, data: { classification } };
  }

  const result = await runAiPipeline(id);
  if (!result) throw AppError.notFound('Ticket not found');
  return { success: true, data: { classification: result.classification } };
}

async function confirmLowConfidence(id, userId) {
  const ticket = await repo.findById(id);
  if (!ticket) throw AppError.notFound('Ticket not found');
  await repo.update(id, {
    pm_confirmed: true,
    pm_confirmed_by: userId,
    pm_confirmed_at: new Date(),
  });
  await auditLog(ticket.id, 'pm_confirmed', userId, null, {});
  return { success: true, message: 'Ticket confirmed for routing' };
}

async function overrideAiLabel(id, correctedLabel, userId, userName) {
  const ticket = await repo.findById(id);
  if (!ticket) throw AppError.notFound('Ticket not found');

  await repo.update(id, {
    category: correctedLabel,
    ai_category: correctedLabel,
    ai_original_label: ticket.ai_visual_label || ticket.ai_text_label || ticket.category,
    ai_corrected_label: correctedLabel,
    ai_overridden_by: userId,
    ai_overridden_at: new Date(),
  });
  await auditLog(ticket.id, 'ai_overridden', userId, userName, {
    original: ticket.ai_visual_label || ticket.ai_text_label,
    corrected: correctedLabel,
  });
  return { success: true, message: 'AI label overridden' };
}

async function downgradeVisualEmergency(id, userId, userName) {
  const ticket = await repo.findById(id);
  if (!ticket) throw AppError.notFound('Ticket not found');
  if (!ticket.visual_emergency) {
    throw AppError.badRequest('Ticket is not in visual emergency state');
  }
  await repo.update(id, {
    visual_emergency: false,
    visual_emergency_downgraded_by: userId,
    visual_emergency_downgraded_at: new Date(),
    status: 'Manual Review',
  });
  await auditLog(ticket.id, 'visual_emergency_downgraded', userId, userName, {});
  return { success: true, message: 'Visual emergency downgraded to Manual Review' };
}

async function getTopProviders(id) {
  const ticket = await repo.findById(id);
  if (!ticket) throw AppError.notFound('Ticket not found');
  const top3 = await scoreProviders(ticket);
  return { success: true, data: { providers: top3 } };
}

async function checkSla(id) {
  const ticket = await repo.findById(id);
  if (!ticket) throw AppError.notFound('Ticket not found');
  const sla = await checkTicketSla(ticket);
  return { success: true, data: { sla } };
}

async function softDelete(id, userId, userName) {
  const ticket = await repo.findById(id);
  if (!ticket) throw AppError.notFound('Ticket not found');
  const updated = await repo.softDelete(id, userId);
  await repo.addHistory(id, ticket.status, userId, userName, 'Ticket moved to trash');
  await auditLog(id, 'trashed', userId, userName, { title: ticket.title });
  return { success: true, message: 'Ticket moved to trash', data: { ticket: updated } };
}

async function restore(id, userId, userName) {
  const ticket = await repo.findByIdIncludingDeleted(id);
  if (!ticket) throw AppError.notFound('Ticket not found');
  if (!ticket.deleted_at) throw AppError.badRequest('Ticket is not in trash');
  const updated = await repo.restore(id);
  await repo.addHistory(id, updated.status, userId, userName, 'Ticket restored from trash');
  await auditLog(id, 'restored', userId, userName, { title: updated.title });
  return { success: true, message: 'Ticket restored from trash', data: { ticket: updated } };
}

export {
  list, getById, create, update, changeStatus, assign, complete, reopen, rate,
  classifyTicket, confirmLowConfidence, overrideAiLabel, downgradeVisualEmergency,
  getTopProviders, checkSla, softDelete, restore,
  markAiClassified, acceptTicket, declineTicket, startWork, markWaitingParts, markPartsReceived,
  tenantConfirm, closeTicket, runAiPipeline,
};

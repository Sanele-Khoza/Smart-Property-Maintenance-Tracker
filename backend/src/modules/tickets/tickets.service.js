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
import { checkTicketSla } from '../../shared/utils/slaChecker.js';
import { scoreProviders } from '../../shared/utils/routingScore.js';
import { sendToUser } from '../../shared/utils/sse.js';
import { classifyText } from '../../shared/adapters/comprehendAdapter.js';
import { moderateImage, detectLabels } from '../../shared/adapters/rekognitionAdapter.js';
import { persistClassification, logSingleInference } from '../ai/ai.service.js';
import { checkForDuplicate } from '../ai/duplicateDetector.js';
import { getPresignedUrl } from '../../shared/adapters/s3Adapter.js';
import config from '../../config/index.js';

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
      ticketId, priority: updated.priority, deadline: sla.responseDeadline,
    });
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

async function withAttachmentUrl(attachment) {
  const presigned = await getPresignedUrl(attachment.file_key);
  return { ...attachment, url: presigned || `/uploads/${attachment.file_key}` };
}

async function attachPhotos(tickets) {
  const grouped = await repo.getAttachmentsByTicketIds(tickets.map(t => t.id));
  await Promise.all(tickets.map(async (ticket) => {
    const attachments = await Promise.all((grouped[ticket.id] || []).map(withAttachmentUrl));
    ticket.attachments = attachments;
  }));
  return tickets;
}

async function list(filters) {
  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 20;
  const offset = (page - 1) * limit;
  const queryFilters = { ...filters, limit, offset };
  const { tickets, total } = await repo.findAll(queryFilters);
  await attachPhotos(tickets);
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
  const attachments = await repo.getAttachments(id);
  ticket.attachments = await Promise.all(attachments.map(withAttachmentUrl));
  return { success: true, data: { ticket, history, comments } };
}

async function runAiPipeline(ticketId) {
  const ticket = await repo.findById(ticketId);
  if (!ticket) return null;

  let textResult = { category: null, confidence: 0, service: 'none' };
  let awsTextAvailable = false;
  if (ticket.description) {
    textResult = await classifyText(ticket.description);
    awsTextAvailable = textResult.service === 'COMPREHEND';
    await logSingleInference(ticketId, 'COMPREHEND', textResult);
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
  await repo.addHistory(ticket.id, ticket.status, userId, null, 'Ticket created');
  await auditLog(ticket.id, 'created', userId, null, { status: ticket.status, title: ticket.title });
  runAiPipeline(ticket.id).catch(() => {});
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
  });
  await repo.addHistory(id, 'Assigned', userId, userName, note || `Assigned to ${provider.name}`);
  await auditLog(ticket.id, 'assigned', userId, userName, {
    providerId: technicianId, provider: provider.name, note,
  });

  return { success: true, data: { ticket: updated }, message: `Assigned to ${provider.name}` };
}

async function acceptTicket(id, userId, userName, note) {
  const updated = await performTransition(id, TicketStates.ACCEPTED, userId, userName,
    note || 'Provider accepted the assignment', 'ticket_accepted');
  return { success: true, data: { ticket: updated }, message: 'Ticket accepted' };
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

export {
  list, getById, create, update, changeStatus, assign, complete, reopen, rate,
  classifyTicket, confirmLowConfidence, overrideAiLabel, downgradeVisualEmergency,
  getTopProviders, checkSla,
  markAiClassified, acceptTicket, startWork, markWaitingParts, markPartsReceived,
  tenantConfirm, closeTicket, runAiPipeline,
};

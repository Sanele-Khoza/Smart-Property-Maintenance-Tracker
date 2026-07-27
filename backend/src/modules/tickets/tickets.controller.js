import { query } from '../../db/connection.js';
import AppError from '../../shared/errors/AppError.js';
import * as service from './tickets.service.js';
import * as repo from './tickets.repository.js';
import { classifyTicket } from '../ai/ai.service.js';
import { runAiPipeline } from './tickets.service.js';
import { getPresignedUrl } from '../../shared/adapters/s3Adapter.js';
import config from '../../config/index.js';

async function resolveProviderId(email) {
  const result = await query('SELECT id FROM service_providers WHERE email = $1', [email]);
  return result.rows[0]?.id || null;
}

async function verifyTicketAccess(ticket, user) {
  if (user.role === 'TENANT' && ticket.tenant_id !== user.id) {
    throw AppError.forbidden('Access denied');
  }
  if (user.role === 'SERVICE_PROVIDER') {
    const providerId = await resolveProviderId(user.email);
    if (providerId && ticket.assigned_to !== providerId) {
      throw AppError.forbidden('Access denied');
    }
  }
}

async function injectScopeFilters(filters, user) {
  if (user.role === 'TENANT') {
    filters.tenant_id = user.id;
  } else if (user.role === 'SERVICE_PROVIDER') {
    const providerId = await resolveProviderId(user.email);
    if (providerId) filters.assigned_to = providerId;
  }
  return filters;
}

const list = async (req, res, next) => {
  try {
    const filters = await injectScopeFilters({ ...req.query }, req.user);
    const result = await service.list(filters);
    res.json(result);
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const result = await service.getById(req.params.id);
    if (req.user.role !== 'SYSTEM_ADMIN' && req.user.role !== 'PROPERTY_MANAGER') {
      await verifyTicketAccess(result.data.ticket, req.user);
    }
    res.json(result);
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const result = await service.create(req.validatedBody, req.user.id);
    if (result.duplicates) {
      return res.status(409).json(result);
    }
    if (result.success && result.data?.ticket?.id) {
      classifyTicket(result.data.ticket.id).catch(() => {});
    }
    res.status(201).json(result);
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const ticket = await repo.findById(req.params.id);
    if (!ticket) throw AppError.notFound('Ticket not found');
    if (req.user.role !== 'SYSTEM_ADMIN' && req.user.role !== 'PROPERTY_MANAGER') {
      await verifyTicketAccess(ticket, req.user);
    }
    const result = await service.update(req.params.id, req.validatedBody, req.user.id, req.user.name, req.user.role);
    res.json(result);
  } catch (err) { next(err); }
};

const changeStatus = async (req, res, next) => {
  try {
    const ticket = await repo.findById(req.params.id);
    if (!ticket) throw AppError.notFound('Ticket not found');
    if (req.user.role !== 'SYSTEM_ADMIN' && req.user.role !== 'PROPERTY_MANAGER') {
      await verifyTicketAccess(ticket, req.user);
    }
    const { status, reason } = req.validatedBody;
    const name = req.user ? `${req.user.name} ${req.user.surname}` : null;
    const result = await service.changeStatus(req.params.id, status, reason, req.user?.id, name, req.user.role);
    res.json(result);
  } catch (err) { next(err); }
};

const assign = async (req, res, next) => {
  try {
    const name = `${req.user.name} ${req.user.surname}`;
    const result = await service.assign(req.params.id, req.validatedBody.technician_id, req.validatedBody.note, req.user.id, name, req.user.role);
    res.json(result);
  } catch (err) { next(err); }
};

const classify = async (req, res, next) => {
  try {
    const { textResult, visualResult, opts, debugOverride } = req.body;
    const isAdmin = req.user?.role === 'SYSTEM_ADMIN';
    const result = await service.classifyTicket(
      req.params.id, textResult, visualResult, opts,
      debugOverride === true && isAdmin
    );
    res.json(result);
  } catch (err) { next(err); }
};

const confirm = async (req, res, next) => {
  try {
    const result = await service.confirmLowConfidence(req.params.id, req.user.id);
    res.json(result);
  } catch (err) { next(err); }
};

const overrideAi = async (req, res, next) => {
  try {
    const { correctedLabel } = req.body;
    if (!correctedLabel) throw AppError.badRequest('correctedLabel is required');
    const name = `${req.user.name} ${req.user.surname}`;
    const result = await service.overrideAiLabel(req.params.id, correctedLabel, req.user.id, name);
    res.json(result);
  } catch (err) { next(err); }
};

const downgradeEmergency = async (req, res, next) => {
  try {
    if (req.user.role !== 'SYSTEM_ADMIN') throw AppError.forbidden('Only SysAdmin can downgrade visual emergency');
    const name = `${req.user.name} ${req.user.surname}`;
    const result = await service.downgradeVisualEmergency(req.params.id, req.user.id, name);
    res.json(result);
  } catch (err) { next(err); }
};

/* ── Workflow step handlers ── */

const accept = async (req, res, next) => {
  try {
    const name = `${req.user.name} ${req.user.surname}`;
    const result = await service.acceptTicket(req.params.id, req.user.id, name, req.body.note);
    res.json(result);
  } catch (err) { next(err); }
};

const startWork = async (req, res, next) => {
  try {
    const name = `${req.user.name} ${req.user.surname}`;
    const result = await service.startWork(req.params.id, req.user.id, name, req.body.note);
    res.json(result);
  } catch (err) { next(err); }
};

const waitingParts = async (req, res, next) => {
  try {
    const name = `${req.user.name} ${req.user.surname}`;
    const result = await service.markWaitingParts(req.params.id, req.user.id, name, req.body.note);
    res.json(result);
  } catch (err) { next(err); }
};

const partsReceived = async (req, res, next) => {
  try {
    const name = `${req.user.name} ${req.user.surname}`;
    const result = await service.markPartsReceived(req.params.id, req.user.id, name, req.body.note);
    res.json(result);
  } catch (err) { next(err); }
};

const complete = async (req, res, next) => {
  try {
    const ticket = await repo.findById(req.params.id);
    if (!ticket) throw AppError.notFound('Ticket not found');
    if (req.user.role !== 'SYSTEM_ADMIN' && req.user.role !== 'PROPERTY_MANAGER') {
      await verifyTicketAccess(ticket, req.user);
    }
    const result = await service.complete(req.params.id, req.user.id);
    res.json(result);
  } catch (err) { next(err); }
};

const tenantConfirm = async (req, res, next) => {
  try {
    const name = `${req.user.name} ${req.user.surname}`;
    const result = await service.tenantConfirm(req.params.id, req.user.id, name, req.body.satisfied, req.body.note);
    res.json(result);
  } catch (err) { next(err); }
};

const close = async (req, res, next) => {
  try {
    const name = `${req.user.name} ${req.user.surname}`;
    const result = await service.closeTicket(req.params.id, req.user.id, name, req.body.note);
    res.json(result);
  } catch (err) { next(err); }
};

const reopen = async (req, res, next) => {
  try {
    const ticket = await repo.findById(req.params.id);
    if (!ticket) throw AppError.notFound('Ticket not found');
    if (req.user.role !== 'SYSTEM_ADMIN' && req.user.role !== 'PROPERTY_MANAGER') {
      await verifyTicketAccess(ticket, req.user);
    }
    const result = await service.reopen(req.params.id, req.validatedBody.reason, req.user.id);
    res.json(result);
  } catch (err) { next(err); }
};

const rate = async (req, res, next) => {
  try {
    const result = await service.rate(req.params.id, req.user.id, req.body.rating, req.body.comment);
    res.json(result);
  } catch (err) { next(err); }
};

const getHistory = async (req, res, next) => {
  try {
    const result = await service.getById(req.params.id);
    if (req.user.role !== 'SYSTEM_ADMIN' && req.user.role !== 'PROPERTY_MANAGER') {
      await verifyTicketAccess(result.data.ticket, req.user);
    }
    const history = await repo.getHistory(req.params.id);
    res.json({ success: true, data: { history } });
  } catch (err) { next(err); }
};

const getComments = async (req, res, next) => {
  try {
    const result = await service.getById(req.params.id);
    if (req.user.role !== 'SYSTEM_ADMIN' && req.user.role !== 'PROPERTY_MANAGER') {
      await verifyTicketAccess(result.data.ticket, req.user);
    }
    const comments = await repo.getComments(req.params.id);
    res.json({ success: true, data: { comments } });
  } catch (err) { next(err); }
};

const addComment = async (req, res, next) => {
  try {
    const ticket = await repo.findById(req.params.id);
    if (!ticket) throw AppError.notFound('Ticket not found');
    if (req.user.role !== 'SYSTEM_ADMIN' && req.user.role !== 'PROPERTY_MANAGER') {
      await verifyTicketAccess(ticket, req.user);
    }
    const comment = await repo.addComment(req.params.id, req.user.id, req.body.comment);
    res.status(201).json({ success: true, data: { comment }, message: 'Comment added' });
  } catch (err) { next(err); }
};

const getAttachments = async (req, res, next) => {
  try {
    const ticket = await repo.findById(req.params.id);
    if (!ticket) throw AppError.notFound('Ticket not found');
    if (req.user.role !== 'SYSTEM_ADMIN' && req.user.role !== 'PROPERTY_MANAGER') {
      await verifyTicketAccess(ticket, req.user);
    }
    const attachments = await repo.getAttachments(req.params.id);
    res.json({ success: true, data: { attachments } });
  } catch (err) { next(err); }
};

const addAttachment = async (req, res, next) => {
  try {
    const ticket = await repo.findById(req.params.id);
    if (!ticket) throw AppError.notFound('Ticket not found');
    if (req.user.role !== 'SYSTEM_ADMIN' && req.user.role !== 'PROPERTY_MANAGER') {
      await verifyTicketAccess(ticket, req.user);
    }
    if (!req.file) throw AppError.badRequest('No file uploaded');
    const attachment = await repo.addAttachment(req.params.id, req.file, req.user.id);
    if (req.moderated) {
      runAiPipeline(req.params.id).catch(() => {});
    }
    res.status(201).json({ success: true, data: { attachment }, message: 'File attached' });
  } catch (err) { next(err); }
};

const removeAttachment = async (req, res, next) => {
  try {
    const ticket = await repo.findById(req.params.id);
    if (!ticket) throw AppError.notFound('Ticket not found');
    if (req.user.role !== 'SYSTEM_ADMIN' && req.user.role !== 'PROPERTY_MANAGER') {
      await verifyTicketAccess(ticket, req.user);
    }
    await repo.removeAttachment(req.params.id, req.params.attachmentId);
    res.json({ success: true, message: 'Attachment removed' });
  } catch (err) { next(err); }
};

const getAttachmentUrl = async (req, res, next) => {
  try {
    const ticket = await repo.findById(req.params.id);
    if (!ticket) throw AppError.notFound('Ticket not found');
    if (req.user.role !== 'SYSTEM_ADMIN' && req.user.role !== 'PROPERTY_MANAGER') {
      await verifyTicketAccess(ticket, req.user);
    }
    const attachment = await repo.getAttachmentById(req.params.attachmentId);
    if (!attachment || attachment.ticket_id !== req.params.id) {
      throw AppError.notFound('Attachment not found');
    }
    const isImage = attachment.file_type?.startsWith('image/');
    const ttl = isImage ? config.aws.s3.presignedUrlTtlImages : config.aws.s3.presignedUrlTtlReports;
    const url = await getPresignedUrl(attachment.file_key, undefined, ttl);
    res.json({ success: true, data: { url, ttl, key: attachment.file_key } });
  } catch (err) { next(err); }
};

const routing = async (req, res, next) => {
  try {
    const result = await service.getTopProviders(req.params.id);
    res.json(result);
  } catch (err) { next(err); }
};

const sla = async (req, res, next) => {
  try {
    const result = await service.checkSla(req.params.id);
    res.json(result);
  } catch (err) { next(err); }
};

export {
  list, getById, create, update, changeStatus, assign, complete, reopen, rate,
  getHistory, getComments, addComment, getAttachments, addAttachment, removeAttachment,
  classify, confirm, overrideAi, downgradeEmergency, getAttachmentUrl, routing, sla,
  accept, startWork, waitingParts, partsReceived, tenantConfirm, close,
};

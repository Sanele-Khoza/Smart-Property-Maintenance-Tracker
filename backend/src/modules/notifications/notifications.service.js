import * as repo from './notifications.repository.js';
import AppError from '../../shared/errors/AppError.js';

async function list(req) {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  const filters = {
    read: req.query.read !== undefined ? req.query.read === '1' || req.query.read === 'true' : undefined,
    limit,
    offset,
    type: req.query.type,
  };
  const { notifications, total } = await repo.findForUser(req.user.id, req.user.email, filters);
  return {
    success: true,
    data: { notifications },
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

async function getById(id) {
  const notification = await repo.findById(id);
  if (!notification) throw AppError.notFound('Notification not found');
  return { success: true, data: { notification } };
}

async function create(data) {
  const notification = await repo.create(data);
  return { success: true, data: { notification }, message: 'Notification created' };
}

async function markRead(id) {
  const n = await repo.findById(id);
  if (!n) throw AppError.notFound('Notification not found');
  await repo.markRead(n.id);
  return { success: true, message: 'Marked as read' };
}

async function markAllRead(req) {
  await repo.markAllRead(req.user.id, req.user.email);
  return { success: true, message: 'All marked as read' };
}

async function countUnread(req) {
  const count = await repo.countUnread(req.user.id, req.user.email);
  return { success: true, data: { count } };
}

async function updateStatus(id, deliveryStatus) {
  await repo.findById(id);
  await repo.updateDeliveryStatus(id, deliveryStatus);
  return { success: true, message: 'Status updated' };
}

async function remove(id) {
  await repo.findById(id);
  await repo.remove(id);
  return { success: true, message: 'Deleted' };
}

export { list, getById, create, markRead, markAllRead, countUnread, updateStatus, remove };

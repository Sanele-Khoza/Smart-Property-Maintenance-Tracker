import * as repo from './messages.repository.js';
import AppError from '../../shared/errors/AppError.js';

async function list(req) {
  const messages = await repo.findForUser(req.user.id, { folder: 'inbox' });
  return { success: true, data: { messages } };
}
async function listSent(req) {
  const messages = await repo.findForUser(req.user.id, { folder: 'sent' });
  return { success: true, data: { messages } };
}
async function getById(id) {
  const message = await repo.findById(id);
  if (!message) throw AppError.notFound('Message not found');
  return { success: true, data: { message } };
}
async function send(senderId, data) {
  const message = await repo.create({ ...data, sender_id: senderId });
  return { success: true, data: { message }, message: 'Message sent' };
}
async function markRead(id) {
  const m = await repo.findById(id);
  if (!m) throw AppError.notFound('Message not found');
  await repo.markRead(id);
  return { success: true, message: 'Marked as read' };
}
async function countUnread(userId) {
  const count = await repo.countUnread(userId);
  return { success: true, data: { count } };
}

export { list, listSent, getById, send, markRead, countUnread };

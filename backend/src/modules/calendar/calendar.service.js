import * as repo from './calendar.repository.js';
import AppError from '../../shared/errors/AppError.js';

async function list(filters) {
  const page = parseInt(filters.page) || 1;
  const limit = Math.min(parseInt(filters.limit) || 100, 500);
  const offset = (page - 1) * limit;
  const { events, total } = await repo.findAll({ ...filters, limit, offset });
  return {
    success: true,
    data: { events },
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

async function getById(id) {
  const event = await repo.findById(id);
  if (!event) throw AppError.notFound('Event not found');
  return { success: true, data: { event } };
}

async function create(data, userId) {
  const event = await repo.create({ ...data, created_by: userId });
  return { success: true, data: { event }, message: 'Event created' };
}

async function update(id, data, userId) {
  const event = await repo.findById(id);
  if (!event) throw AppError.notFound('Event not found');
  if (event.created_by !== userId) throw AppError.forbidden('You can only edit your own events');
  const updated = await repo.update(id, data);
  return { success: true, data: { event: updated }, message: 'Event updated' };
}

async function remove(id, userId) {
  const event = await repo.findById(id);
  if (!event) throw AppError.notFound('Event not found');
  if (event.created_by !== userId) throw AppError.forbidden('You can only delete your own events');
  await repo.remove(id);
  return { success: true, message: 'Event deleted' };
}

export { list, getById, create, update, remove };

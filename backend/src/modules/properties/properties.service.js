import * as repo from './properties.repository.js';
import AppError from '../../shared/errors/AppError.js';
import { sendPropertyCreatedNotification } from '../../shared/utils/email.service.js';

async function list(filters) {
  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 20;
  const offset = (page - 1) * limit;
  const { properties, total } = await repo.findAll({ ...filters, limit, offset });
  return {
    success: true,
    data: { properties },
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}
async function getById(id) {
  const property = await repo.findById(id);
  if (!property) throw AppError.notFound('Property not found');
  return { success: true, data: { property } };
}
async function create(data) {
  const property = await repo.create(data);
  if (property.manager_id) {
    sendPropertyCreatedNotification(property.manager_id, property).catch(() => {});
  }
  return { success: true, data: { property }, message: 'Property created' };
}
async function update(id, data) {
  await repo.findById(id);
  const property = await repo.update(id, data);
  return { success: true, data: { property }, message: 'Property updated' };
}
async function remove(id) {
  await repo.findById(id);
  await repo.remove(id);
  return { success: true, message: 'Property deleted' };
}

export { list, getById, create, update, remove };

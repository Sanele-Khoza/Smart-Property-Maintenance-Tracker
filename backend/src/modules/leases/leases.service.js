import * as repo from './leases.repository.js';
import AppError from '../../shared/errors/AppError.js';

async function list(filters) {
  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 20;
  const offset = (page - 1) * limit;
  const { leases, total } = await repo.findAll({ ...filters, limit, offset });
  return {
    success: true,
    data: { leases },
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

async function getById(id) {
  const lease = await repo.findById(id);
  if (!lease) throw AppError.notFound('Lease not found');
  return { success: true, data: { lease } };
}

async function create(data) {
  const existing = await repo.getActiveLeasesByUnit(data.unit_id);
  if (existing.length > 0) throw AppError.conflict('Unit already has an active lease');
  const lease = await repo.create(data);
  return { success: true, data: { lease }, message: 'Lease created successfully' };
}

async function update(id, data) {
  const lease = await repo.findById(id);
  if (!lease) throw AppError.notFound('Lease not found');
  const updated = await repo.update(id, data);
  return { success: true, data: { lease: updated }, message: 'Lease updated successfully' };
}

async function remove(id) {
  const lease = await repo.findById(id);
  if (!lease) throw AppError.notFound('Lease not found');
  await repo.remove(id);
  return { success: true, message: 'Lease deleted successfully' };
}

async function terminate(id) {
  const lease = await repo.findById(id);
  if (!lease) throw AppError.notFound('Lease not found');
  const updated = await repo.update(id, { status: 'TERMINATED', end_date: new Date().toISOString() });
  return { success: true, data: { lease: updated }, message: 'Lease terminated' };
}

async function getMyLeases(userId) {
  const leases = await repo.getActiveLeasesByTenant(userId);
  return { success: true, data: { leases } };
}

export { list, getById, create, update, remove, terminate, getMyLeases };

import * as repo from './technicians.repository.js';
import AppError from '../../shared/errors/AppError.js';

async function list(filters) {
  const technicians = await repo.findAll(filters);
  return { success: true, data: { technicians } };
}

async function getById(id) {
  const technician = await repo.findById(id);
  if (!technician) throw AppError.notFound('Technician not found');
  const availability = await repo.getAvailability(id);
  return { success: true, data: { technician, availability } };
}

async function create(data) {
  const technician = await repo.create(data);
  return { success: true, data: { technician }, message: 'Technician created' };
}

async function update(id, data) {
  await repo.findById(id);
  const technician = await repo.update(id, data);
  return { success: true, data: { technician }, message: 'Technician updated' };
}

async function updateStatus(id, status) {
  await repo.findById(id);
  const technician = await repo.update(id, { availability_status: status });
  return { success: true, data: { technician }, message: 'Status updated' };
}

async function updateLocation(id, latitude, longitude) {
  await repo.findById(id);
  await repo.updateLocation(id, latitude, longitude);
  return { success: true, message: 'Location updated' };
}

async function getAvailability(id) {
  await repo.findById(id);
  const slots = await repo.getAvailability(id);
  return { success: true, data: { slots } };
}

async function addAvailability(id, slotData) {
  await repo.findById(id);
  const slots = await repo.addAvailability(id, slotData);
  return { success: true, data: { slots }, message: 'Availability updated' };
}

async function createProviderForUser(email, extra = {}) {
  const user = await repo.findUserByEmail(email);
  if (!user) return null;
  return repo.create({
    name: `${user.name} ${user.surname}`.trim(),
    companyName: extra.companyName || null,
    email: user.email,
    phone: user.phone || null,
    specialisations: extra.specialisations || [],
  });
}

async function getMe(email) {
  let technician = await repo.findByEmail(email);
  if (!technician) {
    technician = await createProviderForUser(email);
    if (!technician) throw AppError.notFound('Provider record not found');
  }
  return { success: true, data: { technician } };
}

async function updateMe(email, data) {
  let technician = await repo.updateByEmail(email, data);
  if (!technician) {
    technician = await createProviderForUser(email, data);
    if (!technician) throw AppError.notFound('Provider record not found');
  }
  return { success: true, data: { technician }, message: 'Provider details updated' };
}

async function remove(id) {
  await repo.findById(id);
  await repo.remove(id);
  return { success: true, message: 'Technician deleted' };
}

export { list, getById, create, update, updateStatus, updateLocation, getAvailability, addAvailability, remove, getMe, updateMe };

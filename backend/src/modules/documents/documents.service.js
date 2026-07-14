import * as repo from './documents.repository.js';
import AppError from '../../shared/errors/AppError.js';

async function list(filters) {
  const documents = await repo.findAll(filters);
  return { success: true, data: { documents } };
}
async function getById(id) {
  const document = await repo.findById(id);
  if (!document) throw AppError.notFound('Document not found');
  return { success: true, data: { document } };
}
async function create(data, userId) {
  const document = await repo.create({ ...data, uploaded_by: userId });
  return { success: true, data: { document }, message: 'Document uploaded' };
}
async function remove(id) {
  await repo.findById(id);
  await repo.remove(id);
  return { success: true, message: 'Document deleted' };
}

export { list, getById, create, remove };

import * as repo from './categories.repository.js';
import AppError from '../../shared/errors/AppError.js';

async function list() {
  const categories = await repo.findAll();
  return { success: true, data: { categories } };
}
async function getById(id) {
  const category = await repo.findById(id);
  if (!category) throw AppError.notFound('Category not found');
  return { success: true, data: { category } };
}
async function create(data) {
  const existing = await repo.findAll();
  if (existing.find(c => c.name.toLowerCase() === data.name.toLowerCase())) throw AppError.conflict('Category already exists');
  const category = await repo.create(data);
  return { success: true, data: { category }, message: 'Category created' };
}
async function update(id, data) {
  await repo.findById(id);
  const category = await repo.update(id, data);
  return { success: true, data: { category }, message: 'Category updated' };
}
async function remove(id) {
  await repo.findById(id);
  await repo.remove(id);
  return { success: true, message: 'Category deleted' };
}

export { list, getById, create, update, remove };

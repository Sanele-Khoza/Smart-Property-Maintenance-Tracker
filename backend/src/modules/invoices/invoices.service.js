import * as repo from './invoices.repository.js';
import AppError from '../../shared/errors/AppError.js';

async function list(filters) {
  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 20;
  const offset = (page - 1) * limit;
  const { invoices, total } = await repo.findAll({ ...filters, limit, offset });
  return {
    success: true,
    data: { invoices },
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

async function getById(id) {
  const invoice = await repo.findById(id);
  if (!invoice) throw AppError.notFound('Invoice not found');
  return { success: true, data: { invoice } };
}

async function create(data) {
  const invoice = await repo.create(data);
  return { success: true, data: { invoice }, message: 'Invoice created' };
}

async function update(id, data) {
  const invoice = await repo.findById(id);
  if (!invoice) throw AppError.notFound('Invoice not found');
  const updated = await repo.update(id, data);
  return { success: true, data: { invoice: updated }, message: 'Invoice updated' };
}

async function markPaid(id) {
  const invoice = await repo.findById(id);
  if (!invoice) throw AppError.notFound('Invoice not found');
  const updated = await repo.markPaid(id);
  return { success: true, data: { invoice: updated }, message: 'Invoice marked as paid' };
}

async function getMyInvoices(userId) {
  const invoices = await repo.getTenantInvoices(userId);
  return { success: true, data: { invoices } };
}

export { list, getById, create, update, markPaid, getMyInvoices };

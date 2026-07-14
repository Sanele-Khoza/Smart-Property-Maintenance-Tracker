import * as repo from './payments.repository.js';
import * as invoiceRepo from '../invoices/invoices.repository.js';
import AppError from '../../shared/errors/AppError.js';

async function list(filters) {
  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 20;
  const offset = (page - 1) * limit;
  const { payments, total } = await repo.findAll({ ...filters, limit, offset });
  return {
    success: true,
    data: { payments },
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

async function getById(id) {
  const payment = await repo.findById(id);
  if (!payment) throw AppError.notFound('Payment not found');
  return { success: true, data: { payment } };
}

async function create(data) {
  const invoice = await invoiceRepo.findById(data.invoice_id);
  if (!invoice) throw AppError.notFound('Invoice not found');
  if (invoice.status === 'PAID') throw AppError.conflict('Invoice is already paid');

  const payment = await repo.create(data);
  const totalPaid = await getTotalPaid(data.invoice_id);
  if (totalPaid >= parseFloat(invoice.amount)) {
    await invoiceRepo.markPaid(data.invoice_id);
  }
  return { success: true, data: { payment }, message: 'Payment recorded' };
}

async function getInvoicePayments(invoiceId) {
  const payments = await repo.findByInvoice(invoiceId);
  return { success: true, data: { payments } };
}

async function getTotalPaid(invoiceId) {
  const payments = await repo.findByInvoice(invoiceId);
  return payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
}

export { list, getById, create, getInvoicePayments };

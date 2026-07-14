import * as service from './payments.service.js';

const list = async (req, res, next) => {
  try { const result = await service.list(req.query); res.json(result); }
  catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try { const result = await service.getById(req.params.id); res.json(result); }
  catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try { const result = await service.create(req.validatedBody); res.status(201).json(result); }
  catch (err) { next(err); }
};

const byInvoice = async (req, res, next) => {
  try { const result = await service.getInvoicePayments(req.params.invoiceId); res.json(result); }
  catch (err) { next(err); }
};

export { list, getById, create, byInvoice };

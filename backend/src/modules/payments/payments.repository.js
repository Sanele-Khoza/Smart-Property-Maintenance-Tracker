import { query } from '../../db/connection.js';

const findById = async (id) => {
  const result = await query(
    `SELECT p.*, i.invoice_number, i.amount AS invoice_amount
     FROM payments p
     JOIN invoices i ON i.id = p.invoice_id
     WHERE p.id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

const findAll = async (filters = {}) => {
  const conditions = [];
  const params = [];
  let idx = 1;
  if (filters.invoice_id) { conditions.push(`p.invoice_id = $${idx++}`); params.push(filters.invoice_id); }
  if (filters.status) { conditions.push(`p.status = $${idx++}`); params.push(filters.status); }
  if (filters.payment_method) { conditions.push(`p.payment_method = $${idx++}`); params.push(filters.payment_method); }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  const limit = filters.limit ? parseInt(filters.limit) : 20;
  const offset = filters.offset ? parseInt(filters.offset) : 0;

  const countResult = await query(`SELECT COUNT(*) FROM payments p ${where}`, params);
  const total = parseInt(countResult.rows[0].count, 10);

  const result = await query(
    `SELECT p.*, i.invoice_number, i.amount AS invoice_amount
     FROM payments p
     JOIN invoices i ON i.id = p.invoice_id
     ${where}
     ORDER BY p.created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset]
  );
  return { payments: result.rows, total };
};

const create = async (data) => {
  const result = await query(
    `INSERT INTO payments (invoice_id, amount, payment_method, reference, notes)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [data.invoice_id, data.amount, data.payment_method || 'CARD', data.reference || null, data.notes || null]
  );
  return findById(result.rows[0].id);
};

const findByInvoice = async (invoiceId) => {
  const result = await query(
    'SELECT * FROM payments WHERE invoice_id = $1 ORDER BY created_at DESC',
    [invoiceId]
  );
  return result.rows;
};

export { findById, findAll, create, findByInvoice };

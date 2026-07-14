import { query } from '../../db/connection.js';

function generateInvoiceNumber() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `INV-${ts}-${rand}`;
}

const findById = async (id) => {
  const result = await query(
    `SELECT i.*, u.unit_number, p.name AS property_name,
            u2.name AS tenant_name, u2.surname AS tenant_surname
     FROM invoices i
     JOIN units u ON u.id = i.unit_id
     JOIN properties p ON p.id = u.property_id
     JOIN users u2 ON u2.id = i.tenant_id
     WHERE i.id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

const findAll = async (filters = {}) => {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (filters.tenant_id) { conditions.push(`i.tenant_id = $${idx++}`); params.push(filters.tenant_id); }
  if (filters.unit_id) { conditions.push(`i.unit_id = $${idx++}`); params.push(filters.unit_id); }
  if (filters.status) { conditions.push(`i.status = $${idx++}`); params.push(filters.status); }
  if (filters.start_date) { conditions.push(`i.due_date >= $${idx++}`); params.push(filters.start_date); }
  if (filters.end_date) { conditions.push(`i.due_date <= $${idx++}`); params.push(filters.end_date); }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  const limit = filters.limit ? parseInt(filters.limit) : 20;
  const offset = filters.offset ? parseInt(filters.offset) : 0;

  const countResult = await query(
    `SELECT COUNT(*) FROM invoices i ${where}`,
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const result = await query(
    `SELECT i.*, u.unit_number, p.name AS property_name,
            u2.name AS tenant_name, u2.surname AS tenant_surname
     FROM invoices i
     JOIN units u ON u.id = i.unit_id
     JOIN properties p ON p.id = u.property_id
     JOIN users u2 ON u2.id = i.tenant_id
     ${where}
     ORDER BY i.created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset]
  );

  return { invoices: result.rows, total };
};

const create = async (data) => {
  const invoiceNumber = generateInvoiceNumber();
  const lineItems = data.line_items ? JSON.stringify(data.line_items) : '[]';
  const total = data.line_items
    ? data.line_items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0)
    : data.amount;
  const result = await query(
    `INSERT INTO invoices (tenant_id, unit_id, invoice_number, amount, due_date, description, line_items)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [data.tenant_id, data.unit_id, invoiceNumber, total, data.due_date, data.description || null, lineItems]
  );
  return findById(result.rows[0].id);
};

const update = async (id, data) => {
  const entries = Object.entries(data).filter(([_, v]) => v !== undefined);
  if (entries.length === 0) return findById(id);
  const setClauses = [];
  const params = [];
  let idx = 1;
  for (const [key, value] of entries) {
    setClauses.push(`${key} = $${idx++}`);
    params.push(value);
  }
  params.push(id);
  await query(
    `UPDATE invoices SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${idx}`,
    params
  );
  return findById(id);
};

const markPaid = async (id) => {
  const result = await query(
    "UPDATE invoices SET status = 'PAID', paid_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *",
    [id]
  );
  return result.rows[0] || null;
};

const getOverdueInvoices = async () => {
  const result = await query(
    "SELECT * FROM invoices WHERE status IN ('UNPAID', 'OVERDUE') AND due_date < NOW() ORDER BY due_date ASC"
  );
  return result.rows;
};

const getTenantInvoices = async (tenantId) => {
  const result = await query(
    `SELECT i.*, u.unit_number, p.name AS property_name
     FROM invoices i
     JOIN units u ON u.id = i.unit_id
     JOIN properties p ON p.id = u.property_id
     WHERE i.tenant_id = $1
     ORDER BY i.created_at DESC`,
    [tenantId]
  );
  return result.rows;
};

export { findById, findAll, create, update, markPaid, getOverdueInvoices, getTenantInvoices };

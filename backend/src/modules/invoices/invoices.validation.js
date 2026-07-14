import { z } from 'zod';

const createInvoiceSchema = z.object({
  tenant_id: z.string().uuid(),
  unit_id: z.string().uuid(),
  amount: z.number().positive(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().max(500).optional(),
  line_items: z.array(z.object({
    description: z.string(),
    quantity: z.number().positive(),
    unit_price: z.number().positive(),
  })).optional(),
});

const updateInvoiceSchema = z.object({
  status: z.enum(['UNPAID', 'PAID', 'OVERDUE', 'CANCELLED']).optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  description: z.string().max(500).optional(),
});

export { createInvoiceSchema, updateInvoiceSchema };

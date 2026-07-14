import { z } from 'zod';

const createPaymentSchema = z.object({
  invoice_id: z.string().uuid(),
  amount: z.number().positive(),
  payment_method: z.enum(['CARD', 'BANK_TRANSFER', 'CASH', 'EFT', 'DEBIT_ORDER']).optional(),
  reference: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
});

export { createPaymentSchema };

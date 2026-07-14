import { z } from 'zod';

const createLeaseSchema = z.object({
  unit_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  start_date: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  end_date: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  monthly_rent: z.number().positive(),
  deposit: z.number().min(0).optional(),
  notes: z.string().max(500).optional(),
});

const updateLeaseSchema = z.object({
  monthly_rent: z.number().positive().optional(),
  deposit: z.number().min(0).optional(),
  status: z.enum(['ACTIVE', 'EXPIRED', 'TERMINATED', 'RENEWED']).optional(),
  end_date: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  notes: z.string().max(500).optional(),
});

export { createLeaseSchema, updateLeaseSchema };

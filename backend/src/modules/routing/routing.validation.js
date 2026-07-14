import { z } from 'zod';

const topProvidersQuerySchema = z.object({
  topN: z.coerce.number().int().positive().max(10).optional().default(3),
  requireSpecialisation: z.coerce.boolean().optional().default(false),
});

const autoAssignSchema = z.object({
  requireSpecialisation: z.boolean().optional().default(true),
});

const emergencyDispatchSchema = z.object({
  requireSpecialisation: z.boolean().optional().default(true),
  customMessage: z.string().max(500).optional().nullable(),
});

const acceptAssignmentSchema = z.object({
  providerId: z.string().uuid(),
});

const manualAssignSchema = z.object({
  providerId: z.string().uuid('Valid provider ID required'),
  note: z.string().optional().nullable(),
});

export { topProvidersQuerySchema, autoAssignSchema, emergencyDispatchSchema, acceptAssignmentSchema, manualAssignSchema };

import { z } from 'zod';

const classifyAiSchema = z.object({
  ticketId: z.string().optional(),
});

const extractEntitiesSchema = z.object({
  text: z.string().min(5, 'Text must be at least 5 characters'),
});

const lowConfidenceQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  status: z.enum(['pending', 'reviewed', 'resolved']).optional(),
});

const reviewQueueSchema = z.object({
  status: z.enum(['reviewed', 'resolved']),
  note: z.string().optional().nullable(),
});

export { classifyAiSchema, extractEntitiesSchema, lowConfidenceQuerySchema, reviewQueueSchema };

import { z } from 'zod';

const createEventSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  event_type: z.enum(['GENERAL', 'INSPECTION', 'MAINTENANCE', 'VIEWING', 'MEETING', 'DEADLINE']).optional(),
  start_time: z.string().datetime({ offset: true }),
  end_time: z.string().datetime({ offset: true }).optional(),
  all_day: z.boolean().optional(),
  related_to_type: z.string().max(30).optional(),
  related_to_id: z.string().uuid().optional(),
});

const updateEventSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  event_type: z.enum(['GENERAL', 'INSPECTION', 'MAINTENANCE', 'VIEWING', 'MEETING', 'DEADLINE']).optional(),
  start_time: z.string().datetime({ offset: true }).optional(),
  end_time: z.string().datetime({ offset: true }).optional(),
  all_day: z.boolean().optional(),
});

export { createEventSchema, updateEventSchema };

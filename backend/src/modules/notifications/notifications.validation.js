import { z } from 'zod';

const createNotificationSchema = z.object({
  user_id: z.string().uuid().optional(),
  type: z.enum(['info', 'warning', 'emergency', 'success']).optional(),
  title: z.string().max(255).optional(),
  body: z.string().min(1).max(1000),
  is_emergency: z.boolean().optional(),
});

export { createNotificationSchema };

import { z } from 'zod';

const chatSchema = z.object({
  message: z.string().trim().min(1, 'Message is required').max(2000),
});

export { chatSchema };
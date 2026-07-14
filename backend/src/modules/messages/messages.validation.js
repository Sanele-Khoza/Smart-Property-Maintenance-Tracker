import { z } from 'zod';

const sendMessageSchema = z.object({
  receiver_id: z.number().int().positive('Recipient required'),
  subject: z.string().trim().min(1, 'Subject required').max(300),
  body: z.string().trim().min(1, 'Body required'),
  category: z.string().max(50).optional(),
});

export { sendMessageSchema };

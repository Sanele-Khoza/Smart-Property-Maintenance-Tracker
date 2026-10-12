import { z } from 'zod';

const sendMessageSchema = z.object({
  receiver_id: z.number().int().positive('Recipient required'),
  subject: z.string().trim().min(1, 'Subject required').max(300),
  body: z.string().trim().min(1, 'Body required'),
  category: z.string().max(50).optional(),
});

const sendBroadcastSchema = z.object({
  receiver_ids: z.array(z.union([z.number().int().positive(), z.string().uuid()])).max(500).optional(),
  broadcast_all: z.boolean().optional(),
  subject: z.string().trim().min(1, 'Subject required').max(300),
  body: z.string().trim().min(1, 'Body required'),
}).refine(
  (d) => (d.broadcast_all === true) !== (Array.isArray(d.receiver_ids) && d.receiver_ids.length > 0),
  { message: 'Choose either specific users or all users, not both', path: ['receiver_ids'] }
);

export { sendMessageSchema, sendBroadcastSchema };

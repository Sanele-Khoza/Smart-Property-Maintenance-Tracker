import { z } from 'zod';

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY'];

const createTicketSchema = z.object({
  property_id: z.number().int().positive().optional().nullable(),
  unit_id: z.number().int().positive().optional().nullable(),
  category_id: z.number().int().positive().optional().nullable(),
  title: z.string().trim().min(1, 'Title is required').max(300),
  description: z.string().trim().min(1, 'Description is required'),
  priority: z.enum(PRIORITIES).optional(),
  source: z.enum(['tenant_portal', 'email', 'phone', 'system', 'in_person']).optional(),
  force: z.boolean().optional().default(false),
});

const updateTicketSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  description: z.string().trim().min(1).optional(),
  priority: z.enum(PRIORITIES).optional(),
  category_id: z.number().int().positive().optional().nullable(),
  due_date: z.string().optional().nullable(),
});

const changeStatusSchema = z.object({
  status: z.string().min(1, 'Status is required'),
  reason: z.string().optional().nullable(),
});

const assignTicketSchema = z.object({
  technician_id: z.number().int().positive('Valid technician required'),
  note: z.string().optional().nullable(),
});

const reopenTicketSchema = z.object({
  reason: z.string().min(1).max(500).optional(),
});

const rateTicketSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional().nullable(),
});

const overrideAiSchema = z.object({
  correctedLabel: z.string().min(1).max(100),
});

const classifyTicketSchema = z.object({
  textResult: z.object({
    category: z.string().optional(),
    confidence: z.number().min(0).max(1).optional(),
    service: z.string().optional(),
  }).optional(),
  visualResult: z.object({
    category: z.string().optional(),
    confidence: z.number().min(0).max(1).optional(),
    service: z.string().optional(),
  }).optional(),
  opts: z.object({
    imageIsEmergency: z.boolean().optional(),
    awsTextAvailable: z.boolean().optional(),
    awsVisualAvailable: z.boolean().optional(),
  }).optional(),
  debugOverride: z.boolean().optional(),
});

const noteOnlySchema = z.object({
  note: z.string().optional().nullable(),
});

const acceptSchema = z.object({
  note: z.string().optional().nullable(),
});

const startWorkSchema = z.object({
  note: z.string().optional().nullable(),
});

const waitingPartsSchema = z.object({
  note: z.string().optional().nullable(),
});

const partsReceivedSchema = z.object({
  note: z.string().optional().nullable(),
});

const tenantConfirmSchema = z.object({
  satisfied: z.boolean().optional().default(true),
  note: z.string().optional().nullable(),
});

const closeSchema = z.object({
  note: z.string().optional().nullable(),
});

export {
  createTicketSchema, updateTicketSchema, changeStatusSchema, assignTicketSchema,
  reopenTicketSchema, rateTicketSchema, overrideAiSchema, classifyTicketSchema,
  acceptSchema, startWorkSchema, waitingPartsSchema, partsReceivedSchema,
  tenantConfirmSchema, closeSchema, noteOnlySchema,
};

import { z } from 'zod';

const updateSettingSchema = z.object({
  settings: z.union([z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])), z.array(z.object({
    key: z.string(),
    value: z.union([z.string(), z.number(), z.boolean()]),
  }))]).optional(),
}).passthrough();

const updateSlaSchema = z.object({
  priority: z.string().min(1, 'Priority is required'),
  responseMinutes: z.number().int().positive(),
  resolutionMinutes: z.number().int().positive(),
});

const updateThresholdSchema = z.object({
  value: z.string().min(1),
  description: z.string().optional().nullable(),
});

export { updateSettingSchema, updateSlaSchema };

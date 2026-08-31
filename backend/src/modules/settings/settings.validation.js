import { z } from 'zod';

const updateSettingSchema = z.object({
  settings: z.union([z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])), z.array(z.object({
    key: z.string(),
    value: z.union([z.string(), z.number(), z.boolean()]),
  }))]).optional(),
}).passthrough();

const updateSlaSchema = z.object({
  priority: z.string().min(1, 'Priority is required'),
  responseMinutes: z.number().int().positive().optional(),
  resolutionMinutes: z.number().int().positive().optional(),
  autoAssignMinutes: z.number().int().min(1).optional(),
  warningPercent: z.number().min(0).max(100).optional(),
}).refine(
  (data) => ['responseMinutes', 'resolutionMinutes', 'autoAssignMinutes', 'warningPercent'].some(k => data[k] !== undefined),
  { message: 'At least one SLA field is required' }
);

const updateThresholdSchema = z.object({
  value: z.string().min(1),
  description: z.string().optional().nullable(),
});

export { updateSettingSchema, updateSlaSchema };

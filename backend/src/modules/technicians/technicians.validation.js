import { z } from 'zod';

const createTechnicianSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  companyName: z.string().max(200).optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  specialisations: z.array(z.string()).optional(),
});

const updateTechnicianSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  companyName: z.string().max(200).optional().nullable(),
  availabilityStatus: z.enum(['AVAILABLE', 'ON_CALL', 'OFF_DUTY', 'SUSPENDED']).optional(),
  specialisations: z.array(z.string()).optional(),
  rating: z.number().min(0).max(5).optional(),
  currentWorkload: z.number().int().min(0).optional(),
  totalJobsCompleted: z.number().int().min(0).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  gpsLatitude: z.number().optional().nullable(),
  gpsLongitude: z.number().optional().nullable(),
});

const locationSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
});

export { createTechnicianSchema, updateTechnicianSchema, locationSchema };

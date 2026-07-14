import { z } from 'zod';

const createUnitSchema = z.object({
  propertyId: z.number().int().positive('Property is required'),
  unitNumber: z.string().trim().min(1, 'Unit number is required').max(20),
  floor: z.string().max(10).optional().nullable(),
  type: z.string().max(30).optional(),
  bedrooms: z.number().int().min(0).optional(),
  bathrooms: z.number().int().min(0).optional(),
  sizeSqm: z.number().positive().optional().nullable(),
  monthlyRent: z.number().positive().optional().nullable(),
  squareMeters: z.number().positive().optional().nullable(),
});

const updateUnitSchema = z.object({
  unitNumber: z.string().trim().min(1).max(20).optional(),
  floor: z.string().max(10).optional().nullable(),
  type: z.string().max(30).optional(),
  status: z.enum(['Vacant', 'Occupied', 'Under Maintenance']).optional(),
  bedrooms: z.number().int().min(0).optional(),
  bathrooms: z.number().int().min(0).optional(),
  sizeSqm: z.number().positive().optional().nullable(),
  monthlyRent: z.number().positive().optional().nullable(),
});

const assignUnitSchema = z.object({
  tenantId: z.number().int().positive('Tenant ID is required'),
});

export { createUnitSchema, updateUnitSchema, assignUnitSchema };

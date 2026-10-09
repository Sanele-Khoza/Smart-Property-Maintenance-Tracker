import { z } from 'zod';

const createUnitSchema = z.object({
  propertyId: z.string().min(1, 'Property is required'),
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
  status: z.enum(['Vacant', 'Under Maintenance']).optional(),
  bedrooms: z.number().int().min(0).optional(),
  bathrooms: z.number().int().min(0).optional(),
  sizeSqm: z.number().positive().optional().nullable(),
  monthlyRent: z.number().positive().optional().nullable(),
});

const assignUnitSchema = z.object({
  tenantId: z.string().min(1).optional(),
  tenantName: z.string().trim().min(1).optional(),
}).refine((d) => d.tenantId || d.tenantName, {
  message: 'tenantId or tenantName is required',
});

const bulkCreateUnitsSchema = z.object({
  propertyId: z.union([z.string().min(1, 'Property is required'), z.number()]),
  floor: z.union([z.string().max(10), z.number()]).optional().nullable(),
  type: z.string().max(30).optional(),
  bedrooms: z.number().int().min(0).optional(),
  bathrooms: z.number().int().min(0).optional(),
  sizeSqm: z.number().positive().optional().nullable(),
  // Explicit list takes precedence when provided
  unitNumbers: z.array(z.string().trim().min(1).max(20)).min(1).max(100).optional(),
  // Range form: from/to can be "1"/"9" or "A1"/"A9" (same prefix)
  from: z.string().trim().min(1).max(20).optional(),
  to: z.string().trim().min(1).max(20).optional(),
  prefix: z.string().max(10).optional(),
  suffix: z.string().max(10).optional(),
}).refine((d) => (d.unitNumbers && d.unitNumbers.length > 0) || (d.from && d.to), {
  message: 'Provide unitNumbers array or from/to range',
});

export { createUnitSchema, updateUnitSchema, assignUnitSchema, bulkCreateUnitsSchema };

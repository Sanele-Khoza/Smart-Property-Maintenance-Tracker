import { z } from 'zod';

// unit_number and floor are free-text (VARCHAR) in the DB on purpose — real
// labels like "G", "B1", "Mezzanine", "PH2" are valid and aren't numbers at
// all. But when someone *does* type a plain number, it should never be
// negative (there's no such thing as unit "-5" or floor "-3"). This only
// rejects strings that are purely a negative integer; it leaves every
// non-numeric label untouched.
const negativeNumberPattern = /^-\d+(\.\d+)?$/;
const notNegativeNumber = (val) => val == null || !negativeNumberPattern.test(String(val).trim());
const notNegativeNumberMessage = { message: 'Must not be a negative number' };

const createUnitSchema = z.object({
  propertyId: z.string().min(1, 'Property is required'),
  unitNumber: z.string().trim().min(1, 'Unit number is required').max(20).refine(notNegativeNumber, notNegativeNumberMessage),
  floor: z.string().max(10).optional().nullable().refine(notNegativeNumber, notNegativeNumberMessage),
  type: z.string().max(30).optional(),
  bedrooms: z.number().int().min(0).optional(),
  bathrooms: z.number().int().min(0).optional(),
  sizeSqm: z.number().positive().optional().nullable(),
  monthlyRent: z.number().positive().optional().nullable(),
  squareMeters: z.number().positive().optional().nullable(),
});

const updateUnitSchema = z.object({
  unitNumber: z.string().trim().min(1).max(20).refine(notNegativeNumber, notNegativeNumberMessage).optional(),
  floor: z.string().max(10).optional().nullable().refine(notNegativeNumber, notNegativeNumberMessage),
  type: z.string().max(30).optional(),
  status: z.enum(['Vacant', 'Occupied', 'Under Maintenance']).optional(),
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

export { createUnitSchema, updateUnitSchema, assignUnitSchema };
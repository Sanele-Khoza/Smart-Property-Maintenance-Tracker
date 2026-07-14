import { z } from 'zod';

const createPropertySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  type: z.enum(['Residential', 'Commercial', 'Mixed-Use']).optional(),
  status: z.enum(['Active', 'Inactive', 'Under Maintenance']).optional(),
  address: z.string().trim().min(1, 'Address is required'),
});

const updatePropertySchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  type: z.enum(['Residential', 'Commercial', 'Mixed-Use']).optional(),
  status: z.enum(['Active', 'Inactive', 'Under Maintenance']).optional(),
  address: z.string().trim().min(1).optional(),
});

export { createPropertySchema, updatePropertySchema };

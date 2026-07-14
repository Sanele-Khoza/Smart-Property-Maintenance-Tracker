import { z } from 'zod';

const createCategorySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  icon: z.string().max(10).optional(),
  color: z.string().max(10).optional(),
});

const updateCategorySchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  icon: z.string().max(10).optional(),
  color: z.string().max(10).optional(),
});

export { createCategorySchema, updateCategorySchema };

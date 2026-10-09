import { z } from 'zod';

const normalizeType = (val) => {
  if (val === undefined || val === null) return val;
  const key = String(val).trim().toUpperCase().replace(/[\s_-]+/g, '');
  const map = {
    RESIDENTIAL: 'Residential',
    COMMERCIAL: 'Commercial',
    MIXED: 'Mixed-Use',
    MIXEDUSE: 'Mixed-Use',
  };
  return map[key] || val;
};

const normalizeStatus = (val) => {
  if (val === undefined || val === null) return val;
  const key = String(val).trim().toUpperCase().replace(/[\s_-]+/g, '');
  const map = {
    ACTIVE: 'Active',
    INACTIVE: 'Inactive',
    UNDERMAINTENANCE: 'Under Maintenance',
  };
  return map[key] || val;
};

const typeField = z.preprocess(
  normalizeType,
  z.enum(['Residential', 'Commercial', 'Mixed-Use']).optional()
);

const statusField = z.preprocess(
  normalizeStatus,
  z.enum(['Active', 'Inactive', 'Under Maintenance']).optional()
);

const createPropertySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  type: typeField,
  status: statusField,
  address: z.string().trim().min(1, 'Address is required'),
  managerId: z.string().min(1).optional().nullable(),
  managerName: z.string().trim().max(100).optional().nullable(),
});

const updatePropertySchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  type: typeField,
  status: statusField,
  address: z.string().trim().min(1).optional(),
  managerId: z.string().min(1).optional().nullable(),
  managerName: z.string().trim().max(100).optional().nullable(),
});

export { createPropertySchema, updatePropertySchema };

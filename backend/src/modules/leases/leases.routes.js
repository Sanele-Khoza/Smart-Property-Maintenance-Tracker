import { Router } from 'express';
import * as ctrl from './leases.controller.js';
import { createLeaseSchema, updateLeaseSchema } from './leases.validation.js';
import validate from '../../middleware/validate.js';
import authenticate from '../../middleware/authenticate.js';
import { authorize, hasPermission } from '../../middleware/authorize.js';
import { Roles } from '../../shared/constants/roles.js';

const router = Router();

router.get('/', authenticate, authorize(Roles.ADMIN, Roles.MANAGER), ctrl.list);
router.get('/me', authenticate, authorize(Roles.TENANT), ctrl.myLeases);
router.get('/:id', authenticate, authorize(Roles.ADMIN, Roles.MANAGER, Roles.TENANT), ctrl.getById);
router.post('/', authenticate, authorize(Roles.ADMIN, Roles.MANAGER), validate(createLeaseSchema), ctrl.create);
router.put('/:id', authenticate, authorize(Roles.ADMIN, Roles.MANAGER), validate(updateLeaseSchema), ctrl.update);
router.put('/:id/terminate', authenticate, authorize(Roles.ADMIN, Roles.MANAGER), ctrl.terminate);
router.delete('/:id', authenticate, authorize(Roles.ADMIN), ctrl.remove);

export default router;

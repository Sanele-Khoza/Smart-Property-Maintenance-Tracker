import { Router } from 'express';
import * as ctrl from './tenants.controller.js';
import authenticate from '../../middleware/authenticate.js';
import { authorize, hasPermission } from '../../middleware/authorize.js';
import validate from '../../middleware/validate.js';
import { Roles } from '../../shared/constants/roles.js';
import { updateProfileSchema, rateSchema } from './tenants.validation.js';

const router = Router();

router.get('/tickets', authenticate, authorize(Roles.TENANT, Roles.SYSTEM_ADMIN, Roles.PROPERTY_MANAGER), ctrl.myTickets);
router.get('/profile', authenticate, authorize(Roles.TENANT), ctrl.getProfile);
router.put('/profile', authenticate, authorize(Roles.TENANT), validate(updateProfileSchema), ctrl.updateProfile);
router.post('/tickets/:id/rate', authenticate, authorize(Roles.TENANT), validate(rateSchema), ctrl.rateTicket);

export default router;

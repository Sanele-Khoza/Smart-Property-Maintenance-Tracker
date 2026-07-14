import { Router } from 'express';
import * as ctrl from './managers.controller.js';
import authenticate from '../../middleware/authenticate.js';
import { authorize, hasPermission } from '../../middleware/authorize.js';
import { Roles } from '../../shared/constants/roles.js';

const router = Router();

router.get('/properties', authenticate, authorize(Roles.SYSTEM_ADMIN, Roles.PROPERTY_MANAGER), ctrl.getProperties);
router.get('/tickets', authenticate, authorize(Roles.SYSTEM_ADMIN, Roles.PROPERTY_MANAGER), ctrl.getTickets);
router.get('/reports', authenticate, authorize(Roles.SYSTEM_ADMIN, Roles.PROPERTY_MANAGER), ctrl.getReports);

export default router;

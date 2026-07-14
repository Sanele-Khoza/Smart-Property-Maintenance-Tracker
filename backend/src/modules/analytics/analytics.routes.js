import { Router } from 'express';
import * as ctrl from './analytics.controller.js';
import authenticate from '../../middleware/authenticate.js';
import { authorize, hasPermission } from '../../middleware/authorize.js';
import { Roles } from '../../shared/constants/roles.js';

const router = Router();

router.get('/overview', authenticate, authorize(Roles.SYSTEM_ADMIN, Roles.PROPERTY_MANAGER), ctrl.overview);
router.get('/ticket-trends', authenticate, authorize(Roles.SYSTEM_ADMIN, Roles.PROPERTY_MANAGER), ctrl.ticketTrends);
router.get('/sla-compliance', authenticate, authorize(Roles.SYSTEM_ADMIN, Roles.PROPERTY_MANAGER), ctrl.slaCompliance);
router.get('/priority-distribution', authenticate, authorize(Roles.SYSTEM_ADMIN, Roles.PROPERTY_MANAGER), ctrl.priorityDistribution);

export default router;

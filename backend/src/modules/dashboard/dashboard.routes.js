import { Router } from 'express';
import * as ctrl from './dashboard.controller.js';
import authenticate from '../../middleware/authenticate.js';
import { authorize, hasPermission } from '../../middleware/authorize.js';
import { Roles } from '../../shared/constants/roles.js';

const router = Router();

router.get('/', authenticate, authorize(Roles.SYSTEM_ADMIN, Roles.ADMIN, Roles.PROPERTY_MANAGER, Roles.TENANT, Roles.SERVICE_PROVIDER), ctrl.getDashboard);
router.get('/stats', authenticate, authorize(Roles.SYSTEM_ADMIN, Roles.ADMIN, Roles.PROPERTY_MANAGER), ctrl.getStats);
router.get('/pending-tickets', authenticate, authorize(Roles.SYSTEM_ADMIN, Roles.ADMIN, Roles.PROPERTY_MANAGER, Roles.TENANT, Roles.SERVICE_PROVIDER), ctrl.getPendingTickets);
router.get('/completed-tickets', authenticate, authorize(Roles.SYSTEM_ADMIN, Roles.ADMIN, Roles.PROPERTY_MANAGER, Roles.TENANT, Roles.SERVICE_PROVIDER), ctrl.getCompletedTickets);
router.get('/ticket-trends', authenticate, authorize(Roles.SYSTEM_ADMIN, Roles.ADMIN, Roles.PROPERTY_MANAGER), ctrl.getTicketTrends);

export default router;

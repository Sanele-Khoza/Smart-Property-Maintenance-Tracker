import { Router } from 'express';
import * as ctrl from './comments.controller.js';
import authenticate from '../../middleware/authenticate.js';
import { authorize, hasPermission } from '../../middleware/authorize.js';
import { Roles } from '../../shared/constants/roles.js';

const router = Router();

router.get('/ticket/:ticketId', authenticate, authorize(Roles.TENANT, Roles.PROPERTY_MANAGER, Roles.SERVICE_PROVIDER, Roles.SYSTEM_ADMIN), ctrl.getByTicket);
router.post('/ticket/:ticketId', authenticate, authorize(Roles.TENANT, Roles.PROPERTY_MANAGER, Roles.SERVICE_PROVIDER, Roles.SYSTEM_ADMIN), ctrl.create);
router.delete('/:id', authenticate, authorize(Roles.TENANT, Roles.PROPERTY_MANAGER, Roles.SERVICE_PROVIDER, Roles.SYSTEM_ADMIN), ctrl.remove);

export default router;

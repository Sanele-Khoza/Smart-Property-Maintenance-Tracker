import { Router } from 'express';
import * as ctrl from './providers.controller.js';
import authenticate from '../../middleware/authenticate.js';
import { authorize, hasPermission } from '../../middleware/authorize.js';
import { Roles } from '../../shared/constants/roles.js';

const router = Router();

router.get('/tickets', authenticate, authorize(Roles.SERVICE_PROVIDER), ctrl.myJobs);
router.put('/tickets/:id/accept', authenticate, authorize(Roles.SERVICE_PROVIDER), ctrl.acceptTicket);
router.put('/tickets/:id/complete', authenticate, authorize(Roles.SERVICE_PROVIDER), ctrl.completeTicket);
router.put('/availability', authenticate, authorize(Roles.SERVICE_PROVIDER), ctrl.updateAvailability);
router.get('/availability', authenticate, authorize(Roles.SERVICE_PROVIDER), ctrl.myAvailability);

export default router;

import { Router } from 'express';
import * as ctrl from './system.controller.js';
import authenticate from '../../middleware/authenticate.js';
import { authorize, hasPermission } from '../../middleware/authorize.js';
import { Roles } from '../../shared/constants/roles.js';

const router = Router();

router.get('/settings', authenticate, authorize(Roles.SYSTEM_ADMIN, Roles.PROPERTY_MANAGER), ctrl.getSettings);
router.put('/settings', authenticate, authorize(Roles.SYSTEM_ADMIN), ctrl.updateSettings);
router.get('/settings/sla', authenticate, authorize(Roles.SYSTEM_ADMIN, Roles.PROPERTY_MANAGER), ctrl.getSla);
router.put('/settings/sla', authenticate, authorize(Roles.SYSTEM_ADMIN), ctrl.updateSla);
router.get('/thresholds', authenticate, authorize(Roles.SYSTEM_ADMIN, Roles.PROPERTY_MANAGER), ctrl.getThresholds);

export default router;

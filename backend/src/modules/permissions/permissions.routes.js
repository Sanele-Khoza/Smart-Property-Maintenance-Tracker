import { Router } from 'express';
import * as ctrl from './permissions.controller.js';
import authenticate from '../../middleware/authenticate.js';
import { authorize, hasPermission } from '../../middleware/authorize.js';
import { Roles } from '../../shared/constants/roles.js';

const router = Router();

router.get('/', authenticate, ctrl.getPermissions);
router.get('/mine', authenticate, ctrl.getUserPermissions);
router.put('/user/:userId', authenticate, authorize(Roles.SYSTEM_ADMIN), ctrl.setUserRole);

export default router;

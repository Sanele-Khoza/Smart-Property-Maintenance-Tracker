import { Router } from 'express';
import * as ctrl from './audit.controller.js';
import authenticate from '../../middleware/authenticate.js';
import { authorize, hasPermission } from '../../middleware/authorize.js';
import { Roles } from '../../shared/constants/roles.js';

const router = Router();

router.get('/', authenticate, authorize(Roles.SYSTEM_ADMIN), ctrl.getSecurityLogs);
router.post('/', authenticate, ctrl.createSecurityLog);

export default router;

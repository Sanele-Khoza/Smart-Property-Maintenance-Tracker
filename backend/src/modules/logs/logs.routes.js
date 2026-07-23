import { Router } from 'express';
import * as ctrl from './logs.controller.js';
import authenticate from '../../middleware/authenticate.js';
import { authorize, hasPermission } from '../../middleware/authorize.js';
import { Roles } from '../../shared/constants/roles.js';

const router = Router();

router.get('/', authenticate, authorize(Roles.SYSTEM_ADMIN), ctrl.getLogs);
router.post('/', authenticate, ctrl.createLog);

export default router;

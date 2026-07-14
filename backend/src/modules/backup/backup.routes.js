import { Router } from 'express';
import * as ctrl from './backup.controller.js';
import authenticate from '../../middleware/authenticate.js';
import { authorize, hasPermission } from '../../middleware/authorize.js';
import { Roles } from '../../shared/constants/roles.js';

const router = Router();

router.post('/export', authenticate, authorize(Roles.SYSTEM_ADMIN), ctrl.exportData);
router.post('/import', authenticate, authorize(Roles.SYSTEM_ADMIN), ctrl.importData);

export default router;

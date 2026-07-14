import { Router } from 'express';
import * as ctrl from './super-admin.controller.js';
import authenticate from '../../middleware/authenticate.js';
import { authorize, hasPermission } from '../../middleware/authorize.js';
import { Roles } from '../../shared/constants/roles.js';

const router = Router();

router.get('/users', authenticate, authorize(Roles.SYSTEM_ADMIN), ctrl.getUsers);
router.put('/users/:id/approve', authenticate, authorize(Roles.SYSTEM_ADMIN), ctrl.approveUser);
router.put('/users/:id/deactivate', authenticate, authorize(Roles.SYSTEM_ADMIN), ctrl.deactivateUser);
router.put('/users/:id/reactivate', authenticate, authorize(Roles.SYSTEM_ADMIN), ctrl.reactivateUser);
router.put('/users/:id/role', authenticate, authorize(Roles.SYSTEM_ADMIN), ctrl.changeRole);
router.put('/users/:id/unlock', authenticate, authorize(Roles.SYSTEM_ADMIN), ctrl.unlockUser);
router.post('/reset-data', authenticate, authorize(Roles.SYSTEM_ADMIN), ctrl.resetData);
router.get('/backup', authenticate, authorize(Roles.SYSTEM_ADMIN), ctrl.backupData);
router.post('/restore', authenticate, authorize(Roles.SYSTEM_ADMIN), ctrl.restoreData);

export default router;

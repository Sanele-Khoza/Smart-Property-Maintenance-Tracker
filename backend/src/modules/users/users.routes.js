import { Router } from 'express';
import * as ctrl from './users.controller.js';
import authenticate from '../../middleware/authenticate.js';
import { authorize, hasPermission } from '../../middleware/authorize.js';
import { Roles } from '../../shared/constants/roles.js';

const router = Router();

router.get('/', authenticate, authorize(Roles.SYSTEM_ADMIN, Roles.PROPERTY_MANAGER), ctrl.getUsers);
router.get('/pending', authenticate, authorize(Roles.SYSTEM_ADMIN, Roles.PROPERTY_MANAGER), ctrl.getPendingUsers);
router.put('/:id/approve', authenticate, authorize(Roles.SYSTEM_ADMIN), ctrl.approveUser);
router.put('/:id/deactivate', authenticate, authorize(Roles.SYSTEM_ADMIN, Roles.PROPERTY_MANAGER), ctrl.deactivateUser);
router.put('/:id/reactivate', authenticate, authorize(Roles.SYSTEM_ADMIN), ctrl.reactivateUser);
router.put('/:id/role', authenticate, authorize(Roles.SYSTEM_ADMIN), ctrl.changeRole);
router.put('/:id/unlock', authenticate, authorize(Roles.SYSTEM_ADMIN), ctrl.unlockUser);
router.patch('/:id', authenticate, authorize(Roles.SYSTEM_ADMIN), ctrl.updateUser);

export default router;

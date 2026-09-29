import { Router } from 'express';
import * as ctrl from './backup.controller.js';
import authenticate from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { Roles } from '../../shared/constants/roles.js';

const router = Router();

router.post('/', authenticate, authorize(Roles.SYSTEM_ADMIN), ctrl.create);
router.get('/', authenticate, authorize(Roles.SYSTEM_ADMIN), ctrl.list);
router.get('/schedule', authenticate, authorize(Roles.SYSTEM_ADMIN), ctrl.schedule);
router.get('/:id', authenticate, authorize(Roles.SYSTEM_ADMIN), ctrl.getOne);
router.post('/:id/verify', authenticate, authorize(Roles.SYSTEM_ADMIN), ctrl.verify);
router.post('/:id/restore', authenticate, authorize(Roles.SYSTEM_ADMIN), ctrl.restore);

export default router;
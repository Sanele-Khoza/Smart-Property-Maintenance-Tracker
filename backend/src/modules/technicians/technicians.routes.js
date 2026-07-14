import { Router } from 'express';
import * as ctrl from './technicians.controller.js';
import authenticate from '../../middleware/authenticate.js';
import { authorize, hasPermission } from '../../middleware/authorize.js';
import { Roles } from '../../shared/constants/roles.js';

const router = Router();

router.get('/', authenticate, authorize(Roles.SYSTEM_ADMIN, Roles.PROPERTY_MANAGER), ctrl.list);
router.get('/:id', authenticate, authorize(Roles.SYSTEM_ADMIN, Roles.PROPERTY_MANAGER), ctrl.getById);
router.post('/', authenticate, authorize(Roles.SYSTEM_ADMIN, Roles.PROPERTY_MANAGER), ctrl.create);
router.put('/:id', authenticate, authorize(Roles.SYSTEM_ADMIN, Roles.PROPERTY_MANAGER), ctrl.update);
router.put('/:id/status', authenticate, authorize(Roles.SYSTEM_ADMIN, Roles.PROPERTY_MANAGER), ctrl.updateStatus);
router.put('/:id/location', authenticate, authorize(Roles.SERVICE_PROVIDER, Roles.SYSTEM_ADMIN), ctrl.updateLocation);
router.get('/:id/availability', authenticate, authorize(Roles.SYSTEM_ADMIN, Roles.PROPERTY_MANAGER, Roles.SERVICE_PROVIDER), ctrl.getAvailability);
router.post('/:id/availability', authenticate, authorize(Roles.SYSTEM_ADMIN, Roles.PROPERTY_MANAGER, Roles.SERVICE_PROVIDER), ctrl.addAvailability);
router.delete('/:id', authenticate, authorize(Roles.SYSTEM_ADMIN), ctrl.remove);

export default router;

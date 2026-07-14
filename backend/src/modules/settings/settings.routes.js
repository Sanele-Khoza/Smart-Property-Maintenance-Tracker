import { Router } from 'express';
import * as ctrl from './settings.controller.js';
import authenticate from '../../middleware/authenticate.js';
import { authorize, hasPermission } from '../../middleware/authorize.js';
import validate from '../../middleware/validate.js';
import { updateSettingSchema, updateSlaSchema } from './settings.validation.js';
import { Roles } from '../../shared/constants/roles.js';

const router = Router();

router.get('/', authenticate, authorize(Roles.SYSTEM_ADMIN, Roles.PROPERTY_MANAGER), ctrl.getAll);
router.put('/', authenticate, authorize(Roles.SYSTEM_ADMIN), ctrl.updateSettings);
router.get('/sla', authenticate, authorize(Roles.SYSTEM_ADMIN, Roles.PROPERTY_MANAGER), ctrl.getSla);
router.put('/sla', authenticate, authorize(Roles.SYSTEM_ADMIN), validate(updateSlaSchema), ctrl.updateSla);

export default router;

import { Router } from 'express';
import * as ctrl from './search.controller.js';
import authenticate from '../../middleware/authenticate.js';
import { authorize, hasPermission } from '../../middleware/authorize.js';
import { Roles } from '../../shared/constants/roles.js';

const router = Router();

router.get('/', authenticate, authorize(Roles.TENANT, Roles.PROPERTY_MANAGER, Roles.SERVICE_PROVIDER, Roles.SYSTEM_ADMIN), ctrl.search);

export default router;

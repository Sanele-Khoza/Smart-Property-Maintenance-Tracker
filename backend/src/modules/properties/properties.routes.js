import { Router } from 'express';
import * as ctrl from './properties.controller.js';
import authenticate from '../../middleware/authenticate.js';
import { authorize, hasPermission } from '../../middleware/authorize.js';
import validate from '../../middleware/validate.js';
import auditLog from '../../middleware/auditLog.js';
import { createPropertySchema, updatePropertySchema } from './properties.validation.js';
import { Roles } from '../../shared/constants/roles.js';

const router = Router();

router.get('/', authenticate, authorize(Roles.TENANT, Roles.PROPERTY_MANAGER, Roles.SERVICE_PROVIDER, Roles.SYSTEM_ADMIN), ctrl.list);
router.get('/:id', authenticate, authorize(Roles.TENANT, Roles.PROPERTY_MANAGER, Roles.SERVICE_PROVIDER, Roles.SYSTEM_ADMIN), ctrl.getById);
router.post('/', authenticate, authorize(Roles.SYSTEM_ADMIN, Roles.PROPERTY_MANAGER), validate(createPropertySchema), auditLog('PROPERTY_CREATED', req => ({ type: 'property', id: null })), ctrl.create);
router.put('/:id', authenticate, authorize(Roles.SYSTEM_ADMIN, Roles.PROPERTY_MANAGER), validate(updatePropertySchema), auditLog('PROPERTY_UPDATED', req => ({ type: 'property', id: req.params.id })), ctrl.update);
router.delete('/:id', authenticate, authorize(Roles.SYSTEM_ADMIN, Roles.PROPERTY_MANAGER), auditLog('PROPERTY_DELETED', req => ({ type: 'property', id: req.params.id })), ctrl.remove);
router.get('/:id/units', authenticate, authorize(Roles.TENANT, Roles.PROPERTY_MANAGER, Roles.SERVICE_PROVIDER, Roles.SYSTEM_ADMIN), ctrl.getUnits);
router.get('/:id/tickets', authenticate, authorize(Roles.TENANT, Roles.PROPERTY_MANAGER, Roles.SERVICE_PROVIDER, Roles.SYSTEM_ADMIN), ctrl.getTickets);

export default router;

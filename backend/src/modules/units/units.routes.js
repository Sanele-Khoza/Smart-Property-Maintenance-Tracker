import { Router } from 'express';
import * as ctrl from './units.controller.js';
import authenticate from '../../middleware/authenticate.js';
import { authorize, hasPermission } from '../../middleware/authorize.js';
import validate from '../../middleware/validate.js';
import auditLog from '../../middleware/auditLog.js';
import { createUnitSchema, updateUnitSchema, assignUnitSchema } from './units.validation.js';
import { Roles } from '../../shared/constants/roles.js';

const router = Router();

router.get('/', authenticate, authorize(Roles.TENANT, Roles.PROPERTY_MANAGER, Roles.SERVICE_PROVIDER, Roles.SYSTEM_ADMIN), ctrl.list);
router.get('/:id', authenticate, authorize(Roles.TENANT, Roles.PROPERTY_MANAGER, Roles.SERVICE_PROVIDER, Roles.SYSTEM_ADMIN), ctrl.getById);
router.post('/', authenticate, authorize(Roles.SYSTEM_ADMIN, Roles.PROPERTY_MANAGER), validate(createUnitSchema), auditLog('UNIT_CREATED', req => ({ type: 'unit', id: null })), ctrl.create);
router.put('/:id', authenticate, authorize(Roles.SYSTEM_ADMIN, Roles.PROPERTY_MANAGER), validate(updateUnitSchema), auditLog('UNIT_UPDATED', req => ({ type: 'unit', id: req.params.id })), ctrl.update);
router.put('/:id/assign', authenticate, authorize(Roles.SYSTEM_ADMIN, Roles.PROPERTY_MANAGER), validate(assignUnitSchema), auditLog('UNIT_ASSIGNED', req => ({ type: 'unit', id: req.params.id })), ctrl.assign);
router.put('/:id/vacate', authenticate, authorize(Roles.SYSTEM_ADMIN, Roles.PROPERTY_MANAGER), auditLog('UNIT_VACATED', req => ({ type: 'unit', id: req.params.id })), ctrl.vacate);
router.delete('/:id', authenticate, authorize(Roles.SYSTEM_ADMIN), auditLog('UNIT_DELETED', req => ({ type: 'unit', id: req.params.id })), ctrl.remove);

export default router;

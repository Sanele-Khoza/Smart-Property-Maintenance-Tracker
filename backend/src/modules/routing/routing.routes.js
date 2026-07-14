import { Router } from 'express';
import * as ctrl from './routing.controller.js';
import authenticate from '../../middleware/authenticate.js';
import { authorize, hasPermission } from '../../middleware/authorize.js';
import validate from '../../middleware/validate.js';
import {
  topProvidersQuerySchema, autoAssignSchema, emergencyDispatchSchema,
  acceptAssignmentSchema, manualAssignSchema,
} from './routing.validation.js';
import { Roles } from '../../shared/constants/roles.js';

const router = Router();

router.get('/providers/:ticketId', authenticate, authorize(Roles.PROPERTY_MANAGER, Roles.SYSTEM_ADMIN), validate(topProvidersQuerySchema), ctrl.getTopProviders);

router.post('/auto-assign/:ticketId', authenticate, authorize(Roles.PROPERTY_MANAGER, Roles.SYSTEM_ADMIN), validate(autoAssignSchema), ctrl.autoAssign);

router.post('/emergency/:ticketId', authenticate, authorize(Roles.PROPERTY_MANAGER, Roles.SYSTEM_ADMIN), validate(emergencyDispatchSchema), ctrl.dispatchEmergency);

router.post('/accept/:assignmentId', authenticate, hasPermission('tickets.update.status'), validate(acceptAssignmentSchema), ctrl.accept);

router.post('/:ticketId/assign', authenticate, authorize(Roles.PROPERTY_MANAGER, Roles.SYSTEM_ADMIN), validate(manualAssignSchema), ctrl.manualAssign);

router.get('/history/:ticketId', authenticate, authorize(Roles.PROPERTY_MANAGER, Roles.SYSTEM_ADMIN), ctrl.getAssignmentHistory);

router.get('/provider/:providerId', authenticate, authorize(Roles.PROPERTY_MANAGER, Roles.SYSTEM_ADMIN), ctrl.getProviderStatus);

export default router;

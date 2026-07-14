import { Router } from 'express';
import * as ctrl from './payments.controller.js';
import { createPaymentSchema } from './payments.validation.js';
import validate from '../../middleware/validate.js';
import authenticate from '../../middleware/authenticate.js';
import { authorize, hasPermission } from '../../middleware/authorize.js';
import { Roles } from '../../shared/constants/roles.js';

const router = Router();

router.get('/', authenticate, authorize(Roles.ADMIN, Roles.MANAGER), ctrl.list);
router.get('/:id', authenticate, authorize(Roles.ADMIN, Roles.MANAGER), ctrl.getById);
router.get('/by-invoice/:invoiceId', authenticate, authorize(Roles.ADMIN, Roles.MANAGER), ctrl.byInvoice);
router.post('/', authenticate, authorize(Roles.ADMIN, Roles.MANAGER), validate(createPaymentSchema), ctrl.create);

export default router;

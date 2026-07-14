import { Router } from 'express';
import * as ctrl from './invoices.controller.js';
import { createInvoiceSchema, updateInvoiceSchema } from './invoices.validation.js';
import validate from '../../middleware/validate.js';
import authenticate from '../../middleware/authenticate.js';
import { authorize, hasPermission } from '../../middleware/authorize.js';
import { Roles } from '../../shared/constants/roles.js';

const router = Router();

router.get('/', authenticate, authorize(Roles.ADMIN, Roles.MANAGER), ctrl.list);
router.get('/me', authenticate, authorize(Roles.TENANT), ctrl.myInvoices);
router.get('/:id', authenticate, authorize(Roles.ADMIN, Roles.MANAGER, Roles.TENANT), ctrl.getById);
router.post('/', authenticate, authorize(Roles.ADMIN, Roles.MANAGER), validate(createInvoiceSchema), ctrl.create);
router.put('/:id', authenticate, authorize(Roles.ADMIN, Roles.MANAGER), validate(updateInvoiceSchema), ctrl.update);
router.put('/:id/pay', authenticate, authorize(Roles.ADMIN, Roles.TENANT), ctrl.markPaid);

export default router;

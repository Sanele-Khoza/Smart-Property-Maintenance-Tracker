import { Router } from 'express';
import * as ctrl from './categories.controller.js';
import authenticate from '../../middleware/authenticate.js';
import { authorize, hasPermission } from '../../middleware/authorize.js';
import validate from '../../middleware/validate.js';
import { createCategorySchema, updateCategorySchema } from './categories.validation.js';
import { Roles } from '../../shared/constants/roles.js';

const router = Router();

router.get('/', authenticate, ctrl.list);
router.get('/:id', authenticate, ctrl.getById);
router.post('/', authenticate, authorize(Roles.SYSTEM_ADMIN), validate(createCategorySchema), ctrl.create);
router.put('/:id', authenticate, authorize(Roles.SYSTEM_ADMIN), validate(updateCategorySchema), ctrl.update);
router.delete('/:id', authenticate, authorize(Roles.SYSTEM_ADMIN), ctrl.remove);

export default router;

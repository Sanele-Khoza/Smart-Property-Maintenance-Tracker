import { Router } from 'express';
import * as ctrl from './calendar.controller.js';
import { createEventSchema, updateEventSchema } from './calendar.validation.js';
import validate from '../../middleware/validate.js';
import authenticate from '../../middleware/authenticate.js';

const router = Router();

router.get('/', authenticate, ctrl.list);
router.get('/:id', authenticate, ctrl.getById);
router.post('/', authenticate, validate(createEventSchema), ctrl.create);
router.put('/:id', authenticate, validate(updateEventSchema), ctrl.update);
router.delete('/:id', authenticate, ctrl.remove);

export default router;

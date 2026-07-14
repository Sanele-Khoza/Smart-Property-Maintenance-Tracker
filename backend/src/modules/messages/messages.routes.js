import { Router } from 'express';
import * as ctrl from './messages.controller.js';
import authenticate from '../../middleware/authenticate.js';
import validate from '../../middleware/validate.js';
import { sendMessageSchema } from './messages.validation.js';

const router = Router();

router.get('/', authenticate, ctrl.list);
router.get('/sent', authenticate, ctrl.listSent);
router.get('/unread-count', authenticate, ctrl.countUnread);
router.post('/', authenticate, validate(sendMessageSchema), ctrl.send);
router.put('/:id/read', authenticate, ctrl.markRead);
router.get('/:id', authenticate, ctrl.getById);

export default router;

import { Router } from 'express';
import * as ctrl from './messages.controller.js';
import authenticate from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { Roles } from '../../shared/constants/roles.js';
import validate from '../../middleware/validate.js';
import { sendMessageSchema, sendBroadcastSchema } from './messages.validation.js';

const router = Router();

router.get('/', authenticate, ctrl.list);
router.get('/sent', authenticate, ctrl.listSent);
router.get('/unread-count', authenticate, ctrl.countUnread);
router.get('/popups', authenticate, ctrl.popups);
router.post('/', authenticate, validate(sendMessageSchema), ctrl.send);
router.post('/broadcast', authenticate, authorize(Roles.SYSTEM_ADMIN), validate(sendBroadcastSchema), ctrl.sendBroadcast);
router.put('/:id/read', authenticate, ctrl.markRead);
router.get('/:id', authenticate, ctrl.getById);

export default router;
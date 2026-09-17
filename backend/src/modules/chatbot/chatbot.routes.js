import { Router } from 'express';
import * as ctrl from './chatbot.controller.js';
import authenticate from '../../middleware/authenticate.js';
import validate from '../../middleware/validate.js';
import auditLog from '../../middleware/auditLog.js';
import { chatSchema } from './chatbot.validation.js';

const router = Router();

router.get('/health', authenticate, ctrl.health);
router.post(
  '/chat',
  authenticate,
  validate(chatSchema),
  auditLog('CHATBOT_ASK', req => ({ type: 'chatbot', id: null })),
  ctrl.chat
);

export default router;
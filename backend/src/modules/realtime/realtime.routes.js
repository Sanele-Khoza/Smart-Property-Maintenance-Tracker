import { Router } from 'express';
import * as ctrl from './realtime.controller.js';
import authenticate from '../../middleware/authenticate.js';

const router = Router();
router.get('/subscribe', authenticate, ctrl.subscribe);
export default router;

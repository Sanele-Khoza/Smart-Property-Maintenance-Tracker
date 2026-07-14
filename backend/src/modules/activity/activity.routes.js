import { Router } from 'express';
import * as ctrl from './activity.controller.js';
import authenticate from '../../middleware/authenticate.js';

const router = Router();
router.get('/', authenticate, ctrl.list);
export default router;

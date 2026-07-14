import { Router } from 'express';
import * as ctrl from './notification-preferences.controller.js';
import authenticate from '../../middleware/authenticate.js';

const router = Router();

router.get('/', authenticate, ctrl.getPreferences);
router.put('/', authenticate, ctrl.updatePreference);

export default router;

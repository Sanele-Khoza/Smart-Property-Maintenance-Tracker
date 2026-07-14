import { Router } from 'express';
import * as ctrl from './profile.controller.js';
import authenticate from '../../middleware/authenticate.js';
import upload from '../../middleware/upload.js';

const router = Router();

router.get('/', authenticate, ctrl.getProfile);
router.put('/', authenticate, ctrl.updateProfile);
router.put('/avatar', authenticate, upload.single('avatar'), ctrl.uploadAvatar);

export default router;

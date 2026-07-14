import { Router } from 'express';
import * as ctrl from './help.controller.js';

const router = Router();

router.get('/', ctrl.getHelp);
router.get('/:topic', ctrl.getTopic);

export default router;

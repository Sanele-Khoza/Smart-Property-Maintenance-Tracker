import { Router } from 'express';
import express from 'express';
import * as ctrl from './backup.controller.js';
import authenticate from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import auditLog from '../../middleware/auditLog.js';
import { Roles } from '../../shared/constants/roles.js';

const router = Router();

/* Backup payloads can be large — allow up to 50mb on these routes. */
router.use(express.json({ limit: '50mb' }));

router.get('/info', authenticate, authorize(Roles.SYSTEM_ADMIN), ctrl.getInfo);
router.post('/export', authenticate, authorize(Roles.SYSTEM_ADMIN), auditLog('BACKUP_EXPORTED', () => ({ type: 'backup', id: null })), ctrl.exportData);
router.post('/import', authenticate, authorize(Roles.SYSTEM_ADMIN), auditLog('BACKUP_RESTORED', () => ({ type: 'backup', id: null })), ctrl.importData);

export default router;

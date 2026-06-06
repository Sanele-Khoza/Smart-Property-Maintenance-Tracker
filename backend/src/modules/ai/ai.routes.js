import { Router } from 'express';
import * as ctrl from './ai.controller.js';
import authenticate from '../../middleware/authenticate.js';
import { authorize, hasPermission } from '../../middleware/authorize.js';
import validate from '../../middleware/validate.js';
import { classifyAiSchema, extractEntitiesSchema, lowConfidenceQuerySchema, reviewQueueSchema } from './ai.validation.js';
import { Roles } from '../../shared/constants/roles.js';

const router = Router();

router.post('/classify/:ticketId', authenticate, hasPermission('tickets.update.status'), validate(classifyAiSchema), ctrl.classify);

router.get('/low-confidence-queue', authenticate, authorize(Roles.PROPERTY_MANAGER, Roles.SYSTEM_ADMIN), validate(lowConfidenceQuerySchema), ctrl.getLowConfidenceQueue);
router.put('/low-confidence-queue/:id/review', authenticate, authorize(Roles.PROPERTY_MANAGER, Roles.SYSTEM_ADMIN), validate(reviewQueueSchema), ctrl.reviewQueueItem);
router.get('/low-confidence-queue/stats', authenticate, authorize(Roles.PROPERTY_MANAGER, Roles.SYSTEM_ADMIN), ctrl.getQueueStats);

router.get('/entities/:ticketId', authenticate, hasPermission('tickets.view.own'), ctrl.getEntities);
router.get('/duplicates/:ticketId', authenticate, hasPermission('tickets.view.own'), ctrl.getDuplicates);

router.post('/extract-entities', authenticate, validate(extractEntitiesSchema), ctrl.extractEntities);

router.get('/python/classify-assign/:ticketId', authenticate, hasPermission('tickets.view.own'), ctrl.pythonClassifyAndAssign);

export default router;

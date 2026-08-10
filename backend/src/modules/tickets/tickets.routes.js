import { Router } from 'express';
import upload, { moderateUpload } from '../../middleware/upload.js';
import * as ctrl from './tickets.controller.js';
import authenticate from '../../middleware/authenticate.js';
import { authorize, hasPermission } from '../../middleware/authorize.js';
import validate from '../../middleware/validate.js';
import {
  createTicketSchema, updateTicketSchema, changeStatusSchema, assignTicketSchema,
  reopenTicketSchema, rateTicketSchema, overrideAiSchema, classifyTicketSchema,
  acceptSchema, startWorkSchema, waitingPartsSchema, partsReceivedSchema,
  tenantConfirmSchema, closeSchema,
} from './tickets.validation.js';
import { Roles } from '../../shared/constants/roles.js';

const router = Router();

router.get('/', authenticate, authorize(Roles.TENANT, Roles.PROPERTY_MANAGER, Roles.SERVICE_PROVIDER, Roles.SYSTEM_ADMIN), ctrl.list);
router.get('/:id', authenticate, authorize(Roles.TENANT, Roles.PROPERTY_MANAGER, Roles.SERVICE_PROVIDER, Roles.SYSTEM_ADMIN), ctrl.getById);
router.post('/', authenticate, authorize(Roles.TENANT, Roles.PROPERTY_MANAGER, Roles.SYSTEM_ADMIN), validate(createTicketSchema), ctrl.create);
router.put('/:id', authenticate, authorize(Roles.PROPERTY_MANAGER, Roles.SYSTEM_ADMIN), validate(updateTicketSchema), ctrl.update);
router.put('/:id/status', authenticate, authorize(Roles.TENANT, Roles.PROPERTY_MANAGER, Roles.SERVICE_PROVIDER, Roles.SYSTEM_ADMIN), validate(changeStatusSchema), ctrl.changeStatus);
router.put('/:id/assign', authenticate, authorize(Roles.PROPERTY_MANAGER, Roles.SYSTEM_ADMIN), validate(assignTicketSchema), ctrl.assign);

/* ── Workflow: New → AI Classified → Assigned → Accepted → In Progress → Waiting Parts → Completed → Tenant Confirms → Closed ── */
router.post('/:id/classify', authenticate, hasPermission('tickets.update.status'), validate(classifyTicketSchema), ctrl.classify);
router.put('/:id/accept', authenticate, authorize(Roles.SERVICE_PROVIDER, Roles.SYSTEM_ADMIN), validate(acceptSchema), ctrl.accept);
router.put('/:id/start', authenticate, authorize(Roles.SERVICE_PROVIDER, Roles.PROPERTY_MANAGER, Roles.SYSTEM_ADMIN), validate(startWorkSchema), ctrl.startWork);
router.put('/:id/waiting-parts', authenticate, authorize(Roles.SERVICE_PROVIDER, Roles.PROPERTY_MANAGER, Roles.SYSTEM_ADMIN), validate(waitingPartsSchema), ctrl.waitingParts);
router.put('/:id/parts-received', authenticate, authorize(Roles.SERVICE_PROVIDER, Roles.PROPERTY_MANAGER, Roles.SYSTEM_ADMIN), validate(partsReceivedSchema), ctrl.partsReceived);
router.put('/:id/complete', authenticate, authorize(Roles.SERVICE_PROVIDER, Roles.PROPERTY_MANAGER, Roles.SYSTEM_ADMIN), ctrl.complete);
router.put('/:id/tenant-confirm', authenticate, authorize(Roles.TENANT, Roles.SYSTEM_ADMIN), validate(tenantConfirmSchema), ctrl.tenantConfirm);
router.put('/:id/close', authenticate, authorize(Roles.PROPERTY_MANAGER, Roles.SYSTEM_ADMIN), validate(closeSchema), ctrl.close);
router.put('/:id/reopen', authenticate, authorize(Roles.TENANT, Roles.PROPERTY_MANAGER, Roles.SYSTEM_ADMIN), validate(reopenTicketSchema), ctrl.reopen);

/* BR-006 / BR-009 / BR-010 */
router.put('/:id/confirm', authenticate, authorize(Roles.PROPERTY_MANAGER, Roles.SYSTEM_ADMIN), ctrl.confirm);
router.put('/:id/override-ai', authenticate, authorize(Roles.PROPERTY_MANAGER, Roles.SYSTEM_ADMIN), validate(overrideAiSchema), ctrl.overrideAi);
router.put('/:id/downgrade-emergency', authenticate, authorize(Roles.SYSTEM_ADMIN), ctrl.downgradeEmergency);

router.post('/:id/rate', authenticate, authorize(Roles.TENANT), validate(rateTicketSchema), ctrl.rate);
router.get('/:id/history', authenticate, authorize(Roles.TENANT, Roles.PROPERTY_MANAGER, Roles.SERVICE_PROVIDER, Roles.SYSTEM_ADMIN), ctrl.getHistory);
router.get('/:id/comments', authenticate, authorize(Roles.TENANT, Roles.PROPERTY_MANAGER, Roles.SERVICE_PROVIDER, Roles.SYSTEM_ADMIN), ctrl.getComments);
router.post('/:id/comments', authenticate, authorize(Roles.TENANT, Roles.PROPERTY_MANAGER, Roles.SERVICE_PROVIDER, Roles.SYSTEM_ADMIN), ctrl.addComment);
router.get('/:id/attachments', authenticate, hasPermission('tickets.view.own'), ctrl.getAttachments);
router.post('/:id/attachments', authenticate, hasPermission('tickets.create'), upload.single('file'), moderateUpload, ctrl.addAttachment);
router.delete('/:id/attachments/:attachmentId', authenticate, hasPermission('tickets.delete'), ctrl.removeAttachment);
router.get('/:id/attachments/:attachmentId/url', authenticate, hasPermission('tickets.view.own'), ctrl.getAttachmentUrl);

router.get('/:id/routing', authenticate, authorize(Roles.PROPERTY_MANAGER, Roles.SYSTEM_ADMIN), ctrl.routing);
router.get('/:id/sla', authenticate, authorize(Roles.TENANT, Roles.PROPERTY_MANAGER, Roles.SERVICE_PROVIDER, Roles.SYSTEM_ADMIN), ctrl.sla);

export default router;

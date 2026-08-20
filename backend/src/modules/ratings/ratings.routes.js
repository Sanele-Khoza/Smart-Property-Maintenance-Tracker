import express from 'express';
import * as controller from './ratings.controller.js';
import authenticate from '../../middleware/authenticate.js';
import requireRole from '../../middleware/requireRole.js';

const router = express.Router();

// Tenant submits a rating
router.post('/', authenticate, requireRole('TENANT'), controller.createRating);

// Role-scoped list of individual ratings + comments (all four roles)
router.get('/', authenticate, controller.listRatings);

// View ratings for a ticket
router.get('/ticket/:ticketId', authenticate, controller.getTicketRatings);

export default router;
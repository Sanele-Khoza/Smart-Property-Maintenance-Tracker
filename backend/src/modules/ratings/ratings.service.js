import * as repository from './ratings.repository.js';
import { validateCreateRating } from './ratings.validation.js';
import AppError from '../../shared/errors/AppError.js';

const createRating = async (userId, data) => {
  const { ticketId, rating, comment } = data;

  // Input validation (shape/format only)
  validateCreateRating({ ticketId, rating });

  // Check that the ticket exists and belongs to the tenant
  const ticket = await repository.findTicket(ticketId);

  if (!ticket) {
    throw AppError.notFound('Ticket not found.');
  }

  if (ticket.tenant_id !== userId) {
    throw AppError.forbidden('You can only rate your own tickets.');
  }

  if (ticket.status !== 'Tenant Confirmed') {
    throw AppError.badRequest('You must confirm the work is resolved before rating it.');
  }

  // Prevent duplicate ratings
  const existing = await repository.findExistingRating(ticketId, userId);

  if (existing) {
    throw AppError.badRequest('This ticket has already been rated.');
  }

  // Save rating
  const created = await repository.createRating(
    ticketId,
    userId,
    rating,
    comment
  );

  return created;
};

const getTicketRatings = async (ticketId) => {
  return repository.getTicketRatings(ticketId);
};

export { createRating, getTicketRatings };
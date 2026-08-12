import * as repository from './ratings.repository.js';
import { validateCreateRating } from './ratings.validation.js';
import AppError from '../../shared/errors/AppError.js';

/*
 * Moving-average formula: combine the provider's existing rating with the new
 * score. The old rating counts `oldCount` times, the new score counts once.
 *
 *   finalRating = (oldRating * oldCount + newScore) / (oldCount + 1)
 *
 * Returns the new aggregate rounded to two decimal places and the updated
 * rating count, keeping service_providers.rating in sync with the ratings.
 */
const computeFinalRating = (oldRating, oldCount, newScore) => {
  const prev = Number(oldRating) || 0;
  const count = Math.max(Number(oldCount) || 0, 0);
  const score = Number(newScore);
  const final = (prev * count + score) / (count + 1);
  return { rating: Math.round(final * 100) / 100, ratingCount: count + 1 };
};

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

  // Save the rating and roll the provider's aggregate rating forward atomically
  const { created, provider } = await repository.createRatingWithSync({
    ticketId,
    userId,
    rating,
    comment,
    providerId: ticket.assigned_to || null,
  });

  const finalRating = provider ? Number(provider.rating) : rating;
  const ratingCount = provider ? provider.rating_count : 1;

  return {
    ticketId,
    rating: created.rating,
    comment: created.comment ?? null,
    finalRating,
    ratingCount,
  };
};

const getTicketRatings = async (ticketId) => {
  return repository.getTicketRatings(ticketId);
};

export { createRating, getTicketRatings, computeFinalRating };
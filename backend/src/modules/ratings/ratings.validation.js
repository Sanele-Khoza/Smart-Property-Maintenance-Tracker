import AppError from '../../shared/errors/AppError.js';

const validateCreateRating = ({ ticketId, rating }) => {
  if (!ticketId || rating === undefined || rating === null) {
    throw AppError.badRequest('Ticket ID and rating are required.');
  }

  if (typeof rating !== 'number' || rating < 1 || rating > 5) {
    throw AppError.badRequest('Rating must be between 1 and 5.');
  }
};

export { validateCreateRating };
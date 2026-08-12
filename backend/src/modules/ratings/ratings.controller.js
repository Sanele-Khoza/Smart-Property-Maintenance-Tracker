import * as service from './ratings.service.js';

const createRating = async (req, res, next) => {
  try {
    const result = await service.createRating(req.user.id, req.body);

    res.status(201).json({
      success: true,
      message: 'Rating submitted successfully.',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

const getTicketRatings = async (req, res, next) => {
  try {
    const result = await service.getTicketRatings(req.params.ticketId);

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

export { createRating, getTicketRatings };
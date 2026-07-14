import * as repo from './tenants.repository.js';
import * as ticketsService from '../tickets/tickets.service.js';
import AppError from '../../shared/errors/AppError.js';

async function myTickets(userId) {
  const tickets = await repo.findTicketsByTenant(userId);
  return { success: true, data: { tickets } };
}

async function getProfile(userId) {
  const user = await repo.findUserById(userId);
  if (!user) throw AppError.notFound('User not found');
  const units = await repo.findUnitsByOccupant(userId);
  return { success: true, data: { user, units } };
}

async function updateProfile(userId, body) {
  const { name, surname, phone } = body;
  if (!name && !surname && phone === undefined) throw AppError.badRequest('No fields to update');
  const user = await repo.updateProfile(userId, { name, surname, phone });
  if (!user) throw AppError.badRequest('No fields to update');
  return { success: true, data: { user }, message: 'Profile updated' };
}

async function rateTicket(ticketId, userId, body) {
  const { rating, comment } = body;
  if (!rating || rating < 1 || rating > 5) throw AppError.badRequest('Rating must be between 1 and 5');
  const result = await ticketsService.rate(ticketId, userId, rating, comment);
  return result;
}

export { myTickets, getProfile, updateProfile, rateTicket };

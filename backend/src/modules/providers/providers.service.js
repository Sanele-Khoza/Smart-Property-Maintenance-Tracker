import { query } from '../../db/connection.js';
import * as repo from './providers.repository.js';
import * as ticketsRepo from '../tickets/tickets.repository.js';
import AppError from '../../shared/errors/AppError.js';

async function findTechByUserId(userId) {
  const userEmail = await repo.findUserEmailById(userId);
  if (!userEmail) return null;
  return repo.findTechnicianByEmail(userEmail.email);
}

async function myJobs(userId) {
  const tech = await findTechByUserId(userId);
  if (!tech) return { success: true, data: { tickets: [] } };
  const result = await ticketsRepo.findAll({ assigned_to_id: tech.id });
  return { success: true, data: { tickets: result.tickets } };
}

async function acceptTicket(ticketId, userId, userName) {
  const tech = await findTechByUserId(userId);
  if (!tech) throw AppError.notFound('Technician profile not found');

  const ticket = await ticketsRepo.findById(Number(ticketId));
  if (!ticket) throw AppError.notFound('Ticket not found');
  if (ticket.assigned_to_id !== tech.id) throw AppError.forbidden('This ticket is not assigned to you');

  await ticketsRepo.update(Number(ticketId), { status: 'In Progress' });
  await ticketsRepo.addHistory(Number(ticketId), 'In Progress', userId, userName, 'Job accepted');
  return { success: true, message: 'Ticket accepted' };
}

async function completeTicket(ticketId, userId, userName, body) {
  const tech = await findTechByUserId(userId);
  if (!tech) throw AppError.notFound('Technician profile not found');

  const ticket = await ticketsRepo.findById(Number(ticketId));
  if (!ticket) throw AppError.notFound('Ticket not found');
  if (ticket.assigned_to_id !== tech.id) throw AppError.forbidden('This ticket is not assigned to you');

  const { description, materials_used, hours_worked, notes } = body;

  await ticketsRepo.update(Number(ticketId), { status: 'Completed' });
  await ticketsRepo.addHistory(Number(ticketId), 'Completed', userId, userName, 'Job completed');

  if (description) {
    await query(
      'INSERT INTO completion_reports (ticket_id, provider_name, description, materials_used, hours_worked, notes) VALUES ($1, $2, $3, $4, $5, $6)',
      [Number(ticketId), userName, description, materials_used || null, hours_worked || null, notes || null]
    );
  }
  return { success: true, message: 'Ticket completed' };
}

async function myAvailability(userId) {
  const tech = await findTechByUserId(userId);
  if (!tech) throw AppError.notFound('Technician profile not found');
  const result = await query(
    'SELECT * FROM availability_slots WHERE technician_id = $1 ORDER BY day_of_week ASC, start_time ASC',
    [tech.id]
  );
  return { success: true, data: { availability: result.rows } };
}

async function updateAvailability(userId, body) {
  const tech = await findTechByUserId(userId);
  if (!tech) throw AppError.notFound('Technician profile not found');
  const { dayOfWeek, startTime, endTime } = body;
  if (dayOfWeek === undefined || !startTime || !endTime) {
    throw AppError.badRequest('dayOfWeek, startTime, endTime required');
  }
  const existing = await query(
    'SELECT * FROM availability_slots WHERE technician_id = $1 AND day_of_week = $2 AND start_time = $3',
    [tech.id, dayOfWeek, startTime]
  );
  if (existing.rows.length > 0) {
    await query('UPDATE availability_slots SET end_time = $1 WHERE id = $2', [endTime, existing.rows[0].id]);
  } else {
    await query(
      'INSERT INTO availability_slots (technician_id, day_of_week, start_time, end_time) VALUES ($1, $2, $3, $4)',
      [tech.id, dayOfWeek, startTime, endTime]
    );
  }
  const result = await query(
    'SELECT * FROM availability_slots WHERE technician_id = $1 ORDER BY day_of_week ASC, start_time ASC',
    [tech.id]
  );
  return { success: true, data: { availability: result.rows }, message: 'Availability updated' };
}

export { myJobs, acceptTicket, completeTicket, myAvailability, updateAvailability };

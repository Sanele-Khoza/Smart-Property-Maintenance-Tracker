import { query } from '../../db/connection.js';
import AppError from '../../shared/errors/AppError.js';

const findProviderByUserId = async (userId) => {
  const userEmail = await query('SELECT email FROM users WHERE id = $1', [userId]);
  if (!userEmail.rows.length) return null;
  const provider = await query('SELECT * FROM service_providers WHERE email = $1', [userEmail.rows[0].email]);
  return provider.rows[0] || null;
};

const myJobs = async (req, res, next) => {
  try {
    const tech = await findProviderByUserId(req.user.id);
    if (!tech) return res.json({ success: true, data: { tickets: [] } });
    const result = await query(
      `SELECT t.*, u.unit_number, p.name as property_name, p.address as property_address,
              t.category AS category_name
       FROM tickets t
       LEFT JOIN units u ON t.unit_id = u.id
       LEFT JOIN properties p ON u.property_id = p.id
       WHERE t.assigned_to = $1 AND t.deleted_at IS NULL
       ORDER BY t.due_date ASC, t.priority DESC`,
      [tech.id]
    );
    res.json({ success: true, data: { tickets: result.rows } });
  } catch (err) { next(err); }
};

const acceptTicket = async (req, res, next) => {
  try {
    const ticketId = Number(req.params.id);
    const tech = await findProviderByUserId(req.user.id);
    if (!tech) throw AppError.notFound('Technician profile not found');
    const ticket = await query('SELECT id, assigned_to FROM tickets WHERE id = $1', [ticketId]);
    if (!ticket.rows.length) throw AppError.notFound('Ticket not found');
    if (ticket.rows[0].assigned_to !== tech.id) throw AppError.forbidden('Not assigned to you');
    await query("UPDATE tickets SET status = 'In Progress', updated_at = NOW() WHERE id = $1", [ticketId]);
    await query('INSERT INTO ticket_status_history (ticket_id, status, changed_by, changed_by_name, reason) VALUES ($1, $2, $3, $4, $5)', [ticketId, 'In Progress', req.user.id, `${req.user.name} ${req.user.surname}`, 'Job accepted']);
    res.json({ success: true, message: 'Ticket accepted' });
  } catch (err) { next(err); }
};

const completeTicket = async (req, res, next) => {
  try {
    const ticketId = Number(req.params.id);
    const tech = await findProviderByUserId(req.user.id);
    if (!tech) throw AppError.notFound('Technician profile not found');
    const ticket = await query('SELECT id, assigned_to FROM tickets WHERE id = $1', [ticketId]);
    if (!ticket.rows.length) throw AppError.notFound('Ticket not found');
    if (ticket.rows[0].assigned_to !== tech.id) throw AppError.forbidden('Not assigned to you');
    await query("UPDATE tickets SET status = 'Completed', updated_at = NOW() WHERE id = $1", [ticketId]);
    await query('INSERT INTO ticket_status_history (ticket_id, status, changed_by, changed_by_name, reason) VALUES ($1, $2, $3, $4, $5)', [ticketId, 'Completed', req.user.id, `${req.user.name} ${req.user.surname}`, 'Job completed']);
    res.json({ success: true, message: 'Ticket completed' });
  } catch (err) { next(err); }
};

const myAvailability = async (req, res, next) => {
  try {
    const tech = await findProviderByUserId(req.user.id);
    if (!tech) throw AppError.notFound('Technician profile not found');
    const result = await query('SELECT * FROM availability_slots WHERE technician_id = $1 ORDER BY day_of_week ASC, start_time ASC', [tech.id]);
    res.json({ success: true, data: { availability: result.rows } });
  } catch (err) { next(err); }
};

const updateAvailability = async (req, res, next) => {
  try {
    const tech = await findProviderByUserId(req.user.id);
    if (!tech) throw AppError.notFound('Technician profile not found');
    const { dayOfWeek, startTime, endTime } = req.body;
    if (dayOfWeek === undefined || !startTime || !endTime) throw AppError.badRequest('dayOfWeek, startTime, endTime required');
    const existing = await query('SELECT * FROM availability_slots WHERE technician_id = $1 AND day_of_week = $2 AND start_time = $3', [tech.id, dayOfWeek, startTime]);
    if (existing.rows.length > 0) {
      await query('UPDATE availability_slots SET end_time = $1 WHERE id = $2', [endTime, existing.rows[0].id]);
    } else {
      await query('INSERT INTO availability_slots (technician_id, day_of_week, start_time, end_time) VALUES ($1, $2, $3, $4)', [tech.id, dayOfWeek, startTime, endTime]);
    }
    const result = await query('SELECT * FROM availability_slots WHERE technician_id = $1 ORDER BY day_of_week ASC, start_time ASC', [tech.id]);
    res.json({ success: true, data: { availability: result.rows }, message: 'Availability updated' });
  } catch (err) { next(err); }
};

export { myJobs, acceptTicket, completeTicket, myAvailability, updateAvailability };

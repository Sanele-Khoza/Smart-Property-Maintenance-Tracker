import { query } from '../../db/connection.js';

const getStatistics = async (req, res, next) => {
  try {
    const [totalProperties, totalUnits, occupiedUnits, totalTickets, openTickets, manualReviewTickets, assignedTickets, inProgressTickets, completedTickets, closedTickets, conflictDetected, slaBreachedTickets, totalNotifications, failedNotifications] = await Promise.all([
      query('SELECT COUNT(*)::int AS count FROM properties').then(r => r.rows[0].count),
      query('SELECT COUNT(*)::int AS count FROM units').then(r => r.rows[0].count),
      query("SELECT COUNT(*)::int AS count FROM units WHERE status = 'Occupied'").then(r => r.rows[0].count),
      query('SELECT COUNT(*)::int AS count FROM tickets').then(r => r.rows[0].count),
      query("SELECT COUNT(*)::int AS count FROM tickets WHERE status = 'Open'").then(r => r.rows[0].count),
      query("SELECT COUNT(*)::int AS count FROM tickets WHERE manual_review_required = TRUE").then(r => r.rows[0].count),
      query("SELECT COUNT(*)::int AS count FROM tickets WHERE status = 'Assigned'").then(r => r.rows[0].count),
      query("SELECT COUNT(*)::int AS count FROM tickets WHERE status = 'In Progress'").then(r => r.rows[0].count),
      query("SELECT COUNT(*)::int AS count FROM tickets WHERE status = 'Completed'").then(r => r.rows[0].count),
      query("SELECT COUNT(*)::int AS count FROM tickets WHERE status = 'Closed'").then(r => r.rows[0].count),
      query('SELECT COUNT(*)::int AS count FROM tickets WHERE conflict_detected = TRUE').then(r => r.rows[0].count),
      query('SELECT COUNT(*)::int AS count FROM tickets WHERE sla_breached = TRUE').then(r => r.rows[0].count),
      query('SELECT COUNT(*)::int AS count FROM notifications').then(r => r.rows[0].count),
      query("SELECT COUNT(*)::int AS count FROM notifications WHERE delivery_status = 'Failed'").then(r => r.rows[0].count),
    ]);
    res.json({ success: true, data: { totalProperties, totalUnits, occupiedUnits, totalTickets, openTickets, manualReviewTickets, assignedTickets, inProgressTickets, completedTickets, closedTickets, conflictDetected, slaBreachedTickets, totalNotifications, failedNotifications } });
  } catch (err) { next(err); }
};

export { getStatistics };

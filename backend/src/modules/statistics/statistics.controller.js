import { query } from '../../db/connection.js';

const getStatistics = async (req, res, next) => {
  try {
    const [totalProperties, totalUnits, occupiedUnits, totalTickets, openTickets, manualReviewTickets, assignedTickets, inProgressTickets, completedTickets, closedTickets, conflictDetected, slaBreachedTickets, totalNotifications, failedNotifications] = await Promise.all([
      query('SELECT COUNT(*)::int AS count FROM properties').then(r => r.rows[0].count),
      query('SELECT COUNT(*)::int AS count FROM units').then(r => r.rows[0].count),
      query("SELECT COUNT(*)::int AS count FROM units WHERE status = 'Occupied'").then(r => r.rows[0].count),
      query('SELECT COUNT(*)::int AS count FROM tickets WHERE deleted_at IS NULL').then(r => r.rows[0].count),
      query("SELECT COUNT(*)::int AS count FROM tickets WHERE deleted_at IS NULL AND status = 'Open'").then(r => r.rows[0].count),
      query('SELECT COUNT(*)::int AS count FROM tickets WHERE deleted_at IS NULL AND duplicate_group_id IS NOT NULL').then(r => r.rows[0].count),
      query("SELECT COUNT(*)::int AS count FROM tickets WHERE deleted_at IS NULL AND status = 'Assigned'").then(r => r.rows[0].count),
      query("SELECT COUNT(*)::int AS count FROM tickets WHERE deleted_at IS NULL AND status = 'In Progress'").then(r => r.rows[0].count),
      query("SELECT COUNT(*)::int AS count FROM tickets WHERE deleted_at IS NULL AND status = 'Completed'").then(r => r.rows[0].count),
      query("SELECT COUNT(*)::int AS count FROM tickets WHERE deleted_at IS NULL AND status = 'Closed'").then(r => r.rows[0].count),
      query('SELECT COUNT(*)::int AS count FROM tickets WHERE deleted_at IS NULL AND conflict_detected = TRUE').then(r => r.rows[0].count),
      query('SELECT COUNT(*)::int AS count FROM tickets WHERE deleted_at IS NULL AND sla_breached = TRUE').then(r => r.rows[0].count),
      query('SELECT COUNT(*)::int AS count FROM notifications').then(r => r.rows[0].count),
      query("SELECT COUNT(*)::int AS count FROM notifications WHERE delivery_status = 'Failed'").then(r => r.rows[0].count),
    ]);
    res.json({ success: true, data: { totalProperties, totalUnits, occupiedUnits, totalTickets, openTickets, manualReviewTickets, assignedTickets, inProgressTickets, completedTickets, closedTickets, conflictDetected, slaBreachedTickets, totalNotifications, failedNotifications } });
  } catch (err) { next(err); }
};

export { getStatistics };

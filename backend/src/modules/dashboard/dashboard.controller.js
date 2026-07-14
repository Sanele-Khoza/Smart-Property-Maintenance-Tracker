import { query } from '../../db/connection.js';

const getDashboard = async (req, res, next) => {
  try {
    const role = req.user.role;
    let result;

    if (role === 'TENANT') {
      const [openTickets, completedTickets, invoices, lease] = await Promise.all([
        query("SELECT COUNT(*)::int AS count FROM tickets WHERE tenant_id = $1 AND status NOT IN ('Completed', 'Cancelled', 'Archived')", [req.user.id]).then(r => r.rows[0].count),
        query("SELECT COUNT(*)::int AS count FROM tickets WHERE tenant_id = $1 AND status = 'Completed'", [req.user.id]).then(r => r.rows[0].count),
        query("SELECT COUNT(*)::int AS count FROM invoices WHERE tenant_id = $1 AND status = 'UNPAID'", [req.user.id]).then(r => r.rows[0].count),
        query("SELECT COUNT(*)::int AS count FROM leases WHERE tenant_id = $1 AND status = 'ACTIVE'", [req.user.id]).then(r => r.rows[0].count),
      ]);
      result = { openTickets, completedTickets, unpaidInvoices: invoices, activeLeases: lease };
    } else if (role === 'SERVICE_PROVIDER') {
      const provider = await query('SELECT id FROM service_providers WHERE email = $1', [req.user.email]);
      const providerId = provider.rows[0]?.id;
      if (providerId) {
        const [assigned, completed] = await Promise.all([
          query("SELECT COUNT(*)::int AS count FROM tickets WHERE assigned_to = $1 AND status NOT IN ('Completed', 'Cancelled', 'Archived')", [providerId]).then(r => r.rows[0].count),
          query("SELECT COUNT(*)::int AS count FROM tickets WHERE assigned_to = $1 AND status = 'Completed'", [providerId]).then(r => r.rows[0].count),
        ]);
        result = { assignedJobs: assigned, completedJobs: completed };
      } else {
        result = { assignedJobs: 0, completedJobs: 0 };
      }
    } else {
      const [openTickets, completedTickets, overdueTickets, totalProperties, totalUnits, availableProviders] = await Promise.all([
        query("SELECT COUNT(*)::int AS count FROM tickets WHERE status NOT IN ('Completed', 'Cancelled', 'Archived')").then(r => r.rows[0].count),
        query("SELECT COUNT(*)::int AS count FROM tickets WHERE status = 'Completed'").then(r => r.rows[0].count),
        query("SELECT COUNT(*)::int AS count FROM tickets WHERE status NOT IN ('Completed', 'Cancelled', 'Archived') AND due_date < NOW()").then(r => r.rows[0].count),
        query('SELECT COUNT(*)::int AS count FROM properties').then(r => r.rows[0].count),
        query('SELECT COUNT(*)::int AS count FROM units').then(r => r.rows[0].count),
        query("SELECT COUNT(*)::int AS count FROM service_providers WHERE status IN ('AVAILABLE', 'ON_CALL')").then(r => r.rows[0].count),
      ]);
      result = { openTickets, completedTickets, overdueTickets, totalProperties, totalUnits, availableProviders };
    }

    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

const getStats = async (req, res, next) => {
  try {
    const [totalProperties, totalUnits, occupiedUnits, totalTickets, openTickets, assignedTickets, inProgressTickets, completedTickets, closedTickets, conflictDetected, totalNotifications, failedNotifications] = await Promise.all([
      query('SELECT COUNT(*)::int AS count FROM properties').then(r => r.rows[0].count),
      query('SELECT COUNT(*)::int AS count FROM units').then(r => r.rows[0].count),
      query("SELECT COUNT(*)::int AS count FROM units WHERE status = 'Occupied'").then(r => r.rows[0].count),
      query('SELECT COUNT(*)::int AS count FROM tickets').then(r => r.rows[0].count),
      query("SELECT COUNT(*)::int AS count FROM tickets WHERE status = 'Open'").then(r => r.rows[0].count),
      query("SELECT COUNT(*)::int AS count FROM tickets WHERE status = 'Assigned'").then(r => r.rows[0].count),
      query("SELECT COUNT(*)::int AS count FROM tickets WHERE status = 'In Progress'").then(r => r.rows[0].count),
      query("SELECT COUNT(*)::int AS count FROM tickets WHERE status = 'Completed'").then(r => r.rows[0].count),
      query("SELECT COUNT(*)::int AS count FROM tickets WHERE status = 'Closed'").then(r => r.rows[0].count),
      query('SELECT COUNT(*)::int AS count FROM tickets WHERE conflict_detected = TRUE').then(r => r.rows[0].count),
      query('SELECT COUNT(*)::int AS count FROM notifications').then(r => r.rows[0].count),
      query("SELECT COUNT(*)::int AS count FROM notifications WHERE delivery_status = 'Failed'").then(r => r.rows[0].count),
    ]);
    res.json({ success: true, data: { totalProperties, totalUnits, occupiedUnits, totalTickets, openTickets, assignedTickets, inProgressTickets, completedTickets, closedTickets, conflictDetected, totalNotifications, failedNotifications } });
  } catch (err) { next(err); }
};

const getPendingTickets = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const role = req.user.role;
    let result;
    if (role === 'TENANT') {
      result = await query(
        `SELECT id, title, priority, status, category, created_at, due_date
         FROM tickets WHERE tenant_id = $1 AND status NOT IN ('Completed','Cancelled','Archived')
         ORDER BY created_at DESC LIMIT $2`,
        [req.user.id, limit]
      );
    } else if (role === 'SERVICE_PROVIDER') {
      const provider = await query('SELECT id FROM service_providers WHERE email = $1', [req.user.email]);
      const providerId = provider.rows[0]?.id;
      if (!providerId) return res.json({ success: true, data: [] });
      result = await query(
        `SELECT id, title, priority, status, category, created_at, due_date
         FROM tickets WHERE assigned_to = $1 AND status NOT IN ('Completed','Cancelled','Archived')
         ORDER BY created_at DESC LIMIT $2`,
        [providerId, limit]
      );
    } else {
      result = await query(
        `SELECT id, title, priority, status, category, created_at, due_date
         FROM tickets WHERE status NOT IN ('Completed','Cancelled','Archived')
         ORDER BY created_at DESC LIMIT $1`,
        [limit]
      );
    }
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

const getCompletedTickets = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const role = req.user.role;
    let result;
    if (role === 'TENANT') {
      result = await query(
        `SELECT id, title, priority, status, category, created_at, updated_at
         FROM tickets WHERE tenant_id = $1 AND status = 'Completed'
         ORDER BY updated_at DESC LIMIT $2`,
        [req.user.id, limit]
      );
    } else if (role === 'SERVICE_PROVIDER') {
      const provider = await query('SELECT id FROM service_providers WHERE email = $1', [req.user.email]);
      const providerId = provider.rows[0]?.id;
      if (!providerId) return res.json({ success: true, data: [] });
      result = await query(
        `SELECT id, title, priority, status, category, created_at, updated_at
         FROM tickets WHERE assigned_to = $1 AND status = 'Completed'
         ORDER BY updated_at DESC LIMIT $2`,
        [providerId, limit]
      );
    } else {
      result = await query(
        `SELECT id, title, priority, status, category, created_at, updated_at
         FROM tickets WHERE status = 'Completed'
         ORDER BY updated_at DESC LIMIT $1`,
        [limit]
      );
    }
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

const getTicketTrends = async (req, res, next) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 30, 365);
    const result = await query(
      `SELECT DATE(created_at) as date,
              COUNT(*)::int as created,
              SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END)::int as completed
       FROM tickets
       WHERE created_at >= NOW() - INTERVAL '1 day' * $1
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      [days]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

export { getDashboard, getStats, getPendingTickets, getCompletedTickets, getTicketTrends };

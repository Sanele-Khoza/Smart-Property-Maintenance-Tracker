import { query } from '../../db/connection.js';

const list = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = parseInt(req.query.offset) || 0;
    const role = req.user.role;

    let sql;
    const params = [];
    let idx = 1;

    if (role === 'TENANT') {
      sql = `(SELECT 'ticket' AS type, t.id, t.title, t.status, t.created_at
              FROM tickets t WHERE t.tenant_id = $1 AND t.deleted_at IS NULL)
             UNION ALL
             (SELECT 'invoice' AS type, i.id, i.description AS title, i.status, i.created_at
              FROM invoices i WHERE i.tenant_id = $1)
             UNION ALL
             (SELECT 'notification' AS type, n.id::text, n.title, n.body, n.created_at
              FROM notifications n WHERE n.user_id = $1)`;
      params.push(req.user.id);
    } else {
      sql = `(SELECT 'ticket' AS type, t.id, t.title, t.status, t.created_at FROM tickets t WHERE t.deleted_at IS NULL)
             UNION ALL
             (SELECT 'user' AS type, u.id, u.name || ' ' || u.surname AS title, u.role, u.created_at FROM users u)
             UNION ALL
             (SELECT 'lease' AS type, l.id, u.unit_number AS title, l.status, l.created_at
              FROM leases l JOIN units u ON u.id = l.unit_id)`;
    }

    const countResult = await query(`SELECT COUNT(*) FROM (${sql}) sub`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await query(
      `${sql} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, offset]
    );

    res.json({ success: true, data: { activities: result.rows } });
  } catch (err) { next(err); }
};

export { list };

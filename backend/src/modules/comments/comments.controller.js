import { query } from '../../db/connection.js';
import AppError from '../../shared/errors/AppError.js';

const getByTicket = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT tc.*, u.name, u.surname
       FROM ticket_comments tc
       LEFT JOIN users u ON u.id = tc.user_id
       WHERE tc.ticket_id = $1
       ORDER BY tc.created_at ASC`,
      [Number(req.params.ticketId)]
    );
    res.json({ success: true, data: { comments: result.rows } });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const { comment } = req.body;
    if (!comment) throw AppError.badRequest('Comment is required');
    const result = await query(
      'INSERT INTO ticket_comments (ticket_id, user_id, comment) VALUES ($1, $2, $3) RETURNING *',
      [Number(req.params.ticketId), req.user.id, comment]
    );
    res.status(201).json({ success: true, data: { comment: result.rows[0] }, message: 'Comment added' });
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    await query('DELETE FROM ticket_comments WHERE id = $1 AND user_id = $2', [Number(req.params.id), req.user.id]);
    res.json({ success: true, message: 'Comment deleted' });
  } catch (err) { next(err); }
};

export { getByTicket, create, remove };

import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import AppError from '../shared/errors/AppError.js';
import { query } from '../db/connection.js';

async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(AppError.unauthorized('No token provided'));
  }

  let decoded;
  try {
    decoded = jwt.verify(header.split(' ')[1], config.jwt.secret);
  } catch {
    return next(AppError.unauthorized('Invalid or expired token'));
  }

  try {
    const result = await query(
      'SELECT id, email, role, status FROM users WHERE id = $1 AND deleted_at IS NULL',
      [decoded.id]
    );
    const user = result.rows[0];
    if (!user) {
      return next(AppError.unauthorized('Account not found'));
    }
    if (user.status !== 'ACTIVE') {
      return next(AppError.forbidden('Account is not active'));
    }
    req.user = { id: user.id, email: user.email, role: user.role, status: user.status };
    next();
  } catch (err) {
    next(err);
  }
}

export default authenticate;

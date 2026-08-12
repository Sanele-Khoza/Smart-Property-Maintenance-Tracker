import { Router } from 'express';
import jwt from 'jsonwebtoken';
import * as ctrl from './realtime.controller.js';
import authenticate from '../../middleware/authenticate.js';
import AppError from '../../shared/errors/AppError.js';
import config from '../../config/index.js';
import { query } from '../../db/connection.js';

async function authenticateSse(req, res, next) {
  if (req.headers.authorization) {
    return authenticate(req, res, next);
  }

  const token = req.query.token;
  if (!token) return next(AppError.unauthorized('No token provided'));

  let decoded;
  try {
    decoded = jwt.verify(token, config.jwt.secret);
  } catch {
    return next(AppError.unauthorized('Invalid or expired token'));
  }

  try {
    const result = await query(
      'SELECT id, email, role, status FROM users WHERE id = $1 AND deleted_at IS NULL',
      [decoded.id]
    );
    const user = result.rows[0];
    if (!user) return next(AppError.unauthorized('Account not found'));
    if (user.status !== 'ACTIVE') return next(AppError.forbidden('Account is not active'));
    req.user = { id: user.id, email: user.email, role: user.role, status: user.status };
    next();
  } catch (err) {
    next(err);
  }
}

const router = Router();
router.get('/subscribe', authenticateSse, ctrl.subscribe);
export default router;

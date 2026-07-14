import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import AppError from '../shared/errors/AppError.js';

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(AppError.unauthorized('No token provided'));
  }
  try {
    req.user = jwt.verify(header.split(' ')[1], config.jwt.secret);
    next();
  } catch {
    return next(AppError.unauthorized('Invalid or expired token'));
  }
}

export default authenticate;

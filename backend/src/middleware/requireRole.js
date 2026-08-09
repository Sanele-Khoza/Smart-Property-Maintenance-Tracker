import AppError from '../shared/errors/AppError.js';

const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return next(AppError.forbidden('You do not have permission to perform this action.'));
    }
    next();
  };
};

export default requireRole;
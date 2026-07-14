import AppError from '../shared/errors/AppError.js';
import { RBAC_MATRIX } from '../shared/constants/permissions.js';
import { Roles } from '../shared/constants/roles.js';

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(AppError.unauthorized('Not authenticated'));
    if (!roles.includes(req.user.role)) {
      return next(AppError.forbidden('Insufficient permissions'));
    }
    next();
  };
}

function hasPermission(...requiredPermissions) {
  return (req, res, next) => {
    if (!req.user) return next(AppError.unauthorized('Not authenticated'));

    const role = req.user.role;
    const userPermissions = RBAC_MATRIX[role];

    if (!userPermissions) {
      return next(AppError.forbidden('Role not recognized'));
    }

    if (role === Roles.SYSTEM_ADMIN) {
      return next();
    }

    const hasAll = requiredPermissions.every(p => userPermissions.includes(p));
    if (!hasAll) {
      return next(AppError.forbidden('You do not have the required permission'));
    }

    next();
  };
}

export { authorize, hasPermission };
export default authorize;

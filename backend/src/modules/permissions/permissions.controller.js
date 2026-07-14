import { query } from '../../db/connection.js';
import AppError from '../../shared/errors/AppError.js';
import { ALL_PERMISSIONS, PERMISSION_GROUPS, RBAC_MATRIX } from '../../shared/constants/permissions.js';
import { Roles } from '../../shared/constants/roles.js';

const ROLES = Object.values(Roles);

const getPermissions = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: {
        roles: ROLES,
        permissions: ALL_PERMISSIONS,
        permissionGroups: PERMISSION_GROUPS,
        permissionMatrix: RBAC_MATRIX,
      },
    });
  } catch (err) { next(err); }
};

const getUserPermissions = async (req, res, next) => {
  try {
    const userRole = req.user.role;
    const permissions = RBAC_MATRIX[userRole] || [];
    res.json({ success: true, data: { role: userRole, permissions } });
  } catch (err) { next(err); }
};

const setUserRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!ROLES.includes(role)) throw AppError.badRequest('Invalid role. Must be one of: ' + ROLES.join(', '));
    await query('UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2', [role, Number(req.params.userId)]);
    res.json({ success: true, message: 'Role updated' });
  } catch (err) { next(err); }
};

export { getPermissions, getUserPermissions, setUserRole };

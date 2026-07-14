import * as repo from './admin.repository.js';
import AppError from '../../shared/errors/AppError.js';

const VALID_ROLES = ['SYSTEM_ADMIN', 'PROPERTY_MANAGER', 'TENANT', 'SERVICE_PROVIDER'];

async function getUsers(filters) {
  const users = await repo.getUsers(filters);
  return { success: true, data: { users } };
}

async function approveUser(id) {
  await repo.approveUser(Number(id));
  return { success: true, message: 'User approved' };
}

async function deactivateUser(id) {
  await repo.setAccountStatus(Number(id), 'DEACTIVATED');
  return { success: true, message: 'User deactivated' };
}

async function reactivateUser(id) {
  await repo.setAccountStatus(Number(id), 'ACTIVE');
  return { success: true, message: 'User reactivated' };
}

async function changeRole(id, role) {
  if (!role || !VALID_ROLES.includes(role)) {
    throw AppError.badRequest('Invalid role');
  }
  await repo.changeRole(Number(id), role);
  return { success: true, message: 'Role updated' };
}

async function unlockUserSvc(id) {
  await repo.unlockUser(Number(id));
  return { success: true, message: 'User unlocked' };
}

export { getUsers, approveUser, deactivateUser, reactivateUser, changeRole, unlockUserSvc as unlockUser };

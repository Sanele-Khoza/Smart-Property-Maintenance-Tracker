import * as repo from './audit.repository.js';
import AppError from '../../shared/errors/AppError.js';

async function getLogs(limit, offset) {
  const safeLimit = Math.min(parseInt(limit) || 50, 200);
  const safeOffset = parseInt(offset) || 0;
  const { logs, total } = await repo.getAuditLogs(safeLimit, safeOffset);
  return { success: true, data: { logs }, pagination: { limit: safeLimit, offset: safeOffset, total } };
}

async function getSecurityLogs(limit, offset, severity) {
  const safeLimit = Math.min(parseInt(limit) || 50, 200);
  const safeOffset = parseInt(offset) || 0;
  const { logs, total } = await repo.getSecurityLogs(safeLimit, safeOffset, severity);
  return { success: true, data: { logs }, pagination: { limit: safeLimit, offset: safeOffset, total } };
}

async function createLog(action, userId, userName, details) {
  if (!action) throw AppError.badRequest('Action required');
  const id = await repo.createAuditLog(action, userId, userName, details);
  return { success: true, data: { id }, message: 'Audit log created' };
}

async function createSecurityLog(eventType, userId, details, ipAddress, severity) {
  if (!eventType) throw AppError.badRequest('Event type required');
  const id = await repo.createSecurityLog(eventType, userId, details, ipAddress, severity);
  return { success: true, data: { id }, message: 'Security log created' };
}

export { getLogs, getSecurityLogs, createLog, createSecurityLog };

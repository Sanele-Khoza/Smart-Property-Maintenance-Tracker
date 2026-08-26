import * as repo from './units.repository.js';
import AppError from '../../shared/errors/AppError.js';
import { query } from '../../db/connection.js';
import {
  sendUnitAssignedToTenantNotification,
  sendUnitAssignedToManagerNotification,
} from '../../shared/utils/email.service.js';

async function list(filters) {
  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 20;
  const offset = (page - 1) * limit;
  const { units, total } = await repo.findAll({ ...filters, limit, offset });
  return {
    success: true,
    data: { units },
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

async function getById(id) {
  const unit = await repo.findById(id);
  if (!unit) throw AppError.notFound('Unit not found');
  return { success: true, data: { unit } };
}

async function create(data) {
  const unit = await repo.create(data);
  return { success: true, data: { unit }, message: 'Unit created' };
}

async function update(id, data) {
  await repo.findById(id);
  const unit = await repo.update(id, data);
  return { success: true, data: { unit }, message: 'Unit updated' };
}

async function assign(unitId, tenantId, tenantName) {
  const unit = await repo.findById(unitId);
  if (!unit) throw AppError.notFound('Unit not found');

  let resolvedTenantId = tenantId;
  if (!resolvedTenantId && tenantName) {
    const parts = String(tenantName).trim().split(/\s+/);
    const found = await repo.findTenantIdByName(parts[0] || '', parts.slice(1).join(' ') || '');
    if (!found) throw AppError.notFound('Tenant not found');
    resolvedTenantId = found.id;
  }
  if (!resolvedTenantId) throw AppError.badRequest('Tenant ID or name is required');

  /* BR-001: check tenant is not already in another unit */
  const existingUnit = await repo.findByOccupant(resolvedTenantId);
  if (existingUnit) {
    throw AppError.conflict(
      `Tenant is already assigned to unit ${existingUnit.unit_number} in ${existingUnit.property_name}`
    );
  }
  if (unit.occupant_id) {
    throw AppError.conflict(`Unit ${unit.unit_number} already has an occupant`);
  }

  await repo.assign(unitId, resolvedTenantId);
  const updated = await repo.findById(unitId);

  (async () => {
    try {
      const tenantUser = (await query(
        `SELECT name, surname, email FROM users WHERE id = $1`, [resolvedTenantId]
      )).rows[0];
      const propRow = (await query(
        `SELECT p.id, p.name, p.address, p.manager_id FROM properties p WHERE p.id = $1`,
        [updated.property_id]
      )).rows[0];
      const property = { name: propRow?.name, address: propRow?.address };
      const unit = { unit_number: updated.unit_number, type: updated.type, bedrooms: updated.bedrooms, bathrooms: updated.bathrooms, size_sqm: updated.size_sqm };
      const tenantName = tenantUser ? `${tenantUser.name} ${tenantUser.surname}` : 'Tenant';

      sendUnitAssignedToTenantNotification(resolvedTenantId, unit, property).catch(() => {});
      if (propRow?.manager_id) {
        sendUnitAssignedToManagerNotification(propRow.manager_id, unit, property, tenantName).catch(() => {});
      }
    } catch (e) {
      console.error('Unit assignment notification failed:', e.message);
    }
  })();

  return { success: true, data: { unit: updated }, message: 'Unit assigned' };
}

async function vacate(unitId) {
  await repo.findById(unitId);
  await repo.vacate(unitId);
  const unit = await repo.findById(unitId);
  return { success: true, data: { unit }, message: 'Unit vacated' };
}

async function remove(id) {
  await repo.findById(id);
  await repo.remove(id);
  return { success: true, message: 'Unit deleted' };
}

export { list, getById, create, update, assign, vacate, remove };

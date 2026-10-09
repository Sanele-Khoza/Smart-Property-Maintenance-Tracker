import * as repo from './units.repository.js';
import AppError from '../../shared/errors/AppError.js';
import { query } from '../../db/connection.js';
import {
  sendUnitAssignedToTenantNotification,
  sendUnitAssignedToManagerNotification,
  sendUnitCreatedNotification,
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

/* Expand "1".."9" or "A1".."A9" (same prefix) into ["1",...,"9"].
   Respects zero-padding: "01".."09" keeps width 2. Max 100 units. */
function expandUnitRange(from, to, prefixOverride, suffixOverride) {
  const parsePart = (s) => {
    const m = String(s).trim().match(/^([A-Za-z]*)(\d+)([A-Za-z]*)$/);
    if (!m) return null;
    return { prefix: m[1] || '', numStr: m[2], num: parseInt(m[2], 10), suffix: m[3] || '' };
  };
  const a = parsePart(from);
  const b = parsePart(to);
  if (!a || !b) throw AppError.badRequest('Invalid range. Use e.g. from "1" to "9" or "A1" to "A9".');
  const prefix = prefixOverride ?? a.prefix;
  const suffix = suffixOverride ?? a.suffix;
  if (a.prefix !== b.prefix || a.suffix !== b.suffix) {
    throw AppError.badRequest('Range start/end must share the same prefix/suffix (e.g. A1–A9).');
  }
  if ((prefixOverride && a.prefix && prefixOverride !== a.prefix) || (suffixOverride && a.suffix && suffixOverride !== a.suffix)) {
    throw AppError.badRequest('Prefix/suffix override conflicts with from/to values.');
  }
  if (!Number.isInteger(a.num) || !Number.isInteger(b.num)) throw AppError.badRequest('Range bounds must be numeric.');
  if (a.num > b.num) throw AppError.badRequest('"from" must be less than or equal to "to".');
  const count = b.num - a.num + 1;
  if (count < 1 || count > 100) throw AppError.badRequest('Range must create between 1 and 100 units.');
  const padWidth = Math.max(a.numStr.length, b.numStr.length);
  const zeroPadded = a.numStr.startsWith('0') || b.numStr.startsWith('0');
  const out = [];
  for (let n = a.num; n <= b.num; n++) {
    const numPart = zeroPadded ? String(n).padStart(padWidth, '0') : String(n);
    const name = `${prefix}${numPart}${suffix}`;
    if (name.length > 20) throw AppError.badRequest(`Generated unit number "${name}" exceeds 20 characters.`);
    out.push(name);
  }
  return out;
}

async function bulkCreate(data) {
  let unitNumbers = data.unitNumbers && data.unitNumbers.length > 0
    ? [...new Set(data.unitNumbers.map(n => String(n).trim()).filter(Boolean))]
    : expandUnitRange(data.from, data.to, data.prefix, data.suffix);
  if (unitNumbers.length === 0) throw AppError.badRequest('No unit numbers to create.');
  if (unitNumbers.length > 100) throw AppError.badRequest('Cannot create more than 100 units at once.');
  for (const n of unitNumbers) {
    if (n.length > 20) throw AppError.badRequest(`Unit number "${n}" exceeds 20 characters.`);
  }
  const { created, skipped } = await repo.bulkCreate(data, unitNumbers);
  return {
    success: true,
    data: { units: created, skipped },
    message: `Created ${created.length} unit(s)${skipped.length ? `, skipped ${skipped.length} existing` : ''}`,
  };
}
async function create(data) {
  const unit = await repo.create(data);
  if (unit.property_id) {
    (async () => {
      try {
        const propRow = (await query(
          `SELECT p.manager_id, p.name FROM properties p WHERE p.id = $1`, [unit.property_id]
        )).rows[0];
        if (propRow?.manager_id) {
          sendUnitCreatedNotification(propRow.manager_id, unit, propRow.name).catch(() => {});
        }
      } catch (e) {
        console.error('Unit created notification failed:', e.message);
      }
    })();
  }
  return { success: true, data: { unit }, message: 'Unit created' };
}

async function update(id, data) {
  const existing = await repo.findById(id);
  if (!existing) throw AppError.notFound('Unit not found');

  /* BR-001: block direct occupant/status manipulation via update */
  if (data.occupantId || data.occupant_id) {
    throw AppError.badRequest('Cannot set occupant directly. Use the assign endpoint.');
  }
  if (data.status === 'Occupied') {
    throw AppError.badRequest('Cannot set status to Occupied directly. Use the assign endpoint.');
  }

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

export { list, getById, create, bulkCreate, update, assign, vacate, remove };

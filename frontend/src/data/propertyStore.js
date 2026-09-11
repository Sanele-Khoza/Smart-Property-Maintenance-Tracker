import { api } from '../api/client.js';
import { getStore, saveToLocalStorage, isAllowedText } from './storeCore';
import { getSession } from './authStore';

let propertyCounter = getStore().properties.length + 1;
let unitCounter = getStore().units.length + 1;

const normalizePropertyType = (type) => {
  if (type === undefined || type === null) return undefined;
  const key = String(type).trim().toUpperCase().replace(/[\s_-]+/g, '');
  const map = {
    RESIDENTIAL: 'Residential',
    COMMERCIAL: 'Commercial',
    MIXED: 'Mixed-Use',
    MIXEDUSE: 'Mixed-Use',
  };
  return map[key] || type;
};

// Backend stores Title-Case ('Residential', 'Commercial', 'Mixed-Use', legacy 'MixedUse').
// Frontend UI uses UPPER-CASE ('RESIDENTIAL', 'COMMERCIAL', 'MIXED').
const denormalizePropertyType = (type) => {
  if (type === undefined || type === null) return 'RESIDENTIAL';
  const key = String(type).trim().toUpperCase().replace(/[\s_-]+/g, '');
  const map = {
    RESIDENTIAL: 'RESIDENTIAL',
    COMMERCIAL: 'COMMERCIAL',
    MIXED: 'MIXED',
    MIXEDUSE: 'MIXED',
  };
  return map[key] || 'RESIDENTIAL';
};

const normalizePropertyStatus = (status) => {
  if (status === undefined || status === null) return undefined;
  const key = String(status).trim().toUpperCase().replace(/[\s_-]+/g, '');
  const map = {
    ACTIVE: 'Active',
    INACTIVE: 'Inactive',
    UNDERMAINTENANCE: 'Under Maintenance',
  };
  return map[key] || status;
};

const denormalizePropertyStatus = (status) => {
  if (status === undefined || status === null) return 'ACTIVE';
  const key = String(status).trim().toUpperCase().replace(/[\s_-]+/g, '');
  const map = {
    ACTIVE: 'ACTIVE',
    INACTIVE: 'INACTIVE',
    UNDERMAINTENANCE: 'UNDER_MAINTENANCE',
  };
  return map[key] || 'ACTIVE';
};

const defaultManagerName = () => {
  const session = getSession();
  if (session && session.role === 'PROPERTY_MANAGER') {
    return `${session.name || ''} ${session.surname || ''}`.trim();
  }
  return '';
};

const mapProperty = (p) => ({  propertyId: p.id,
  name: p.name,
  address: p.address,
  propertyType: denormalizePropertyType(p.type || p.propertyType),
  status: denormalizePropertyStatus(p.status),
  managerName: p.managerName || p.manager_name || '',
  managerEmail: p.managerEmail || p.manager_email || '',
  managerPhone: p.managerPhone || p.manager_phone || '',
  unitCount: p.unitCount || p.unit_count || 0,
});

const mapUnit = (u) => ({
  unitId: u.id,
  propertyId: u.propertyId || u.property_id,
  unitNumber: u.unitNumber || u.unit_number,
  floor: u.floor || '',
  type: u.type,
  bedrooms: u.bedrooms,
  bathrooms: u.bathrooms,
  sizeSqm: u.sizeSqm || u.size_sqm,
  status: (u.status || '').toUpperCase(),
  tenantName: u.tenantName || u.tenant_name || '',
  propertyName: u.propertyName || u.property_name || '',
});

export const syncPropertiesAndUnits = async () => {
  try {
    const [propRes, unitRes] = await Promise.all([
      api('/properties?limit=1000', { skipAuthRetry: true }),
      api('/units?limit=1000', { skipAuthRetry: true }),
    ]);
    const store = getStore();
    if (propRes.success && Array.isArray(propRes.data.properties)) {
      store.properties = propRes.data.properties.map(mapProperty);
    }
    if (unitRes.success && Array.isArray(unitRes.data.units)) {
      store.units = unitRes.data.units.map(mapUnit);
    }
    saveToLocalStorage();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const addProperty = async (name, address, propertyType, managerName) => {
  try {
    const resolvedManagerName = managerName || defaultManagerName();
    const result = await api('/properties', {
      method: 'POST',
      body: { name, address, type: normalizePropertyType(propertyType), managerName: resolvedManagerName },
    });
    if (result.success && result.data) {
      const raw = result.data.property || result.data;
      const newProperty = {
        propertyId: raw.id,
        name: raw.name,
        address: raw.address,
        propertyType: denormalizePropertyType(raw.type || propertyType),
        status: denormalizePropertyStatus(raw.status),
        managerName: raw.managerName || raw.manager_name || resolvedManagerName || '',
      };
      const store = getStore();
      store.properties.push(newProperty);
      saveToLocalStorage();
      return { success: true, data: newProperty };
    }
    return { success: false, error: result.error || 'Failed to add property' };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const getProperties = () => getStore().properties.map(p => ({
  ...p,
  propertyType: denormalizePropertyType(p.propertyType || p.type),
  status: denormalizePropertyStatus(p.status),
}));

export const updateProperty = async (propertyId, updates) => {
  try {
    const body = {};
    if (updates.name !== undefined) body.name = updates.name;
    if (updates.address !== undefined) body.address = updates.address;
    const rawType = updates.propertyType !== undefined ? updates.propertyType : updates.type;
    if (rawType !== undefined) body.type = normalizePropertyType(rawType);
    if (updates.status !== undefined) body.status = normalizePropertyStatus(updates.status);
    if (updates.managerName) body.managerName = updates.managerName;
    if (updates.managerId) body.managerId = updates.managerId;
    const result = await api(`/properties/${propertyId}`, {
      method: 'PUT',
      body,
    });
    if (result.success && result.data) {
      const raw = result.data.property || result.data;
      const store = getStore();
      const existing = store.properties.find(p => String(p.propertyId) === String(propertyId) || String(p.id) === String(propertyId)) || {};
      const updated = {
        propertyId: raw.id || existing.propertyId || propertyId,
        name: raw.name ?? existing.name ?? updates.name,
        address: raw.address ?? existing.address ?? updates.address,
        propertyType: denormalizePropertyType(raw.type ?? raw.propertyType ?? updates.propertyType ?? updates.type ?? existing.propertyType),
        status: denormalizePropertyStatus(raw.status ?? updates.status ?? existing.status),
        managerName: raw.managerName || raw.manager_name || updates.managerName || existing.managerName || '',
      };
      const idx = store.properties.findIndex(p => String(p.propertyId) === String(propertyId) || String(p.id) === String(propertyId));
      if (idx !== -1) store.properties[idx] = { ...existing, ...updated };
      else store.properties.push(updated);
      saveToLocalStorage();
      return { success: true, data: updated };
    }
    return { success: false, error: result.error || 'Failed to update property' };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const updatePropertyStatus = async (propertyId, newStatus) => {
  return updateProperty(propertyId, { status: newStatus });
};

export const deleteProperty = async (propertyId) => {
  try {
    const result = await api(`/properties/${propertyId}`, { method: 'DELETE' });
    if (result.success) {
      const store = getStore();
      store.properties = store.properties.filter(p => p.propertyId !== propertyId && p.id !== propertyId);
      saveToLocalStorage();
      return { success: true };
    }
    return { success: false, error: result.error || 'Failed to delete property' };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const addUnit = async (propertyId, unitNumber, floor) => {
  try {
    const result = await api('/units', {
      method: 'POST',
      body: { propertyId, unitNumber, floor },
    });
    if (result.success && result.data) {
      const newUnit = mapUnit(result.data.unit || result.data);
      const store = getStore();
      store.units.push(newUnit);
      saveToLocalStorage();
      return { success: true, data: newUnit };
    }
    return { success: false, error: result.error || 'Failed to add unit' };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

/* Parse "1-9", "01-09", "A1-A9" into an explicit unit-number list.
   Returns { ok, numbers, error }. Single values return a 1-item list. */
export const parseUnitRangeInput = (input) => {
  const raw = String(input ?? '').trim();
  if (!raw) return { ok: false, numbers: [], error: 'Unit number required.' };
  if (!raw.includes('-')) return { ok: true, numbers: [raw], error: '' };
  const parts = raw.split('-').map(s => s.trim()).filter(Boolean);
  if (parts.length !== 2) return { ok: false, numbers: [], error: 'Range must look like "1-9" or "A1-A9".' };
  const m = (s) => String(s).match(/^([A-Za-z]*)(\d+)([A-Za-z]*)$/);
  const a = m(parts[0]);
  const b = m(parts[1]);
  if (!a || !b) return { ok: false, numbers: [], error: 'Range bounds must end in a number (e.g. 1-9).' };
  if (a[1] !== b[1] || a[3] !== b[3]) return { ok: false, numbers: [], error: 'Range start/end must share the same prefix/suffix.' };
  const start = parseInt(a[2], 10);
  const end = parseInt(b[2], 10);
  if (start > end) return { ok: false, numbers: [], error: '"from" must be ≤ "to".' };
  const count = end - start + 1;
  if (count > 100) return { ok: false, numbers: [], error: 'Range too large (max 100 units).' };
  const padWidth = Math.max(a[2].length, b[2].length);
  const zeroPadded = a[2].startsWith('0') || b[2].startsWith('0');
  const numbers = [];
  for (let n = start; n <= end; n++) {
    const numPart = zeroPadded ? String(n).padStart(padWidth, '0') : String(n);
    const name = `${a[1]}${numPart}${a[3]}`;
    if (name.length > 20) return { ok: false, numbers: [], error: `Generated "${name}" exceeds 20 characters.` };
    numbers.push(name);
  }
  return { ok: true, numbers, error: '' };
};

/* Expand two endpoint inputs (from/to) using the same rules as parseUnitRangeInput. */
export const expandUnitRange = (from, to) => parseUnitRangeInput(`${String(from ?? '').trim()}-${String(to ?? '').trim()}`);

export const addUnitsBulk = async (propertyId, { unitNumbers, from, to, floor, type, bedrooms, bathrooms, sizeSqm } = {}) => {
  let numbers = unitNumbers;
  if (!numbers || numbers.length === 0) {
    if (from === undefined || to === undefined) return { success: false, error: 'Provide unit numbers or a from/to range.' };
    const parsed = expandUnitRange(from, to);
    if (!parsed.ok) return { success: false, error: parsed.error };
    numbers = parsed.numbers;
  }
  numbers = [...new Set(numbers.map(n => String(n).trim()).filter(Boolean))];
  if (numbers.length === 0) return { success: false, error: 'No unit numbers to create.' };
  if (numbers.length > 100) return { success: false, error: 'Cannot create more than 100 units at once.' };
  try {
    const result = await api('/units/bulk', {
      method: 'POST',
      body: { propertyId, floor: floor ?? null, unitNumbers: numbers, type, bedrooms, bathrooms, sizeSqm },
    });
    const rawUnits = result?.data?.units || result?.data?.data?.units || [];
    const skipped = result?.data?.skipped || [];
    const store = getStore();
    const created = rawUnits.map(mapUnit);
    store.units.push(...created);
    saveToLocalStorage();
    return { success: true, data: { units: created, skipped, count: created.length }, message: result?.message };
  } catch (err) {
    // Fallback for older backends without /units/bulk: create one-by-one
    if (err.status === 404) {
      const created = [];
      const failed = [];
      for (const unitNumber of numbers) {
        const r = await addUnit(propertyId, unitNumber, floor ?? null);
        if (r.success) created.push(r.data);
        else failed.push({ unitNumber, error: r.error });
      }
      if (created.length === 0) return { success: false, error: failed[0]?.error || 'Failed to add units' };
      return { success: true, data: { units: created, skipped: [], count: created.length }, partial: failed.length > 0, failed };
    }
    return { success: false, error: err.message };
  }
};

export const getUnits = () => {
  const store = getStore();
  return store.units.map(unit => ({ ...unit, propertyName: store.properties.find(p => p.propertyId === unit.propertyId || p.id === unit.propertyId)?.name }));
};

export const getUnitById = (unitId) => {
  const store = getStore();
  const unit = store.units.find(u => u.unitId === unitId || u.id === unitId);
  if (!unit) return null;
  return { ...unit, propertyName: store.properties.find(p => p.propertyId === unit.propertyId || p.id === unit.propertyId)?.name };
};

export const assignTenantToUnit = async (unitId, tenantName) => {
  try {
    const result = await api(`/units/${unitId}/assign`, {
      method: 'PUT',
      body: { tenantName },
    });
    if (result.success && result.data) {
      const updated = mapUnit(result.data.unit || result.data);
      const store = getStore();
      const idx = store.units.findIndex(u => u.unitId === unitId || u.id === unitId);
      if (idx !== -1) store.units[idx] = updated;
      saveToLocalStorage();
      return { success: true, data: updated };
    }
    return { success: false, error: result.error || 'Failed to assign tenant' };
  } catch (err) {
    return { success: false, error: err.message, statusCode: err.status };
  }
};

export const vacateUnit = async (unitId) => {
  try {
    const result = await api(`/units/${unitId}/vacate`, { method: 'PUT' });
    if (result.success && result.data) {
      const updated = mapUnit(result.data.unit || result.data);
      const store = getStore();
      const idx = store.units.findIndex(u => u.unitId === unitId || u.id === unitId);
      if (idx !== -1) store.units[idx] = updated;
      saveToLocalStorage();
      return { success: true, data: updated };
    }
    return { success: false, error: result.error || 'Failed to vacate unit' };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const updateUnit = async (unitId, updates) => {
  try {
    const result = await api(`/units/${unitId}`, {
      method: 'PUT',
      body: updates,
    });
    if (result.success && result.data) {
      const updated = mapUnit(result.data.unit || result.data);
      const store = getStore();
      const idx = store.units.findIndex(u => u.unitId === unitId || u.id === unitId);
      if (idx !== -1) store.units[idx] = updated;
      saveToLocalStorage();
      return { success: true, data: updated };
    }
    return { success: false, error: result.error || 'Failed to update unit' };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const deleteUnit = async (unitId) => {
  try {
    const result = await api(`/units/${unitId}`, { method: 'DELETE' });
    if (result.success) {
      const store = getStore();
      store.units = store.units.filter(u => u.unitId !== unitId && u.id !== unitId);
      saveToLocalStorage();
      return { success: true };
    }
    return { success: false, error: result.error || 'Failed to delete unit' };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

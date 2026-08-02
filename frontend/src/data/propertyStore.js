import { api } from '../api/client.js';
import { getStore, saveToLocalStorage, isAllowedText } from './storeCore';
import { getSession } from './authStore';

let propertyCounter = getStore().properties.length + 1;
let unitCounter = getStore().units.length + 1;

const PROPERTY_TYPE_MAP = {
  RESIDENTIAL: 'Residential',
  COMMERCIAL: 'Commercial',
  'MIXED-USE': 'Mixed-Use',
  MIXEDUSE: 'Mixed-Use',
};

const normalizePropertyType = (type) => PROPERTY_TYPE_MAP[type] || type;

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
  propertyType: p.type,
  status: p.status,
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
        propertyType: raw.type,
        status: raw.status,
        managerName: resolvedManagerName || raw.managerName || '',
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

export const getProperties = () => [...getStore().properties];

export const updateProperty = async (propertyId, updates) => {
  try {
    const result = await api(`/properties/${propertyId}`, {
      method: 'PUT',
      body: {
        name: updates.name,
        address: updates.address,
        type: normalizePropertyType(updates.propertyType || updates.type),
        status: updates.status,
        managerName: updates.managerName,
      },
    });
    if (result.success && result.data) {
      const raw = result.data.property || result.data;
      const updated = {
        propertyId: raw.id || propertyId,
        name: raw.name,
        address: raw.address,
        propertyType: raw.type,
        status: raw.status,
        managerName: raw.managerName || updates.managerName || '',
      };
      const store = getStore();
      const idx = store.properties.findIndex(p => p.propertyId === propertyId || p.id === propertyId);
      if (idx !== -1) store.properties[idx] = updated;
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
    return { success: false, error: err.message };
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

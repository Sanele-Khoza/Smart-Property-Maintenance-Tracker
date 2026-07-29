import { api } from '../api/client.js';
import { getStore, saveToLocalStorage, isAllowedText } from './storeCore';

let propertyCounter = getStore().properties.length + 1;
let unitCounter = getStore().units.length + 1;

export const addProperty = async (name, address, propertyType, managerName) => {
  try {
    const result = await api('/properties', {
      method: 'POST',
      body: { name, address, type: propertyType, managerName },
    });
    if (result.success && result.data) {
      const raw = result.data.property || result.data;
      const newProperty = {
        propertyId: raw.id,
        name: raw.name,
        address: raw.address,
        propertyType: raw.type,
        status: raw.status,
        managerName: managerName || raw.managerName || '',
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
        type: updates.propertyType || updates.type,
        status: updates.status,
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
      const newUnit = result.data.unit || result.data;
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
      const updated = result.data.unit || result.data;
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
      const updated = result.data.unit || result.data;
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
      const updated = result.data.unit || result.data;
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

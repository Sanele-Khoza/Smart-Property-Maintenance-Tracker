import { api } from '../api/client.js';
import { getStore, saveToLocalStorage } from './storeCore';

export const getTechnicians = () => [...getStore().technicians];

const mapTechnician = (t) => {
  let lat = null;
  let lng = null;
  const loc = t.gps_location;
  if (Array.isArray(loc)) {
    lat = loc[0];
    lng = loc[1];
  } else if (typeof loc === 'string') {
    const m = loc.match(/\((-?[\d.]+),(-?[\d.]+)\)/);
    if (m) {
      lat = parseFloat(m[1]);
      lng = parseFloat(m[2]);
    }
  }
  let specialisations = t.specialisations;
  if (typeof specialisations === 'string') {
    try {
      specialisations = JSON.parse(specialisations);
    } catch {
      specialisations = [specialisations];
    }
  }
  return {
    id: t.id,
    name: t.name,
    companyName: t.company_name || '',
    email: t.email || '',
    phone: t.phone || '',
    specialisations: Array.isArray(specialisations) ? specialisations : [],
    rating: t.rating || 0,
    totalJobsCompleted: t.total_jobs_completed || 0,
    currentWorkload: t.current_workload || 0,
    availabilityStatus: t.status || 'AVAILABLE',
    lastLocationUpdate: t.last_location_update || null,
    gpsLatitude: lat,
    gpsLongitude: lng,
  };
};

export const syncTechnicians = async () => {
  try {
    const result = await api('/technicians?limit=1000', { skipAuthRetry: true });
    if (result.success && Array.isArray(result.data?.technicians)) {
      const store = getStore();
      store.technicians = result.data.technicians.map(mapTechnician);
      saveToLocalStorage();
      return { success: true, count: store.technicians.length };
    }
    return { success: false, error: result.error || 'No technicians returned' };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const updateTechnicianStatus = async (techId, newStatus) => {
  try {
    const result = await api(`/technicians/${techId}/status`, {
      method: 'PUT',
      body: { status: newStatus },
    });
    if (result.success && result.data) {
      const updated = result.data.technician || result.data;
      const store = getStore();
      const idx = store.technicians.findIndex(t => t.id === techId);
      if (idx !== -1) store.technicians[idx] = { ...store.technicians[idx], ...updated };
      saveToLocalStorage();
      return { success: true, data: store.technicians[idx] || updated };
    }
    return { success: false, error: result.error || 'Failed to update status' };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const updateTechnician = async (techId, updates) => {
  try {
    const result = await api(`/technicians/${techId}`, {
      method: 'PUT',
      body: updates,
    });
    if (result.success && result.data) {
      const updated = result.data.technician || result.data;
      const store = getStore();
      const idx = store.technicians.findIndex(t => t.id === techId);
      if (idx !== -1) store.technicians[idx] = { ...store.technicians[idx], ...updated };
      saveToLocalStorage();
      return { success: true, data: store.technicians[idx] || updated };
    }
    return { success: false, error: result.error || 'Failed to update technician' };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const getMyTechnician = async () => {
  try {
    const result = await api('/technicians/me');
    if (result.success && result.data?.technician) {
      return { success: true, data: mapTechnician(result.data.technician) };
    }
    return { success: false, error: result.error || 'No provider record found' };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const updateMyTechnician = async (updates) => {
  try {
    const result = await api('/technicians/me', {
      method: 'PUT',
      body: updates,
    });
    if (result.success && result.data) {
      const updated = result.data.technician || result.data;
      return { success: true, data: mapTechnician(updated) };
    }
    return { success: false, error: result.error || 'Failed to update provider details' };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const getProviders = () => getTechnicians();

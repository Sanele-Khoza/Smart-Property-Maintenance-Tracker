import { api } from '../api/client.js';
import { getStore, saveToLocalStorage } from './storeCore';

export const getTechnicians = () => [...getStore().technicians];

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

const providers = [
  { id: 'PROV-001', name: 'Mike Provider', specialisations: ['Plumbing', 'Electrical', 'HVAC'], rating: 4.5 },
  { id: 'PROV-002', name: 'Jane Smith', specialisations: ['Electrical', 'General'], rating: 4.8 },
  { id: 'PROV-003', name: 'Tom Wilson', specialisations: ['Plumbing', 'HVAC'], rating: 4.2 },
];
export const getProviders = () => [...providers];

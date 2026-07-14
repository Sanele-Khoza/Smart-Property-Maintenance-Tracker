import { getStore, saveToLocalStorage } from './storeCore';

export const getTechnicians = () => [...getStore().technicians];

export const updateTechnicianStatus = (techId, newStatus) => {
  const store = getStore();
  const tech = store.technicians.find(t => t.id === techId);
  if (!tech) return { success: false, error: 'Technician not found.' };
  tech.availabilityStatus = newStatus;
  saveToLocalStorage();
  return { success: true, data: { ...tech } };
};

export const updateTechnician = (techId, updates) => {
  const store = getStore();
  const tech = store.technicians.find(t => t.id === techId);
  if (!tech) return { success: false, error: 'Technician not found.' };
  if (updates.rating !== undefined) tech.rating = updates.rating;
  if (updates.currentWorkload !== undefined) tech.currentWorkload = updates.currentWorkload;
  if (updates.availabilityStatus) tech.availabilityStatus = updates.availabilityStatus;
  if (updates.companyName !== undefined) tech.companyName = updates.companyName;
  if (updates.specialisations !== undefined) tech.specialisations = updates.specialisations;
  if (updates.email !== undefined) tech.email = updates.email;
  if (updates.phone !== undefined) tech.phone = updates.phone;
  if (updates.gpsLatitude !== undefined) tech.gpsLatitude = updates.gpsLatitude;
  if (updates.gpsLongitude !== undefined) tech.gpsLongitude = updates.gpsLongitude;
  saveToLocalStorage();
  return { success: true, data: { ...tech } };
};

const providers = [
  { id: 'PROV-001', name: 'Mike Provider', specialisations: ['Plumbing', 'Electrical', 'HVAC'], rating: 4.5 },
  { id: 'PROV-002', name: 'Jane Smith', specialisations: ['Electrical', 'General'], rating: 4.8 },
  { id: 'PROV-003', name: 'Tom Wilson', specialisations: ['Plumbing', 'HVAC'], rating: 4.2 },
];
export const getProviders = () => [...providers];

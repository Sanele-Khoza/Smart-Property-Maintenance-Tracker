import { getStore, saveToLocalStorage } from './storeCore';

export const getNotifications = () => [...getStore().notifications];

export const updateNotificationStatus = (notifId, newStatus, retryCount) => {
  const store = getStore();
  const notif = store.notifications.find(n => n.id === notifId);
  if (!notif) return { success: false, error: 'Notification not found.' };
  notif.deliveryStatus = newStatus;
  if (retryCount !== undefined) notif.retryCount = retryCount;
  saveToLocalStorage();
  return { success: true, data: { ...notif } };
};

export const addNotification = (recipientEmail, type, message, isEmergency) => {
  const store = getStore();
  const newNotif = {
    id: `NOT-${String(store.notifications.length + 1).padStart(3, '0')}`,
    recipient: recipientEmail,
    type,
    message,
    deliveryStatus: 'Pending',
    retryCount: 0,
    createdAt: new Date().toISOString(),
    isEmergency: isEmergency || false,
  };
  store.notifications.push(newNotif);
  saveToLocalStorage();
  return newNotif;
};

export const getCategories = () => [...getStore().categories];

export const addCategory = (name, description, defaultPriority, aiKeywords, rekognitionLabel) => {
  const store = getStore();
  if (!name?.trim()) return { success: false, error: 'Category name is required.' };
  if (store.categories.some(c => c.name.toLowerCase() === name.trim().toLowerCase())) return { success: false, error: `Category "${name}" already exists.` };
  const newCat = { id: `CAT-${String(store.categories.length + 1).padStart(3, '0')}`, name: name.trim(), description: description || '', defaultPriority: defaultPriority || 'MEDIUM', aiKeywords: aiKeywords || [], rekognitionLabel: rekognitionLabel || name.trim() };
  store.categories.push(newCat);
  saveToLocalStorage();
  return { success: true, data: newCat };
};

export const updateCategory = (catId, updates) => {
  const store = getStore();
  const cat = store.categories.find(c => c.id === catId);
  if (!cat) return { success: false, error: 'Category not found.' };
  if (updates.name) cat.name = updates.name.trim();
  if (updates.description !== undefined) cat.description = updates.description;
  if (updates.defaultPriority) cat.defaultPriority = updates.defaultPriority;
  if (updates.aiKeywords !== undefined) cat.aiKeywords = updates.aiKeywords;
  if (updates.rekognitionLabel !== undefined) cat.rekognitionLabel = updates.rekognitionLabel;
  saveToLocalStorage();
  return { success: true, data: { ...cat } };
};

export const deleteCategory = (catId) => {
  const store = getStore();
  if (store.tickets.some(t => t.category === store.categories.find(c => c.id === catId)?.name)) return { success: false, error: 'Cannot delete category: tickets reference it.' };
  store.categories = store.categories.filter(c => c.id !== catId);
  saveToLocalStorage();
  return { success: true };
};

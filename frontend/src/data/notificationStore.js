import { api } from '../api/client.js';
import { getStore, saveToLocalStorage } from './storeCore';

export const getNotifications = () => [...getStore().notifications];

export const updateNotificationStatus = async (notifId, newStatus, retryCount) => {
  try {
    const result = await api(`/notifications/${notifId}/status`, {
      method: 'PUT',
      body: { status: newStatus, retryCount },
    });
    if (result.success) {
      const store = getStore();
      const notif = store.notifications.find(n => n.id === notifId);
      if (notif) {
        notif.deliveryStatus = newStatus;
        if (retryCount !== undefined) notif.retryCount = retryCount;
        saveToLocalStorage();
      }
      return { success: true, data: notif || result.data };
    }
    return { success: false, error: result.error || 'Failed to update notification' };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const markNotificationRead = async (notifId) => {
  try {
    const result = await api(`/notifications/${notifId}/read`, { method: 'PUT' });
    if (result.success) {
      const store = getStore();
      const notif = store.notifications.find(n => n.id === notifId);
      if (notif) { notif.read = true; saveToLocalStorage(); }
      return { success: true };
    }
    return { success: false, error: result.error || 'Failed to mark as read' };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const markAllNotificationsRead = async () => {
  try {
    const result = await api('/notifications/read-all', { method: 'PUT' });
    if (result.success) {
      const store = getStore();
      store.notifications.forEach(n => { n.read = true; });
      saveToLocalStorage();
      return { success: true };
    }
    return { success: false, error: result.error || 'Failed to mark all as read' };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const getNotificationPreferences = async () => {
  try {
    const result = await api('/notification-preferences');
    if (result.success) return { success: true, data: result.data.preferences };
    return { success: false, error: result.error || 'Failed to load preferences' };
  } catch (err) {
    return { success: false, error: err.message };
  }
};
export const refreshNotifications = async () => {
  try {
    const result = await api('/notifications?limit=100');
    if (result.success && result.data?.notifications) {
      const store = getStore();
      store.notifications = result.data.notifications.map(n => ({
        id: n.id,
        recipient: n.recipient,
        userId: n.user_id,
        type: n.type,
        title: n.title,
        message: n.body || n.message,
        ticketId: n.ticket_id,
        isEmergency: n.is_emergency,
        deliveryStatus: n.delivery_status || 'Sent',
        retryCount: n.retry_count || 0,
        read: n.read,
        createdAt: n.created_at,
      }));
      saveToLocalStorage();
    }
  } catch {}
};

export const updateNotificationPreference = async (channel, enabled) => {
  try {
    const result = await api('/notification-preferences', {
      method: 'PUT',
      body: { channel, enabled },
    });
    if (result.success) return { success: true, data: result.data.preferences };
    return { success: false, error: result.error || 'Failed to update preference' };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const addNotification = async (recipientEmail, type, message, isEmergency) => {
  try {
    const result = await api('/notifications', {
      method: 'POST',
      body: { recipient: recipientEmail, type, message, isEmergency: isEmergency || false },
    });
    if (result.success && result.data) {
      const newNotif = result.data.notification || result.data;
      const store = getStore();
      store.notifications.push(newNotif);
      saveToLocalStorage();
      return newNotif;
    }
    return null;
  } catch {
    const store = getStore();
    const newNotif = {
      id: `NOT-${String(store.notifications.length + 1).padStart(3, '0')}`,
      recipient: recipientEmail, type, message,
      deliveryStatus: 'Pending', retryCount: 0,
      createdAt: new Date().toISOString(),
      isEmergency: isEmergency || false,
    };
    store.notifications.push(newNotif);
    saveToLocalStorage();
    return newNotif;
  }
};

export const getCategories = () => [...getStore().categories];

export const addCategory = async (name, description, defaultPriority, aiKeywords, rekognitionLabel) => {
  try {
    const result = await api('/categories', {
      method: 'POST',
      body: { name, description, defaultPriority, aiKeywords, rekognitionLabel },
    });
    if (result.success && result.data) {
      const newCat = result.data.category || result.data;
      const store = getStore();
      store.categories.push(newCat);
      saveToLocalStorage();
      return { success: true, data: newCat };
    }
    return { success: false, error: result.error || 'Failed to add category' };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const updateCategory = async (catId, updates) => {
  try {
    const result = await api(`/categories/${catId}`, {
      method: 'PUT',
      body: updates,
    });
    if (result.success && result.data) {
      const updated = result.data.category || result.data;
      const store = getStore();
      const idx = store.categories.findIndex(c => c.id === catId);
      if (idx !== -1) store.categories[idx] = { ...store.categories[idx], ...updated };
      saveToLocalStorage();
      return { success: true, data: store.categories[idx] || updated };
    }
    return { success: false, error: result.error || 'Failed to update category' };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const deleteCategory = async (catId) => {
  try {
    const result = await api(`/categories/${catId}`, { method: 'DELETE' });
    if (result.success) {
      const store = getStore();
      store.categories = store.categories.filter(c => c.id !== catId);
      saveToLocalStorage();
      return { success: true };
    }
    return { success: false, error: result.error || 'Failed to delete category' };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

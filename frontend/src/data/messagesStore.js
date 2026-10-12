import { api } from '../api/client.js';

export const getPopups = async () => {
  try {
    const result = await api('/messages/popups');
    if (result.success) return result.data?.messages || [];
    return [];
  } catch {
    return [];
  }
};

export const sendBroadcastMessage = async ({ receiverIds, broadcastAll, subject, body }) => {
  try {
    const result = await api('/messages/broadcast', {
      method: 'POST',
      body: { receiver_ids: receiverIds, broadcast_all: broadcastAll, subject, body },
    });
    if (result.success) return { success: true, data: result.data, message: result.message };
    return { success: false, error: result.error || 'Failed to send announcement' };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const markMessageRead = async (id) => {
  try {
    const result = await api(`/messages/${id}/read`, { method: 'PUT' });
    return { success: !!result.success };
  } catch {
    return { success: false };
  }
};
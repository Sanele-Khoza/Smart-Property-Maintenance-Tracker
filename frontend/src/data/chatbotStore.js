import { api } from '../api/client.js';

const MESSAGE_TIMEOUT_MIN_MS = 3000;
const MESSAGE_TIMEOUT_MAX_MS = 10000;

const randomMessageTimeoutMs = () =>
  Math.floor(Math.random() * (MESSAGE_TIMEOUT_MAX_MS - MESSAGE_TIMEOUT_MIN_MS + 1)) + MESSAGE_TIMEOUT_MIN_MS;

export const sendChatMessage = async (message) => {
  try {
    const result = await api('/chatbot/chat', {
      method: 'POST',
      body: { message },
      timeout: randomMessageTimeoutMs(),
    });
    if (result.success && result.data) {
      return { success: true, data: result.data };
    }
    return { success: false, error: result.error || 'Failed to get an answer' };
  } catch (err) {
    return { success: false, error: err.message, statusCode: err.status };
  }
};

export const getChatbotHealth = async () => {
  try {
    const result = await api('/chatbot/health', { method: 'GET' });
    if (result.success && result.data) {
      return { success: true, data: result.data };
    }
    return { success: false, data: result.data || { status: 'offline' } };
  } catch (err) {
    return { success: false, data: { status: 'offline' } };
  }
};
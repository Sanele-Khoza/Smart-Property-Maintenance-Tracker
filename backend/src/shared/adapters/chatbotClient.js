/*
 * Client for the standalone SPMT AI chatbot (ai-chatbot/).
 *
 * The chatbot runs as its own zero-dependency Python HTTP server
 * (python server.py, default http://127.0.0.1:8090). It exposes:
 *   - POST /api/chat  { message } -> { success, data: { answer, confidence, ... } }
 *   - GET  /health               -> { status, entries, topics }
 *
 * This adapter proxies those calls from the Node backend so the
 * React frontend never talks to the Python process directly.
 */

import config from '../../config/index.js';
import logger from '../utils/logger.js';

async function chatbotFetch(path, options = {}, payload) {
  const { baseUrl, timeoutMs } = config.chatbot;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method: options.method || (payload ? 'POST' : 'GET'),
      headers: payload ? { 'Content-Type': 'application/json' } : undefined,
      body: payload ? JSON.stringify(payload) : undefined,
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Chatbot ${path} responded ${res.status}: ${text.slice(0, 200)}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** @returns {Promise<{success, data, error?}>} */
async function ask(message, role) {
  if (!config.chatbot.enabled) {
    return { success: false, error: 'AI Assistant is not enabled.' };
  }
  const text = String(message || '').trim();
  if (!text) {
    return { success: false, error: 'Message is required.' };
  }
  try {
    const json = await chatbotFetch('/api/chat', { method: 'POST' }, { message: text, role: role || null });
    if (!json?.success) {
      return { success: false, error: json?.error || 'Chatbot returned an error.' };
    }
    return { success: true, data: json.data };
  } catch (err) {
    logger.warn(`Chatbot ask failed: ${err.message}`);
    return { success: false, error: 'AI Assistant is offline. Make sure the chatbot server is running (python server.py in ai-chatbot/).' };
  }
}

/** @returns {Promise<{success, data?}>} */
async function health() {
  if (!config.chatbot.enabled) {
    return { success: false, data: { status: 'disabled' } };
  }
  try {
    const json = await chatbotFetch('/health', { method: 'GET' });
    return { success: true, data: json };
  } catch (err) {
    logger.warn(`Chatbot health check failed: ${err.message}`);
    return { success: false, data: { status: 'offline' } };
  }
}

export { ask, health };
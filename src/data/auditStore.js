import { api } from '../api/client.js';
import { getStore, saveToLocalStorage } from './storeCore';

export const getAuditLogs = () => [...getStore().auditLog];

export const getSecurityAuditLogs = () => [...getStore().securityAuditLog];

export const addAuditLogEntry = (entry) => {
  const store = getStore();
  const newEntry = {
    id: `AUD-${String(store.auditLog.length + 1).padStart(3, '0')}`,
    timestamp: new Date().toISOString(),
    ...entry,
  };
  store.auditLog.push(newEntry);
  saveToLocalStorage();
  return { success: true, data: newEntry };
};

export const addSecurityAuditLogEntry = async (entry) => {
  try {
    await api('/audit', {
      method: 'POST',
      body: entry,
    });
  } catch {}
  const store = getStore();
  const newEntry = {
    id: `SEC-${String(store.securityAuditLog.length + 1).padStart(3, '0')}`,
    timestamp: new Date().toISOString(),
    ...entry,
  };
  store.securityAuditLog.push(newEntry);
  saveToLocalStorage();
  return { success: true, data: newEntry };
};

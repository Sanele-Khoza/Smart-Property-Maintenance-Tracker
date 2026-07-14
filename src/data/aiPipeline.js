import { getStore } from './storeCore';

export const getInferenceLogs = () => [...getStore().aiInferenceLog];

export const addInferenceLog = (ticketId, adapter, inputType, result, confidence, conflictDetected) => {
  const store = getStore();
  const newEntry = {
    id: `INF-${String(store.aiInferenceLog.length + 1).padStart(3, '0')}`,
    ticketId, adapter, inputType, confidence, result,
    latencyMs: Math.floor(Math.random() * 750) + 150,
    timestamp: new Date().toISOString(),
    conflictDetected,
  };
  store.aiInferenceLog.push(newEntry);
  try { localStorage.setItem('spmt_app_data', JSON.stringify(store)); } catch {}
  return newEntry;
};

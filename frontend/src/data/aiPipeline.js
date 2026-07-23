import { getStore } from './storeCore';

const EMERGENCY_KEYWORDS = ['gas leak', 'gas smell', 'flooding', 'flood', 'fire', 'smoke', 'burst pipe', 'electrical fault', 'carbon monoxide', 'sewage', 'collapse'];

export const getEmergencyHint = (description) => {
  if (!description) return false;
  return EMERGENCY_KEYWORDS.some(kw => description.toLowerCase().includes(kw));
};

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

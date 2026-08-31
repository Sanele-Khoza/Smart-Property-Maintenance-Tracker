import { api } from '../api/client.js';
import { getStore, saveToLocalStorage } from './storeCore';

const AI_THRESHOLD_KEYS = ['AI_TEXT_CONFIDENCE_THRESHOLD', 'AI_EMERGENCY_VISUAL_THRESHOLD', 'AI_TEXT_WEIGHT', 'AI_VISUAL_WEIGHT'];

export const getSystemSettings = () => [...getStore().systemSettings];

export const updateSystemSetting = async (key, newValue) => {
  try {
    const result = await api('/settings', {
      method: 'PUT',
      body: { settings: { [key]: newValue } },
    });
    if (result.success) {
      const store = getStore();
      const setting = store.systemSettings.find(s => s.key === key);
      if (setting) setting.value = String(newValue);
      saveToLocalStorage();
      return { success: true, data: setting || result.data };
    }
    return { success: false, error: result.error || 'Failed to update setting' };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const getSlaConfig = () => [...getStore().slaConfig];

export const getAutoAssignEnabled = () => {
  const setting = getStore().systemSettings.find(s => s.key === 'AUTO_ASSIGN_ENABLED');
  return setting ? setting.value !== 'false' : true;
};

export const updateSlaConfig = async (priority, updates) => {
  try {
    const result = await api('/settings/sla', {
      method: 'PUT',
      body: { priority, ...updates },
    });
    if (result.success) {
      const store = getStore();
      const sla = store.slaConfig.find(s => s.priority === priority);
      if (sla) {
        if (updates.responseMinutes !== undefined) sla.responseMinutes = updates.responseMinutes;
        if (updates.resolutionMinutes !== undefined) sla.resolutionMinutes = updates.resolutionMinutes;
        if (updates.warningPercent !== undefined) sla.warningPercent = updates.warningPercent;
        if (updates.autoAssignMinutes !== undefined) sla.autoAssignMinutes = updates.autoAssignMinutes;
      }
      saveToLocalStorage();
      return { success: true, data: sla || result.data };
    }
    return { success: false, error: result.error || 'Failed to update SLA config' };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const getAiThresholdConfig = () => {
  const store = getStore();
  const labels = {
    AI_TEXT_CONFIDENCE_THRESHOLD: 'Minimum confidence for text-based Comprehend classification',
    AI_EMERGENCY_VISUAL_THRESHOLD: 'Minimum confidence for Rekognition emergency detection',
    AI_TEXT_WEIGHT: 'Weight of text analysis (Comprehend) in combined score',
    AI_VISUAL_WEIGHT: 'Weight of image analysis (Rekognition) in combined score',
  };
  return AI_THRESHOLD_KEYS.map(key => {
    const setting = store.systemSettings.find(s => s.key === key);
    return { key, value: setting ? setting.value : 0, description: labels[key] || key };
  });
};

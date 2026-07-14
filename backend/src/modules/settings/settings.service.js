import * as repo from './settings.repository.js';

async function getAll() {
  const [settings, slaConfig, thresholds] = await Promise.all([
    repo.getSettings(), repo.getSlaConfig(), repo.getThresholds(),
  ]);
  return { success: true, data: { settings, slaConfig, thresholds } };
}

async function updateSettings(updates) {
  if (Array.isArray(updates)) {
    for (const item of updates) {
      const type = typeof item.value === 'number' ? 'number' : typeof item.value === 'boolean' ? 'boolean' : 'string';
      await repo.upsertSetting(item.key, item.value, type);
    }
  } else if (typeof updates === 'object') {
    for (const [key, value] of Object.entries(updates)) {
      const type = typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'string';
      await repo.upsertSetting(key, value, type);
    }
  }
  const settings = await repo.getSettings();
  return { success: true, data: { settings }, message: 'Settings updated' };
}

async function getSla() {
  const slaConfig = await repo.getSlaConfig();
  return { success: true, data: { slaConfig } };
}

async function updateSla(priority, responseMinutes, resolutionMinutes) {
  if (!priority) throw new Error('Priority is required');
  const config = await repo.upsertSla(priority, responseMinutes, resolutionMinutes);
  return { success: true, data: { sla: config }, message: 'SLA config updated' };
}

async function updateThreshold(key, value, description) {
  const threshold = await repo.upsertThreshold(key, value, description);
  return { success: true, data: { threshold }, message: 'Threshold updated' };
}

export { getAll, updateSettings, getSla, updateSla };

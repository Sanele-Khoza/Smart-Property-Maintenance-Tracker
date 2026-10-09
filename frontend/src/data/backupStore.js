import { api } from '../api/client.js';

const HISTORY_KEY = 'spmt_backup_history';

export const getBackupInfo = async () => {
  try {
    const result = await api('/backup/info', { timeout: 60000 });
    return { success: true, data: result.data };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const exportBackup = async (format = 'json') => {
  try {
    if (format === 'sql') {
      const result = await api('/backup/export?format=sql', { method: 'POST', timeout: 120000 });
      return { success: true, data: { kind: 'sql', ...result.data }, meta: result.meta || null, message: result.message };
    }
    const result = await api('/backup/export', { method: 'POST', timeout: 120000 });
    // Server returns { success, data (legacy flat dump), backup (nested), meta }
    const dump = result.backup || result.data;
    return { success: true, data: { kind: 'json', dump }, meta: result.meta || null, message: result.message };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

const tableCountsOf = (dump) => {
  const tables = dump?.tables && typeof dump.tables === 'object' ? dump.tables : dump;
  const counts = {};
  if (tables && typeof tables === 'object') {
    for (const [k, v] of Object.entries(tables)) {
      if (Array.isArray(v)) counts[k] = v.length;
    }
  }
  return counts;
};

export const downloadBackupFile = (dump) => {
  const exportedAt = dump?.exportedAt || new Date().toISOString();
  const stamp = exportedAt.replace(/[:.]/g, '-').slice(0, 19);
  const fileName = `spmt-backup-${stamp}.json`;
  const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  const counts = tableCountsOf(dump);
  const totalRows = Object.values(counts).reduce((x, y) => x + y, 0);
  recordBackupHistory({ fileName, exportedAt, sizeBytes: blob.size, totalRows, tables: Object.keys(counts).length, kind: 'created:json' });
  return { fileName, sizeBytes: blob.size, totalRows };
};

export const downloadSqlBackupFile = (sqlText, suggestedName, exportedAt) => {
  const stamp = (exportedAt || new Date().toISOString()).replace(/[:.]/g, '-').slice(0, 19);
  const fileName = suggestedName || `spmt-backup-${stamp}.sql`;
  const blob = new Blob([sqlText], { type: 'application/sql' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  recordBackupHistory({ fileName, exportedAt: exportedAt || new Date().toISOString(), sizeBytes: blob.size, totalRows: null, kind: 'created:sql' });
  return { fileName, sizeBytes: blob.size };
};

export const parseBackupFile = (file) => new Promise((resolve) => {
  if (!file) { resolve({ success: false, error: 'No file selected.' }); return; }
  if (file.size > 50 * 1024 * 1024) { resolve({ success: false, error: 'File too large (max 50 MB).' }); return; }
  const isSql = /\.sql$/i.test(file.name || '');
  const reader = new FileReader();
  reader.onerror = () => resolve({ success: false, error: 'Could not read file.' });
  reader.onload = () => {
    try {
      if (isSql) {
        const text = String(reader.result || '');
        if (!text.startsWith('-- SPMT database backup')) {
          resolve({ success: false, error: 'Invalid SQL backup file: SPMT marker not found.' });
          return;
        }
        resolve({
          success: true,
          data: {
            payload: { sql: text },
            isSql: true,
            fileName: file.name,
            sizeBytes: file.size,
            exportedAt: null,
            counts: {},
            totalTables: null,
            totalRows: null,
          },
        });
        return;
      }
      const parsed = JSON.parse(reader.result);
      const counts = tableCountsOf(parsed?.tables ? parsed : parsed?.data ? parsed.data : parsed);
      const totalTables = Object.keys(counts).length;
      if (totalTables === 0) {
        resolve({ success: false, error: 'Invalid backup file: no table data found.' });
        return;
      }
      const totalRows = Object.values(counts).reduce((x, y) => x + y, 0);
      resolve({
        success: true,
        data: {
          payload: parsed,
          fileName: file.name,
          sizeBytes: file.size,
          exportedAt: parsed?.exportedAt || parsed?.data?.exportedAt || null,
          counts,
          totalTables,
          totalRows,
        },
      });
    } catch {
      resolve({ success: false, error: 'Invalid JSON file.' });
    }
  };
  reader.readAsText(file);
});

export const restoreBackup = async (payload, mode = 'replace') => {
  try {
    const isSql = !!(payload && typeof payload.sql === 'string');
    const result = isSql
      ? await api('/backup/import', { method: 'POST', body: payload, timeout: 120000 })
      : await api(`/backup/import?mode=${mode === 'merge' ? 'merge' : 'replace'}`, {
        method: 'POST',
        body: payload,
        timeout: 120000,
      });
    recordBackupHistory({ fileName: '(restore)', exportedAt: new Date().toISOString(), kind: isSql ? 'restore:sql' : `restore:${mode}`, totalRows: null });
    return { success: true, message: result.message || 'Restore complete.' };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

/* Drop the browser-side data mirror so the app re-syncs from the restored DB. */
export const clearLocalMirror = () => {
  try { localStorage.removeItem('spmt_app_data'); } catch { /* ignore */ }
};

export const getBackupHistory = () => {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const recordBackupHistory = (entry) => {
  try {
    const list = getBackupHistory();
    list.unshift({ at: new Date().toISOString(), ...entry });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 20)));
  } catch { /* ignore */ }
};

export const clearBackupHistory = () => {
  try { localStorage.removeItem(HISTORY_KEY); } catch { /* ignore */ }
  return { success: true };
};

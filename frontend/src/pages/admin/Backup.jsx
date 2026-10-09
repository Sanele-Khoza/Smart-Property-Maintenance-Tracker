import React, { useEffect, useRef, useState } from 'react';
import { FaDatabase, FaDownload, FaUpload, FaHistory, FaCheckCircle, FaExclamationTriangle, FaTrash, FaRedo, FaTimes } from 'react-icons/fa';
import {
  getBackupInfo, exportBackup, downloadBackupFile, downloadSqlBackupFile, parseBackupFile,
  restoreBackup, clearLocalMirror, getBackupHistory, clearBackupHistory,
} from '../../data/backupStore';

const formatBytes = (n) => {
  if (n === null || n === undefined) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

const Backup = () => {
  const [info, setInfo] = useState(null);
  const [infoLoading, setInfoLoading] = useState(true);
  const [infoError, setInfoError] = useState('');
  const [exporting, setExporting] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [selected, setSelected] = useState(null);
  const [restoreMode, setRestoreMode] = useState('replace');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [ackRisk, setAckRisk] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [history, setHistory] = useState(getBackupHistory);
  const fileRef = useRef(null);

  const loadInfo = async () => {
    setInfoLoading(true);
    setInfoError('');
    const r = await getBackupInfo();
    if (r.success) setInfo(r.data);
    else setInfoError(r.error);
    setInfoLoading(false);
  };

  useEffect(() => { loadInfo(); }, []);

  const flash = (text, type) => setMsg({ text, type });

  const handleDownload = async (format = 'json') => {
    setExporting(format);
    flash('', '');
    try {
      const r = await exportBackup(format);
      if (!r.success) {
        flash(`Backup failed: ${r.error}`, 'error');
        return;
      }
      if (format === 'sql') {
        if (!r.data?.sql) {
          flash('Backup failed: server returned an empty SQL script.', 'error');
          return;
        }
        const dl = downloadSqlBackupFile(r.data.sql, r.data.filename, r.data.exportedAt);
        setHistory(getBackupHistory());
        flash(`SQL backup created and saved to your device: ${dl.fileName} (${formatBytes(dl.sizeBytes)}). Keep this file — it is your restore point.`, 'success');
      } else {
        if (!r.data?.dump || typeof r.data.dump !== 'object') {
          flash('Backup failed: server returned an empty backup.', 'error');
          return;
        }
        const dl = downloadBackupFile(r.data.dump);
        setHistory(getBackupHistory());
        flash(`Backup created and saved to your device: ${dl.fileName} (${dl.totalRows} records, ${formatBytes(dl.sizeBytes)}). Keep this file — it is your restore point.`, 'success');
      }
      loadInfo();
    } catch (e) {
      flash(`Backup failed: ${e?.message || 'unexpected error while saving the file'}`, 'error');
    } finally {
      setExporting(null);
    }
  };

  const handleFilePicked = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    flash('', '');
    const r = await parseBackupFile(file);
    if (!r.success) {
      setSelected(null);
      flash(r.error, 'error');
    } else {
      setSelected(r.data);
      setAckRisk(false);
      flash(r.data.isSql
        ? `Loaded ${r.data.fileName}: SQL restore script (${formatBytes(r.data.sizeBytes)}). This restores as a full replacement — then click Restore.`
        : `Loaded ${r.data.fileName}: ${r.data.totalRows} records across ${r.data.totalTables} tables. Choose a restore mode, then Restore.`, 'info');
    }
    e.target.value = '';
  };

  const openConfirm = () => {
    if (!selected) { flash('Choose a backup file first.', 'error'); return; }
    setAckRisk(false);
    setConfirmOpen(true);
  };

  const handleRestore = async () => {
    setRestoring(true);
    flash('', '');
    const r = await restoreBackup(selected.payload, restoreMode);
    setRestoring(false);
    if (!r.success) {
      flash(`Restore failed: ${r.error}`, 'error');
      return;
    }
    setHistory(getBackupHistory());
    setConfirmOpen(false);
    setSelected(null);
    flash(`${r.message} Reloading from the restored database…`, 'success');
    setTimeout(() => {
      clearLocalMirror();
      window.location.reload();
    }, 1500);
  };

  const counts = info?.counts || {};
  const countedTables = Object.entries(counts).filter(([, v]) => v > 0);
  const totalRows = info?.totalRows ?? countedTables.reduce((a, [, v]) => a + v, 0);

  return (
    <div>
      <div className="card">
        <div className="card-title">
          <span><FaDatabase /> Database Backup & Restore <span className="req-ref">NFR-R04</span></span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-secondary btn-sm" onClick={loadInfo} disabled={infoLoading}>
              <FaRedo /> {infoLoading ? 'Refreshing…' : 'Refresh'}
            </button>
            <button className="btn btn-teal btn-sm" onClick={() => handleDownload('json')} disabled={!!exporting}>
              <FaDownload /> {exporting === 'json' ? 'Creating…' : 'Create backup (.json)'}
            </button>
            <button className="btn btn-teal btn-sm" onClick={() => handleDownload('sql')} disabled={!!exporting}>
              <FaDownload /> {exporting === 'sql' ? 'Creating…' : 'Create backup (.sql)'}
            </button>
          </div>
        </div>

        {msg.text && (
          <div style={{
            padding: '8px 12px', marginBottom: 12, borderRadius: 6, fontSize: 11,
            backgroundColor: msg.type === 'error' ? 'rgba(220,60,60,0.08)' : msg.type === 'info' ? 'rgba(0,188,212,0.08)' : 'rgba(45,183,145,0.08)',
            border: msg.type === 'error' ? '1px solid rgba(220,60,60,0.2)' : msg.type === 'info' ? '1px solid rgba(0,188,212,0.2)' : '1px solid rgba(45,183,145,0.2)',
          }}>
            {msg.text}
          </div>
        )}

        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-value"><FaDatabase /> {infoLoading ? '…' : totalRows}</div>
            <div className="stat-label">Database Records</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{infoLoading ? '…' : (info?.tableCount ?? 0)}</div>
            <div className="stat-label">Tables</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{infoLoading ? '…' : (info?.dbSize || '—')}</div>
            <div className="stat-label">Database Size</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--teal)' }}>{history.filter(h => typeof h.kind === 'string' && h.kind.startsWith('created')).length}</div>
            <div className="stat-label">Backups Created</div>
          </div>
        </div>

        {infoError && (
          <p style={{ fontSize: 11, color: 'var(--danger)', marginTop: 8 }}>
            <FaExclamationTriangle style={{ marginRight: 4 }} />Could not reach the backup service: {infoError}
          </p>
        )}

        {!infoLoading && !infoError && countedTables.length > 0 && (
          <div style={{ marginTop: 10, padding: '10px 14px', backgroundColor: 'rgba(0,188,212,0.06)', borderRadius: 6, border: '1px solid rgba(0,188,212,0.15)', fontSize: 11, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {countedTables.slice(0, 12).map(([t, c]) => (
              <span key={t}><strong>{t}</strong>: {c}</span>
            ))}
            {countedTables.length > 12 && <span style={{ color: 'var(--text-dim)' }}>+{countedTables.length - 12} more</span>}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">
          <span><FaUpload /> Restore from file</span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>
          Select a backup file previously created from this page (<code>.json</code> or <code>.sql</code>). Restoring in
          <strong> Replace </strong> mode overwrites the entire database with the file contents. SQL backups always restore as a full replacement.
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          <input ref={fileRef} type="file" accept=".json,.sql,application/json,application/sql" style={{ display: 'none' }} onChange={handleFilePicked} />
          <button className="btn btn-secondary" onClick={() => fileRef.current && fileRef.current.click()}>
            <FaUpload /> Choose backup file
          </button>
          {selected && (
            <span style={{ fontSize: 11 }}><FaCheckCircle style={{ color: 'var(--teal)', marginRight: 4 }} />{selected.fileName} — {selected.isSql ? `SQL script, ${formatBytes(selected.sizeBytes)}` : `${selected.totalRows} records, ${formatBytes(selected.sizeBytes)}`}{selected.exportedAt ? ` (exported ${new Date(selected.exportedAt).toLocaleString()})` : ''}</span>
          )}
        </div>

        {selected && (
          <>
            {!selected.isSql && (
              <div className="form-group" style={{ maxWidth: 420 }}>
                <label className="form-label">Restore mode</label>
                <select className="form-select" value={restoreMode} onChange={e => setRestoreMode(e.target.value)}>
                  <option value="replace">Replace — wipe database and restore exactly from file (recommended)</option>
                  <option value="merge">Merge — insert missing records, keep current data</option>
                </select>
              </div>
            )}
            {!selected.isSql && (
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {Object.entries(selected.counts).slice(0, 12).map(([t, c]) => (
                  <span key={t}><strong>{t}</strong>: {c}</span>
                ))}
              </div>
            )}
            <div className="form-actions" style={{ justifyContent: 'flex-start' }}>
              <button className="btn btn-secondary" onClick={() => setSelected(null)}>Clear</button>
              <button className="btn btn-primary" onClick={openConfirm}><FaUpload /> Restore…</button>
            </div>
          </>
        )}
      </div>

      <div className="card">
        <div className="card-title">
          <span><FaHistory /> Backup Activity</span>
          {history.length > 0 && <button className="btn btn-secondary btn-sm" onClick={() => { clearBackupHistory(); setHistory([]); }}><FaTrash /> Clear</button>}
        </div>
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead><tr><th>When</th><th>Activity</th><th>File</th><th>Records</th><th>Size</th></tr></thead>
            <tbody>
              {history.length === 0 ? (
                <tr><td colSpan="5" className="empty-text" style={{ textAlign: 'center', padding: 24 }}>No backups downloaded or restored yet on this browser.</td></tr>
              ) : (
                history.map((h, i) => (
                  <tr key={i}>
                    <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{new Date(h.at).toLocaleString()}</td>
                    <td style={{ fontSize: 11 }}>{h.kind === 'created' || h.kind === 'download' ? 'Created backup' : h.kind && h.kind.startsWith('restore') ? `Restore (${h.kind.split(':')[1] || 'replace'})` : h.kind}</td>
                    <td className="cell-mono" style={{ fontSize: 11 }}>{h.fileName || '—'}</td>
                    <td className="cell-mono" style={{ fontSize: 11 }}>{h.totalRows ?? '—'}</td>
                    <td className="cell-mono" style={{ fontSize: 11 }}>{h.sizeBytes ? formatBytes(h.sizeBytes) : '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {confirmOpen && selected && (
        <div className="modal" onClick={() => setConfirmOpen(false)}>
          <div className="edit-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="edit-modal-header">
              <span><FaExclamationTriangle /> Confirm restore</span>
              <button className="modal-close-btn" onClick={() => setConfirmOpen(false)}><FaTimes /></button>
            </div>
            <div style={{ padding: 20 }}>
              <p style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 12 }}>
                Restore from <strong>{selected.fileName}</strong> in <strong>{selected.isSql ? 'full replacement (SQL script)' : restoreMode}</strong> mode?
              </p>
              {(selected.isSql || restoreMode === 'replace') ? (
                <p style={{ fontSize: 11, color: 'var(--danger)', marginBottom: 16 }}>
                  <FaExclamationTriangle style={{ marginRight: 4 }} />
                  This wipes the current database and replaces it with the backup file
                  {selected.isSql ? '' : ` (${selected.totalRows} records)`}.
                  Anything created after the backup was created will be lost. The app will reload afterwards.
                </p>
              ) : (
                <p style={{ fontSize: 11, color: 'var(--amber)', marginBottom: 16 }}>
                  <FaExclamationTriangle style={{ marginRight: 4 }} />
                  Merge mode inserts missing records but keeps current data. It cannot undo deletions.
                </p>
              )}
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, marginBottom: 16 }}>
                <input type="checkbox" checked={ackRisk} onChange={e => setAckRisk(e.target.checked)} />
                I understand{selected.isSql || restoreMode === 'replace' ? ' this overwrites the database' : ' the effects of this restore'}
              </label>
              <div className="form-actions">
                <button className="btn btn-secondary" onClick={() => setConfirmOpen(false)}>Cancel</button>
                <button className="btn btn-primary" disabled={!ackRisk || restoring} onClick={handleRestore}>
                  <FaUpload /> {restoring ? 'Restoring…' : 'Restore now'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Backup;

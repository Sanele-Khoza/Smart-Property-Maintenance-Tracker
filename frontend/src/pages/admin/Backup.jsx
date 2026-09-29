import React, { useEffect, useState, useCallback, useRef } from 'react';
import { FaDatabase, FaHistory, FaClock, FaCheckCircle, FaExclamationTriangle, FaRedo, FaUndo, FaSearch, FaServer, FaCalendarAlt, FaTrash, FaSpinner } from 'react-icons/fa';
import { api } from '../../api/client';

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1; }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 2)} ${units[i]}`;
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

const Backup = () => {
  const [schedule, setSchedule] = useState(null);
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [verifyingId, setVerifyingId] = useState(null);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [restoreConfirmText, setRestoreConfirmText] = useState('');
  const [verifyResult, setVerifyResult] = useState(null);
  const [detail, setDetail] = useState(null);
  const [msg, setMsg] = useState(null);
  const pollTimer = useRef(null);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [listRes, schedRes] = await Promise.all([
        api('/backup'),
        api('/backup/schedule'),
      ]);
      setBackups(listRes.data.backups || []);
      setSchedule(schedRes.data);
    } catch (err) {
      setError(err.message || 'Failed to load backups.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => () => { if (pollTimer.current) clearTimeout(pollTimer.current); }, []);

  const pollUntilStable = useCallback(() => {
    pollTimer.current = setTimeout(async () => {
      try {
        const res = await api('/backup');
        setBackups(res.data.backups || []);
        const stillRunning = (res.data.backups || []).some(b => b.status === 'RUNNING');
        if (stillRunning) pollUntilStable();
      } catch { /* ignore */ }
    }, 2000);
  }, []);

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    setMsg(null);
    try {
      const res = await api('/backup', { method: 'POST', timeout: 60000 });
      setMsg({ kind: 'success', text: res.message || 'Backup created.' });
      await load({ silent: true });
      pollUntilStable();
    } catch (err) {
      setError(err.message || 'Backup creation failed.');
    } finally {
      setCreating(false);
    }
  };

  const handleVerify = async (id) => {
    setVerifyingId(id);
    setError(null);
    setVerifyResult(null);
    try {
      const res = await api(`/backup/${id}/verify`, { method: 'POST', timeout: 60000 });
      setVerifyResult(res.data);
      await load({ silent: true });
    } catch (err) {
      setError(err.message || 'Verification failed.');
    } finally {
      setVerifyingId(null);
    }
  };

  const confirmRestore = async () => {
    if (!restoreTarget || restoreConfirmText !== 'RESTORE') return;
    setMsg(null);
    setError(null);
    try {
      const res = await api(`/backup/${restoreTarget.id}/restore`, {
        method: 'POST',
        body: { confirm: true },
        timeout: 120000,
      });
      setMsg({ kind: 'success', text: res.message || 'Database restored from backup.' });
      setRestoreTarget(null);
      setRestoreConfirmText('');
      await load({ silent: true });
    } catch (err) {
      setError(err.message || 'Restore failed.');
      setRestoreTarget(null);
      setRestoreConfirmText('');
    }
  };

  const running = backups.some(b => b.status === 'RUNNING');
  const latest = backups.find(b => b.status === 'SUCCESS');

  return (
    <div>
      <div className="card">
        <div className="card-title">
          <span><FaDatabase /> Database Backup & Recovery <span className="req-ref">NFR-R04</span></span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-teal btn-sm" onClick={handleCreate} disabled={creating || running}>
              <FaRedo /> {creating ? 'Backing up…' : 'Back Up Now'}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => load()}>
              <FaSpinner /> Refresh
            </button>
          </div>
        </div>

        {msg && (
          <div style={{
            padding: '8px 12px', marginBottom: 12, borderRadius: 6, fontSize: 11,
            backgroundColor: msg.kind === 'success' ? 'rgba(45,183,145,0.08)' : 'rgba(220,60,60,0.08)',
            border: msg.kind === 'success' ? '1px solid rgba(45,183,145,0.2)' : '1px solid rgba(220,60,60,0.2)',
          }}>
            {msg.text}
          </div>
        )}
        {error && (
          <div style={{
            padding: '8px 12px', marginBottom: 12, borderRadius: 6, fontSize: 11,
            backgroundColor: 'rgba(220,60,60,0.08)', border: '1px solid rgba(220,60,60,0.2)',
          }}>
            <FaExclamationTriangle style={{ marginRight: 6 }} /> {error}
          </div>
        )}

        {running && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', marginBottom: 12,
            borderRadius: 6, fontSize: 11, color: 'var(--amber)',
            backgroundColor: 'rgba(240,180,50,0.08)', border: '1px solid rgba(240,180,50,0.25)',
          }}>
            <FaClock className="spin" /> Backup in progress — live status updates as it runs.
          </div>
        )}

        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-value"><FaHistory /> {backups.length}</div>
            <div className="stat-label">Total Backups Recorded</div>
          </div>
          <div className="stat-card">
            <div className="stat-value"><FaDatabase /> {latest ? formatBytes(latest.size_bytes) : '—'}</div>
            <div className="stat-label">Latest Backup Size</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--teal)' }}>{schedule ? formatBytes(schedule.dbSizeBytes) : '—'}</div>
            <div className="stat-label">Live Database Size</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--amber)' }}>{schedule?.tableCount ?? '—'}</div>
            <div className="stat-label">Tables in Database (live)</div>
          </div>
        </div>

        <div style={{ marginTop: 10, display: 'flex', gap: 20, padding: '10px 14px', backgroundColor: 'rgba(0,188,212,0.06)', borderRadius: 6, border: '1px solid rgba(0,188,212,0.15)', fontSize: 11, flexWrap: 'wrap' }}>
          <span><FaServer style={{ marginRight: 4 }} /> Backups stored in: <strong className="cell-mono" style={{ fontSize: 10 }}>{schedule?.backupDir || 'loading…'}</strong></span>
          <span>
            <FaCalendarAlt style={{ marginRight: 4 }} /> Schedule:{' '}
            <strong>{schedule?.scheduleEnabled ? (schedule.scheduleCron || '—') : 'Disabled'}</strong>
            {schedule?.scheduleEnabled && (
              <span style={{ marginLeft: 6 }}>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--teal)', marginRight: 4 }} />
                Active
              </span>
            )}
          </span>
          <span><FaDatabase style={{ marginRight: 4 }} /> Retention: <strong>{schedule?.retentionCount ?? '—'} newest backup(s)</strong></span>
          <span>
            Latest backup:{' '}
            <strong>{latest ? `${formatDate(latest.completed_at)}` : '—'}</strong>
          </span>
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <span><FaHistory /> Backup History</span>
        </div>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '40px 16px', color: '#5a8aaa' }}>
            <FaSpinner className="spin" /> Loading backups…
          </div>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Filename</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Size</th>
                  <th>SHA-256</th>
                  <th>Verified</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {backups.length === 0 ? (
                  <tr><td colSpan="8" className="empty-text" style={{ textAlign: 'center', padding: 24 }}>No backups yet. Click “Back Up Now” to create the first one.</td></tr>
                ) : (
                  backups.map(b => (
                    <tr key={b.id}>
                      <td className="cell-mono" style={{ fontSize: 10 }}>{b.filename}</td>
                      <td>
                        {b.backup_type === 'SCHEDULED' ? (
                          <span className="badge badge-info" style={{ fontSize: 8 }}>Scheduled</span>
                        ) : (
                          <span className="badge badge-completed" style={{ fontSize: 8 }}>Manual</span>
                        )}
                      </td>
                      <td>
                        {b.status === 'SUCCESS' ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--teal)' }}>
                            <FaCheckCircle style={{ fontSize: 10 }} /> Success
                          </span>
                        ) : b.status === 'RUNNING' ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--amber)' }}>
                            <FaClock className="spin" style={{ fontSize: 10 }} /> Running
                          </span>
                        ) : (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--danger)' }}>
                            <FaExclamationTriangle style={{ fontSize: 10 }} /> Failed
                          </span>
                        )}
                      </td>
                      <td className="cell-mono" style={{ fontSize: 11 }}>{b.size_bytes ? formatBytes(b.size_bytes) : '—'}</td>
                      <td className="cell-mono" style={{ fontSize: 10, color: 'var(--text-dim)' }} title={b.sha256}>{b.sha256 ? `${b.sha256.slice(0, 16)}…` : '—'}</td>
                      <td>
                        {b.verified ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--teal)' }}>
                            <FaCheckCircle style={{ fontSize: 10 }} /> Verified
                          </span>
                        ) : b.sha256 ? (
                          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Not verified</span>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>—</span>
                        )}
                      </td>
                      <td style={{ fontSize: 10, whiteSpace: 'nowrap', color: 'var(--text-dim)' }} title={b.completed_at || b.started_at}>{formatDate(b.completed_at || b.started_at)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => handleVerify(b.id)} disabled={verifyingId === b.id} title="Verify archive integrity" style={{ fontSize: 9, padding: '2px 5px' }}>
                            <FaSearch /> {verifyingId === b.id ? 'Verifying…' : 'Verify'}
                          </button>
                          {b.status === 'SUCCESS' && (
                            <button className="btn btn-sm" onClick={() => setRestoreTarget(b)} title="Restore from this backup (overwrites DB)" style={{ fontSize: 9, padding: '2px 5px', backgroundColor: 'rgba(220,60,60,0.12)', color: 'var(--danger)', border: '1px solid rgba(220,60,60,0.3)' }}>
                              <FaUndo /> Restore
                            </button>
                          )}
                          <button className="btn btn-secondary btn-sm" onClick={() => setDetail(b)} title="Details (path, error message)" style={{ fontSize: 9, padding: '2px 5px' }}>
                            <FaDatabase /> Info
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {verifyResult && (
        <div className="modal" onClick={() => setVerifyResult(null)}>
          <div className="edit-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="edit-modal-header">
              <span><FaSearch /> Verification Result</span>
              <button className="modal-close-btn" onClick={() => setVerifyResult(null)}><FaExclamationTriangle /></button>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 6, fontSize: 12,
                backgroundColor: verifyResult.verified ? 'rgba(45,183,145,0.08)' : 'rgba(220,60,60,0.08)',
                border: verifyResult.verified ? '1px solid rgba(45,183,145,0.25)' : '1px solid rgba(220,60,60,0.25)',
                color: verifyResult.verified ? 'var(--teal)' : 'var(--danger)',
              }}>
                {verifyResult.verified ? <FaCheckCircle /> : <FaExclamationTriangle />}
                {verifyResult.verified ? 'Backup archive is valid' : 'Backup verification failed'}
              </div>
              {verifyResult.reason && verifyResult.reason !== 'ok' && (
                <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 12, whiteSpace: 'pre-wrap' }}>{verifyResult.reason}</p>
              )}
              <div className="form-actions" style={{ marginTop: 16 }}>
                <button className="btn btn-secondary" onClick={() => setVerifyResult(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {detail && (
        <div className="modal" onClick={() => setDetail(null)}>
          <div className="edit-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="edit-modal-header">
              <span><FaDatabase /> Backup Details</span>
              <button className="modal-close-btn" onClick={() => setDetail(null)}><FaTrash /></button>
            </div>
            <div style={{ padding: 20, fontSize: 11, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <span>Filename: <strong className="cell-mono">{detail.filename}</strong></span>
              <span>Status: <strong>{detail.status}</strong></span>
              <span>Type: <strong>{detail.backup_type}</strong></span>
              <span>Size: <strong>{detail.size_bytes ? formatBytes(detail.size_bytes) : '—'}</strong></span>
              <span>Verified: <strong>{detail.verified ? 'Yes' : 'No'}</strong></span>
              <span>Created: <strong>{formatDate(detail.created_at)}</strong></span>
              <span style={{ gridColumn: '1 / -1' }}>Started: <strong>{formatDate(detail.started_at)}</strong></span>
              <span style={{ gridColumn: '1 / -1' }}>Completed: <strong>{formatDate(detail.completed_at)}</strong></span>
              <span style={{ gridColumn: '1 / -1' }}>Path: <strong className="cell-mono" style={{ fontSize: 10, wordBreak: 'break-all' }}>{detail.backup_path}</strong></span>
              <span style={{ gridColumn: '1 / -1' }}>SHA-256: <strong className="cell-mono" style={{ fontSize: 10, wordBreak: 'break-all' }}>{detail.sha256 || '—'}</strong></span>
              {detail.error_message && (
                <span style={{ gridColumn: '1 / -1', color: 'var(--danger)' }}>Error: <strong>{detail.error_message}</strong></span>
              )}
            </div>
            <div className="form-actions" style={{ marginTop: 16 }}>
              <button className="btn btn-secondary" onClick={() => setDetail(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {restoreTarget && (
        <div className="modal" onClick={() => { setRestoreTarget(null); setRestoreConfirmText(''); }}>
          <div className="edit-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="edit-modal-header">
              <span><FaUndo /> Restore from Backup</span>
              <button className="modal-close-btn" onClick={() => { setRestoreTarget(null); setRestoreConfirmText(''); }}><FaUndo /></button>
            </div>
            <div style={{ padding: 20 }}>
              <p style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 12 }}>
                Restore the database from <strong className="cell-mono">{restoreTarget.filename}</strong>?
              </p>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <span>Created: <strong>{formatDate(restoreTarget.completed_at || restoreTarget.started_at)}</strong></span>
                <span>Size: <strong>{restoreTarget.size_bytes ? formatBytes(restoreTarget.size_bytes) : '—'}</strong></span>
                <span>Verified: <strong>{restoreTarget.verified ? 'Yes' : 'No'}</strong></span>
                <span>Hash: <strong className="cell-mono">{restoreTarget.sha256 ? restoreTarget.sha256.slice(0, 12) : '—'}…</strong></span>
              </div>
              <p style={{ fontSize: 11, color: 'var(--danger)', marginBottom: 16, lineHeight: 1.6 }}>
                <FaExclamationTriangle style={{ marginRight: 4 }} />
                Restoring <strong>overwrites the current database</strong> and destroys any data created after this backup. This action is irreversible and is recorded in the security audit log.
              </p>
              <label style={{ fontSize: 11, color: 'var(--text-dim)', display: 'block', marginBottom: 6 }}>
                Type <strong>RESTORE</strong> to confirm:
              </label>
              <input
                className="form-input"
                style={{ width: '100%', boxSizing: 'border-box' }}
                value={restoreConfirmText}
                onChange={e => setRestoreConfirmText(e.target.value)}
                placeholder="RESTORE"
              />
              <div className="form-actions" style={{ marginTop: 16 }}>
                <button className="btn btn-secondary" onClick={() => { setRestoreTarget(null); setRestoreConfirmText(''); }}>Cancel</button>
                <button className="btn btn-primary" onClick={confirmRestore} disabled={restoreConfirmText !== 'RESTORE'}>
                  <FaUndo /> Restore Database
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
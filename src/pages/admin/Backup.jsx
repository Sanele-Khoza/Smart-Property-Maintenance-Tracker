import React, { useState } from 'react';
import { FaDatabase, FaCloud, FaHistory, FaClock, FaCheckCircle, FaExclamationTriangle, FaRedo, FaCalendarAlt, FaAws, FaUndo, FaTimes } from 'react-icons/fa';

const now = Date.now();
const day = 86400000;

const SEED_SNAPSHOTS = Array.from({ length: 30 }, (_, i) => ({
  id: `snap-${String(i + 1).padStart(3, '0')}`,
  type: 'automated',
  status: 'available',
  createdAt: new Date(now - (i + 1) * day).toISOString(),
  instanceSize: 'db.t3.medium',
  storageGiB: 20,
  engineVersion: i < 15 ? '2019' : '2022',
})).concat([
  { id: 'snap-031', type: 'manual', status: 'available', createdAt: new Date(now - 5 * day).toISOString(), instanceSize: 'db.t3.medium', storageGiB: 20, engineVersion: '2022' },
  { id: 'snap-032', type: 'manual', status: 'creating',  createdAt: new Date(now - 0.5 * day).toISOString(), instanceSize: 'db.t3.medium', storageGiB: 20, engineVersion: '2022' },
]);

const RETENTION_DAYS = 30;
const RPO_MINUTES = 5;

const Backup = () => {
  const [snapshots, setSnapshots] = useState(SEED_SNAPSHOTS);
  const [triggering, setTriggering] = useState(false);
  const [msg, setMsg] = useState('');
  const [restoreTarget, setRestoreTarget] = useState(null);

  const availableSnaps = snapshots.filter(s => s.status === 'available');
  const latestSnapshot = availableSnaps.length > 0 ? availableSnaps.reduce((a, b) => new Date(a.createdAt) > new Date(b.createdAt) ? a : b) : null;
  const earliestSnapshot = availableSnaps.length > 0 ? availableSnaps.reduce((a, b) => new Date(a.createdAt) < new Date(b.createdAt) ? a : b) : null;
  const oldestRetained = earliestSnapshot ? new Date(earliestSnapshot.createdAt) : new Date(now - RETENTION_DAYS * day);

  const handleTriggerSnapshot = () => {
    setTriggering(true);
    setMsg('');
    setTimeout(() => {
      const newSnap = {
        id: `snap-${String(snapshots.length + 1).padStart(3, '0')}`,
        type: 'manual',
        status: 'creating',
        createdAt: new Date().toISOString(),
        instanceSize: 'db.t3.medium',
        storageGiB: 20,
        engineVersion: '2022',
      };
      setSnapshots(p => [newSnap, ...p]);
      setTriggering(false);
      setMsg('Manual snapshot triggered successfully. Initializing...');
      setTimeout(() => {
        setSnapshots(p => p.map(s => s.id === newSnap.id ? { ...s, status: 'available' } : s));
        setMsg('Manual snapshot completed and available.');
      }, 3000);
    }, 1500);
  };

  const handleRestore = (snapshot) => {
    setRestoreTarget(snapshot);
  };

  const confirmRestore = () => {
    setMsg(`Restore initiated from ${restoreTarget.id} (${new Date(restoreTarget.createdAt).toLocaleString()}). Estimated downtime: 15-30 min.`);
    setRestoreTarget(null);
  };

  const handlePitrRestore = () => {
    const targetTime = new Date(now - 2 * 60 * 1000).toLocaleString();
    setMsg(`Point-in-time recovery initiated to ${targetTime} (RPO: 5 min). Restoring from ${new Date(now - 10 * 60 * 1000).toLocaleString()} to ${targetTime}.`);
  };

  return (
    <div>
      <div className="card">
        <div className="card-title">
          <span><FaDatabase /> RDS Backup & Recovery <span className="req-ref">NFR-R04</span></span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-teal btn-sm" onClick={handleTriggerSnapshot} disabled={triggering}>
              <FaRedo /> {triggering ? 'Triggering...' : 'Trigger Snapshot'}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handlePitrRestore}>
              <FaUndo /> PITR Restore
            </button>
          </div>
        </div>
        {msg && (
          <div style={{
            padding: '8px 12px', marginBottom: 12, borderRadius: 6, fontSize: 11,
            backgroundColor: msg.includes('fail') ? 'rgba(220,60,60,0.08)' : 'rgba(45,183,145,0.08)',
            border: msg.includes('fail') ? '1px solid rgba(220,60,60,0.2)' : '1px solid rgba(45,183,145,0.2)',
          }}>
            {msg}
          </div>
        )}
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-value"><FaCloud /> {snapshots.filter(s => s.type === 'automated' && s.status === 'available').length}</div>
            <div className="stat-label">Available Automated Snapshots (daily)</div>
          </div>
          <div className="stat-card">
            <div className="stat-value"><FaDatabase /> {snapshots.filter(s => s.status === 'available').reduce((sum, s) => sum + s.storageGiB, 0)} GiB</div>
            <div className="stat-label">Total Snapshot Storage</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--teal)' }}>{RETENTION_DAYS} days</div>
            <div className="stat-label">Retention Period</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--amber)' }}>{RPO_MINUTES} min</div>
            <div className="stat-label">Recovery Point Objective (RPO)</div>
          </div>
        </div>
        <div style={{ marginTop: 10, display: 'flex', gap: 20, padding: '10px 14px', backgroundColor: 'rgba(0,188,212,0.06)', borderRadius: 6, border: '1px solid rgba(0,188,212,0.15)', fontSize: 11, flexWrap: 'wrap' }}>
          <span><FaAws style={{ marginRight: 4 }} /> Instance: <strong>db.t3.medium</strong> (20 GiB gp2) <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>per SDD §7 Capacity Planning</span></span>
          <span><FaCalendarAlt style={{ marginRight: 4 }} /> Oldest retained: <strong>{oldestRetained.toLocaleDateString()}</strong></span>
          <span><FaClock style={{ marginRight: 4 }} /> Latest snapshot: <strong>{latestSnapshot ? new Date(latestSnapshot.createdAt).toLocaleString() : '—'}</strong></span>
          <span>
            <FaHistory style={{ marginRight: 4 }} /> PITR window:{' '}
            <strong style={{ color: 'var(--teal)' }}>{new Date(now - 5 * 60 * 1000).toLocaleString()}</strong> to now
          </span>
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <span><FaHistory /> Snapshot History</span>
        </div>
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Snapshot ID</th>
                <th>Type</th>
                <th>Status</th>
                <th>Created</th>
                <th>Instance</th>
                <th>Storage</th>
                <th>Engine</th>
                <th>Retained Until</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.length === 0 ? (
                <tr><td colSpan="9" className="empty-text" style={{ textAlign: 'center', padding: 24 }}>No snapshots available.</td></tr>
              ) : (
                snapshots.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(s => {
                  const retainedUntil = new Date(new Date(s.createdAt).getTime() + RETENTION_DAYS * day);
                  const isExpired = retainedUntil < new Date();
                  return (
                    <tr key={s.id} style={s.type === 'manual' ? { backgroundColor: 'rgba(45,183,145,0.04)' } : {}}>
                      <td className="cell-mono" style={{ fontSize: 10 }}>{s.id}</td>
                      <td>
                        {s.type === 'automated' ? (
                          <span className="badge badge-info" style={{ fontSize: 8 }}>Automated</span>
                        ) : (
                          <span className="badge badge-completed" style={{ fontSize: 8 }}>Manual</span>
                        )}
                      </td>
                      <td>
                        {s.status === 'available' ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--teal)' }}>
                            <FaCheckCircle style={{ fontSize: 10 }} /> Available
                          </span>
                        ) : s.status === 'creating' ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--amber)' }}>
                            <FaClock style={{ fontSize: 10 }} /> Creating
                          </span>
                        ) : (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--danger)' }}>
                            <FaExclamationTriangle style={{ fontSize: 10 }} /> {s.status}
                          </span>
                        )}
                      </td>
                      <td style={{ fontSize: 10, whiteSpace: 'nowrap', color: 'var(--text-dim)' }}>{new Date(s.createdAt).toLocaleString()}</td>
                      <td style={{ fontSize: 10, fontFamily: 'monospace' }}>{s.instanceSize}</td>
                      <td className="cell-mono" style={{ fontSize: 11 }}>{s.storageGiB} GiB</td>
                      <td className="cell-mono" style={{ fontSize: 11 }}>SQL Server {s.engineVersion}</td>
                      <td style={{ fontSize: 10, whiteSpace: 'nowrap', color: isExpired ? 'var(--danger)' : 'var(--text-dim)' }}>
                        {isExpired ? 'EXPIRED' : retainedUntil.toLocaleDateString()}
                      </td>
                      <td>
                        {s.status === 'available' && (
                          <button className="btn btn-secondary btn-sm" onClick={() => handleRestore(s)} title="Restore from this snapshot" style={{ fontSize: 9, padding: '2px 5px' }}>
                            <FaUndo /> Restore
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {restoreTarget && (
        <div className="modal" onClick={() => setRestoreTarget(null)}>
          <div className="edit-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="edit-modal-header">
              <span><FaUndo /> Restore from Snapshot</span>
              <button className="modal-close-btn" onClick={() => setRestoreTarget(null)}><FaTimes /></button>
            </div>
            <div style={{ padding: 20 }}>
              <p style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 12 }}>
                Restore RDS instance from <strong>{restoreTarget.id}</strong>?
              </p>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <span>Snapshot: <strong>{restoreTarget.id}</strong></span>
                <span>Created: <strong>{new Date(restoreTarget.createdAt).toLocaleString()}</strong></span>
                <span>Engine: <strong>SQL Server {restoreTarget.engineVersion}</strong></span>
                <span>Storage: <strong>{restoreTarget.storageGiB} GiB</strong></span>
              </div>
              <p style={{ fontSize: 11, color: 'var(--amber)', marginBottom: 16 }}>
                <FaExclamationTriangle style={{ marginRight: 4 }} />
                Restoring overwrites the current instance. Estimated downtime: 15-30 minutes. Data after snapshot creation will be lost (RPO: 5 min PITR available as alternative).
              </p>
              <div className="form-actions">
                <button className="btn btn-secondary" onClick={() => setRestoreTarget(null)}>Cancel</button>
                <button className="btn btn-primary" onClick={confirmRestore}><FaUndo /> Restore</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Backup;

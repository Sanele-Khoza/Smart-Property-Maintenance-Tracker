import React, { useState } from 'react';
import { FaBell, FaExclamationTriangle, FaCheck, FaRedo, FaTimes, FaEnvelope, FaMobileAlt, FaSms, FaClock, FaShieldAlt } from 'react-icons/fa';
import { getNotifications, updateNotificationStatus } from '../../data/store';
import Alert from '../../components/common/Alert';

const STATUS_STYLES = {
  Pending:    { bg: 'rgba(240,180,50,0.15)', color: '#f0b432' },
  Sent:       { bg: 'rgba(50,120,220,0.15)', color: '#3278dc' },
  Delivered:  { bg: 'rgba(45,183,145,0.15)', color: '#2db791' },
  Failed:     { bg: 'rgba(220,60,60,0.15)',  color: '#dc3c3c' },
};

const TYPE_ICONS = {
  email: FaEnvelope,
  push: FaMobileAlt,
  sms: FaSms,
};

const RATE_LIMIT = 10; // 10 push/hour/user for non-emergency

const Notifications = () => {
  const [notifications, setNotifications] = useState(getNotifications);
  const [alert, setAlert] = useState({ msg: '', type: '' });
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [emergencyFilter, setEmergencyFilter] = useState('');

  const refresh = () => setNotifications(getNotifications());

  const showAlert = (msg, type) => {
    setAlert({ msg, type });
    setTimeout(() => setAlert({ msg: '', type: '' }), 5000);
  };

  const filtered = notifications.filter(n => {
    if (statusFilter && n.deliveryStatus !== statusFilter) return false;
    if (typeFilter && n.type !== typeFilter) return false;
    if (emergencyFilter === 'emergency' && !n.isEmergency) return false;
    if (emergencyFilter === 'non-emergency' && n.isEmergency) return false;
    return true;
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const now = Date.now();
  const oneHourAgo = new Date(now - 3600000).toISOString();
  const pushLastHour = notifications.filter(n => n.type === 'push' && n.createdAt >= oneHourAgo).length;

  const pendingCount = filtered.filter(n => n.deliveryStatus === 'Pending').length;
  const failedCount = filtered.filter(n => n.deliveryStatus === 'Failed').length;
  const emergencyCount = filtered.filter(n => n.isEmergency).length;

  const handleRetry = async (notif) => {
    const newRetry = (notif.retryCount || 0) + 1;
    const r = await updateNotificationStatus(notif.id, 'Pending', newRetry);
    if (r.success) {
      showAlert(`Retry ${notif.id} (attempt ${newRetry})`, 'success');
      refresh();
    }
  };

  const handleDismiss = async (notif) => {
    const r = await updateNotificationStatus(notif.id, 'Sent', notif.retryCount);
    if (r.success) {
      showAlert(`Dismissed ${notif.id}`, 'success');
      refresh();
    }
  };

  const deliveryStatuses = ['Pending', 'Sent', 'Delivered', 'Failed'];
  const uniqueTypes = [...new Set(notifications.map(n => n.type))];

  return (
    <div>
      <div className="card">
        <div className="card-title">
          <span><FaBell /> Notifications <span className="req-ref">MOD-008</span></span>
        </div>
        <Alert msg={alert.msg} type={alert.type} />
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-value"><FaBell /> {notifications.length}</div>
            <div className="stat-label">Total Notifications</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: pendingCount > 0 ? 'var(--amber)' : 'var(--text)' }}>
              <FaClock /> {pendingCount}
            </div>
            <div className="stat-label">Pending</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: failedCount > 0 ? 'var(--danger)' : 'var(--text)' }}>
              <FaExclamationTriangle /> {failedCount}
            </div>
            <div className="stat-label">Failed</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: emergencyCount > 0 ? 'var(--danger)' : 'var(--text)' }}>
              <FaShieldAlt /> {emergencyCount}
            </div>
            <div className="stat-label">Emergency (TTL=0)</div>
          </div>
        </div>
        <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 6, backgroundColor: 'rgba(0,188,212,0.06)', border: '1px solid rgba(0,188,212,0.15)', fontSize: 11, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <span><FaClock style={{ marginRight: 4 }} /> Push rate: <strong>{pushLastHour}/{RATE_LIMIT}</strong> pushes in the last hour (10 push/hour/user limit for non-emergency)</span>
          {pushLastHour >= RATE_LIMIT && <span className="badge badge-warning" style={{ fontSize: 9 }}>RATE LIMITED</span>}
          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-dim)' }}>
            Emergency notifications: TTL=0, no queuing, immediate SysAdmin alert on failure
          </span>
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <span><FaBell /> Notification Log</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <select className="form-select" style={{ width: 'auto', minWidth: 90, fontSize: 11, padding: '3px 6px' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              {deliveryStatuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="form-select" style={{ width: 'auto', minWidth: 80, fontSize: 11, padding: '3px 6px' }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option value="">All Types</option>
              {uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className="form-select" style={{ width: 'auto', minWidth: 110, fontSize: 11, padding: '3px 6px' }} value={emergencyFilter} onChange={e => setEmergencyFilter(e.target.value)}>
              <option value="">All Notifications</option>
              <option value="emergency">Emergency Only</option>
              <option value="non-emergency">Non-Emergency</option>
            </select>
          </div>
        </div>
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Recipient</th>
                <th>Type</th>
                <th>Message</th>
                <th>Status</th>
                <th>Retry</th>
                <th>Emergency</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan="9" className="empty-text" style={{ textAlign: 'center', padding: 24 }}>No notifications match the current filter.</td></tr>
              ) : (
                filtered.map(n => {
                  const st = STATUS_STYLES[n.deliveryStatus] || {};
                  const TypeIcon = TYPE_ICONS[n.type] || FaEnvelope;
                  return (
                    <tr key={n.id} style={n.isEmergency ? { borderLeft: '3px solid var(--danger)' } : {}}>
                      <td className="cell-mono">{n.id}</td>
                      <td style={{ fontSize: 11 }}>{n.recipient}</td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                          <TypeIcon style={{ fontSize: 10, color: 'var(--text-dim)' }} /> {n.type}
                        </span>
                      </td>
                      <td style={{ fontSize: 11, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={n.message}>
                        {n.message}
                      </td>
                      <td>
                        <span style={{ display: 'inline-block', padding: '1px 6px', borderRadius: 3, fontSize: 10, fontWeight: 600, backgroundColor: st.bg || 'rgba(100,100,100,0.1)', color: st.color || 'var(--text)' }}>
                          {n.deliveryStatus}
                        </span>
                      </td>
                      <td className="cell-mono" style={{ fontSize: 11 }}>{n.retryCount || 0}</td>
                      <td>
                        {n.isEmergency ? (
                          <span className="badge badge-danger" style={{ fontSize: 8, cursor: 'help' }} title="TTL=0, no queuing, immediate SysAdmin alert if delivery fails">
                            <FaShieldAlt style={{ marginRight: 2 }} /> EMERGENCY
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>—</span>
                        )}
                      </td>
                      <td style={{ fontSize: 10, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{new Date(n.createdAt).toLocaleString()}</td>
                      <td>
                        <div className="action-cell">
                          {n.deliveryStatus === 'Failed' && (
                            <>
                              <button className="btn btn-teal btn-sm" onClick={() => handleRetry(n)} title={`Retry (attempt ${(n.retryCount || 0) + 1})`} style={{ fontSize: 9, padding: '2px 5px' }}>
                                <FaRedo /> Retry
                              </button>
                              <button className="btn btn-secondary btn-sm" onClick={() => handleDismiss(n)} title="Dismiss" style={{ fontSize: 9, padding: '2px 5px' }}>
                                <FaCheck /> Dismiss
                              </button>
                            </>
                          )}
                          {n.deliveryStatus === 'Pending' && (
                            <button className="btn btn-secondary btn-sm" onClick={() => handleDismiss(n)} title="Mark as sent" style={{ fontSize: 9, padding: '2px 5px' }}>
                              <FaCheck /> Acknowledge
                            </button>
                          )}
                          {!['Failed', 'Pending'].includes(n.deliveryStatus) && (
                            <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Notifications;

import React, { useState, useEffect } from 'react';
import { FaBell, FaEnvelope, FaMobileAlt, FaDesktop, FaCheckCircle, FaExclamationTriangle, FaClock, FaTimesCircle, FaFilter, FaBolt, FaCheckDouble } from 'react-icons/fa';
import { getSession } from '../../data/authStore';
import { getNotifications, markNotificationRead, markAllNotificationsRead, getNotificationPreferences, updateNotificationPreference, refreshNotifications } from '../../data/store';

const CHANNEL_ICONS = { email: <FaEnvelope />, push: <FaMobileAlt />, sms: <FaDesktop /> };
const CHANNEL_LABELS = { in_app: 'In-App', email: 'Email', push: 'Push' };
const STATUS_CONFIG = {
  Sent: { color: 'var(--teal)', icon: FaCheckCircle },
  Delivered: { color: 'var(--teal)', icon: FaCheckCircle },
  Pending: { color: 'var(--amber)', icon: FaClock },
  Failed: { color: 'var(--danger)', icon: FaTimesCircle },
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'pending', label: 'Pending' },
  { key: 'sent', label: 'Sent' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'failed', label: 'Failed' },
];

const Notifications = () => {
  const session = getSession();
  const providerEmail = session ? session.email : '';
  const providerName = session ? `${session.name} ${session.surname}` : '';
  const [allNotifs, setAllNotifs] = useState(getNotifications());
  const [filter, setFilter] = useState('all');
  const [prefs, setPrefs] = useState([]);

 const refresh = () => refreshNotifications().then(() => setAllNotifs(getNotifications()));

useEffect(() => {
  refresh();
  getNotificationPreferences().then(r => { if (r.success) setPrefs(r.data); });
}, []);

  const togglePref = async (channel, currentEnabled) => {
    const r = await updateNotificationPreference(channel, !currentEnabled);
    if (r.success) setPrefs(r.data);
  };
const myNotifs = allNotifs;

  const filtered = myNotifs.filter(n => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !n.read;
    return n.deliveryStatus?.toLowerCase() === filter;
  });

  const formatTime = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString();
  };

  const stats = {
    total: myNotifs.length,
    unread: myNotifs.filter(n => !n.read).length,
    emergency: myNotifs.filter(n => n.isEmergency).length,
  };

  const handleMarkRead = async (id) => {
    await markNotificationRead(id);
    refresh();
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    refresh();
  };

  return (
    <>
      <div className="welcome-banner"><h2><FaBell /> Notifications</h2><p>Job assignments, emergency alerts, and system messages. <span className="req-ref">MOD-008 / REQ-043 / NFR-P03</span></p></div>
      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <div className="stat-card"><div className="stat-value">{stats.total}</div><div className="stat-label">Total</div></div>
        <div className="stat-card"><div className="stat-value" style={{ color: stats.unread > 0 ? 'var(--amber)' : undefined }}>{stats.unread}</div><div className="stat-label">Unread</div></div>
        <div className="stat-card"><div className="stat-value" style={{ color: stats.emergency > 0 ? 'var(--danger)' : undefined }}>{stats.emergency}</div><div className="stat-label"><FaBolt /> Emergency</div></div>
      </div>

      <div className="card">
        <div className="card-title"><FaFilter style={{ marginRight: 6 }} />Notification Preferences</div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {prefs.map(p => (
            <label key={p.channel} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={p.enabled} onChange={() => togglePref(p.channel, p.enabled)} />
              {CHANNEL_LABELS[p.channel] || p.channel}
            </label>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <span><FaBell /> Notification History ({filtered.length})</span>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {FILTERS.map(f => (
              <button key={f.key} className={`btn btn-sm ${filter === f.key ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter(f.key)}>
                {f.icon && <f.icon style={{ marginRight: 2 }} />}{f.label}
              </button>
            ))}
            {stats.unread > 0 && (
              <button className="btn btn-sm btn-secondary" onClick={handleMarkAllRead}>
                <FaCheckDouble style={{ marginRight: 2 }} /> Mark all read
              </button>
            )}
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="empty-state"><div className="empty-text">No notifications to display.</div></div>
        ) : (
          <div style={{ maxHeight: 500, overflow: 'auto' }}>
            {filtered.map(n => {
              const StatusIcon = STATUS_CONFIG[n.deliveryStatus]?.icon || FaClock;
              const statusColor = STATUS_CONFIG[n.deliveryStatus]?.color || 'var(--text-dim)';
              return (
                <div key={n.id} onClick={() => !n.read && handleMarkRead(n.id)} style={{
                  padding: '12px', borderBottom: '1px solid var(--border)',
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                  cursor: n.read ? 'default' : 'pointer',
                  background: n.isEmergency ? 'rgba(192,57,43,0.04)' :
                    !n.read ? 'rgba(66,133,244,0.05)' :
                    n.deliveryStatus === 'Pending' ? 'rgba(243,156,18,0.04)' : 'transparent',
                  borderLeft: n.isEmergency ? '3px solid var(--danger)' : !n.read ? '3px solid var(--info, #4285f4)' : '3px solid transparent',
                }}>
                  <div style={{ fontSize: 16, color: statusColor, marginTop: 2 }}>
                    {n.isEmergency ? <FaBolt style={{ color: 'var(--danger)' }} /> : (CHANNEL_ICONS[n.type] || <FaBell />)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: n.read ? 400 : 600 }}>{n.message}</div>
                    <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 11, color: 'var(--text-dim)', flexWrap: 'wrap' }}>
                      <span style={{ color: statusColor }}>
                        <StatusIcon style={{ marginRight: 3 }} />{n.deliveryStatus}
                        {n.retryCount > 0 && <span style={{ marginLeft: 4 }}>(retries: {n.retryCount})</span>}
                      </span>
                      <span><FaClock /> {formatTime(n.createdAt)}</span>
                      {n.isEmergency && <span style={{ color: 'var(--danger)' }}><FaExclamationTriangle /> Emergency Alert</span>}
                      {!n.read && <span style={{ color: 'var(--info, #4285f4)', fontWeight: 600 }}>NEW</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};

export default Notifications;
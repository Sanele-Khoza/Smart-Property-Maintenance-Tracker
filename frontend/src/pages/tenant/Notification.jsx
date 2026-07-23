import React, { useState } from 'react';
import { FaBell, FaEnvelope, FaMobileAlt, FaDesktop, FaCheckCircle, FaExclamationTriangle, FaClock, FaTimesCircle, FaFilter } from 'react-icons/fa';
import { getSession } from '../../data/authStore';
import { getNotifications } from '../../data/store';

const CHANNEL_ICONS = { email: <FaEnvelope />, push: <FaMobileAlt />, sms: <FaDesktop /> };
const STATUS_CONFIG = {
  Sent: { color: 'var(--teal)', icon: FaCheckCircle },
  Delivered: { color: 'var(--teal)', icon: FaCheckCircle },
  Pending: { color: 'var(--amber)', icon: FaClock },
  Failed: { color: 'var(--danger)', icon: FaTimesCircle },
};

const Notification = () => {
  const session = getSession();
  const tenantEmail = session ? session.email : '';
  const tenantName = session ? `${session.name} ${session.surname}` : '';
  const [allNotifs] = useState(getNotifications());
  const [filter, setFilter] = useState('all');

  const myNotifs = allNotifs.filter(n => {
    const matchesRecipient = n.recipient === tenantEmail || n.recipient === tenantName || n.recipient === session?.id;
    if (filter === 'all') return matchesRecipient;
    if (filter === 'unread') return matchesRecipient && n.deliveryStatus === 'Pending';
    if (filter === 'sent') return matchesRecipient && n.deliveryStatus === 'Sent';
    if (filter === 'delivered') return matchesRecipient && n.deliveryStatus === 'Delivered';
    if (filter === 'failed') return matchesRecipient && n.deliveryStatus === 'Failed';
    return matchesRecipient;
  });

  const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'unread', label: 'Pending' },
    { key: 'sent', label: 'Sent' },
    { key: 'delivered', label: 'Delivered' },
    { key: 'failed', label: 'Failed' },
  ];

  const formatTime = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString();
  };

  return (
    <>
      <div className="welcome-banner"><h2><FaBell /> Notifications</h2><p>Updates on your maintenance requests. <span className="req-ref">MOD-008 / REQ-018 / REQ-043 / REQ-045</span></p></div>
      <div className="card">
        <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span><FaBell /> Your Notifications ({myNotifs.length})</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {FILTERS.map(f => (
              <button key={f.key} className={`btn btn-sm ${filter === f.key ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter(f.key)}>{f.label}</button>
            ))}
          </div>
        </div>
        {myNotifs.length === 0 ? (
          <div className="empty-state"><div className="empty-text">No notifications to display.</div></div>
        ) : (
          <div style={{ maxHeight: 500, overflow: 'auto' }}>
            {myNotifs.map(n => {
              const StatusIcon = STATUS_CONFIG[n.deliveryStatus]?.icon || FaClock;
              const statusColor = STATUS_CONFIG[n.deliveryStatus]?.color || 'var(--text-dim)';
              return (
                <div key={n.id} style={{
                  padding: '12px', borderBottom: '1px solid var(--border)',
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                  background: n.deliveryStatus === 'Pending' ? 'rgba(243,156,18,0.04)' : 'transparent',
                }}>
                  <div style={{ fontSize: 16, color: statusColor, marginTop: 2 }}>
                    {CHANNEL_ICONS[n.type] || <FaBell />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13 }}>{n.message}</div>
                    <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 11, color: 'var(--text-dim)' }}>
                      <span style={{ color: statusColor }}>
                        <StatusIcon style={{ marginRight: 3 }} />{n.deliveryStatus}
                        {n.retryCount > 0 && <span style={{ marginLeft: 4 }}>(retries: {n.retryCount})</span>}
                      </span>
                      <span><FaClock /> {formatTime(n.createdAt)}</span>
                      {n.isEmergency && <span style={{ color: 'var(--danger)' }}><FaExclamationTriangle /> Emergency</span>}
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

export default Notification;
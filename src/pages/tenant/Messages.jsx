import React, { useState } from 'react';
import { FaBell, FaEnvelope, FaMobileAlt, FaDesktop, FaCheckCircle, FaExclamationTriangle, FaClock, FaTimesCircle } from 'react-icons/fa';
import { getSession } from '../../data/authStore';
import { getNotifications } from '../../data/store';

const CHANNEL_ICONS = { email: <FaEnvelope />, push: <FaMobileAlt />, sms: <FaDesktop /> };
const STATUS_CONFIG = {
  Sent: { color: 'var(--teal)', icon: FaCheckCircle },
  Delivered: { color: 'var(--teal)', icon: FaCheckCircle },
  Pending: { color: 'var(--amber)', icon: FaClock },
  Failed: { color: 'var(--danger)', icon: FaTimesCircle },
};

const Messages = () => {
  const session = getSession();
  const tenantEmail = session ? session.email : '';
  const [allNotifs] = useState(getNotifications());

  const myNotifs = allNotifs.filter(n => n.recipient === tenantEmail);

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
      <div className="welcome-banner"><h2><FaBell /> Messages</h2><p>Notification history for your account. <span className="req-ref">SRS §1.4</span></p></div>
      <div className="card">
        <div className="card-title"><FaBell /> Messages ({myNotifs.length})</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)', marginBottom: 8 }}>Showing notifications for {session?.email}</div>
        {myNotifs.length === 0 ? (
          <div className="empty-state"><div className="empty-text">No messages.</div></div>
        ) : (
          <div style={{ maxHeight: 500, overflow: 'auto' }}>
            {myNotifs.map(n => {
              const StatusIcon = STATUS_CONFIG[n.deliveryStatus]?.icon || FaClock;
              const statusColor = STATUS_CONFIG[n.deliveryStatus]?.color || 'var(--text-dim)';
              return (
                <div key={n.id} style={{
                  padding: '12px', borderBottom: '1px solid var(--border)',
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                }}>
                  <div style={{ fontSize: 16, color: statusColor, marginTop: 2 }}>
                    {CHANNEL_ICONS[n.type] || <FaBell />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13 }}>{n.message}</div>
                    <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 11, color: 'var(--text-dim)' }}>
                      <span style={{ color: statusColor }}><StatusIcon style={{ marginRight: 3 }} />{n.deliveryStatus}</span>
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

export default Messages;
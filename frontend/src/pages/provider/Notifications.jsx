import React, { useState, useEffect } from 'react';
import { FaBell, FaEnvelope, FaMobileAlt, FaDesktop, FaCheckCircle, FaExclamationTriangle, FaClock, FaTimesCircle, FaBolt, FaCheckDouble, FaCheck, FaTimes } from 'react-icons/fa';
import { getSession } from '../../data/authStore';
import {
  getNotifications, markNotificationRead, markAllNotificationsRead, refreshNotifications,
  acceptJob, declineJob, getTickets, refreshTickets,
} from '../../data/store';

const CHANNEL_ICONS = { email: <FaEnvelope />, push: <FaMobileAlt />, sms: <FaDesktop /> };
const STATUS_CONFIG = {
  Sent: { color: 'var(--teal)', icon: FaCheckCircle },
  Delivered: { color: 'var(--teal)', icon: FaCheckCircle },
  Pending: { color: 'var(--amber)', icon: FaClock },
  Failed: { color: 'var(--danger)', icon: FaTimesCircle },
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'sent', label: 'Sent' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'failed', label: 'Failed' },
];

const Notifications = () => {
  const session = getSession();
  const providerName = session ? `${session.name} ${session.surname}` : '';
  const [allNotifs, setAllNotifs] = useState(getNotifications());
  const [tickets, setTickets] = useState(getTickets());
  const [filter, setFilter] = useState('all');
  // Per-notification result, e.g. { [notifId]: 'Accepted' | 'Declined' | 'error text' }
  const [actionResult, setActionResult] = useState({});
  const [busyId, setBusyId] = useState(null);
  // Same inline-decline-panel pattern as MyJobs.jsx / JobDetail.jsx, keyed
  // by notification id rather than ticket id.
  const [declineFor, setDeclineFor] = useState(null);
  const [declineReason, setDeclineReason] = useState('');

  // The server already scopes GET /notifications to the logged-in user
  // (WHERE user_id = req.user.id), so no client-side recipient filtering
  // is needed -- every row here already belongs to this provider.
  const refresh = () => Promise.all([
    refreshNotifications().then(() => setAllNotifs(getNotifications())),
    refreshTickets().then(() => setTickets(getTickets())),
  ]);

  useEffect(() => {
    refresh();
  }, []);

  // A short, honest reason the buttons on this notification are gone --
  // derived from the ticket's real current status (server-scoped to this
  // provider's own tickets), not from local page state. This is what
  // survives navigating away and back or a refresh, instead of stale
  // buttons reappearing and failing with a raw backend error like
  // "Cannot transition from 'Accepted' to 'Accepted'".
  const respondBlockedReason = (notif) => {
    if (!notif.ticketId) return null;
    const ticket = tickets.find(t => t.ticketId === notif.ticketId);
    if (!ticket) return 'This job is no longer assigned to you.';
    if (ticket.status !== 'Assigned') return `Already responded to — current status: ${ticket.status}.`;
    return null;
  };

  const friendlyError = (raw) => {
    if (!raw) return 'Something went wrong.';
    if (raw.includes('Access denied')) return 'This job is no longer assigned to you.';
    if (raw.includes('Cannot transition')) return 'This job has already been responded to.';
    return raw;
  };

  const handleMarkRead = async (id) => {
    await markNotificationRead(id);
    refresh();
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    refresh();
  };

  const handleAccept = async (notif) => {
    setBusyId(notif.id);
    const r = await acceptJob(notif.ticketId);
    setBusyId(null);
    setActionResult(prev => ({ ...prev, [notif.id]: r.success ? 'Accepted' : friendlyError(r.error) }));
    if (r.success) handleMarkRead(notif.id); else refresh();
  };

  const openDecline = (notifId) => {
    setDeclineFor(notifId);
    setDeclineReason('');
  };

  const runDecline = async (notif) => {
    setBusyId(notif.id);
    const r = await declineJob(notif.ticketId, declineReason.trim() || undefined);
    setBusyId(null);
    if (r.success) {
      setDeclineFor(null);
      setDeclineReason('');
      setActionResult(prev => ({ ...prev, [notif.id]: 'Declined' }));
      handleMarkRead(notif.id);
    } else {
      setActionResult(prev => ({ ...prev, [notif.id]: friendlyError(r.error) }));
      refresh();
    }
  };

  const filtered = allNotifs.filter(n => {
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
    total: allNotifs.length,
    unread: allNotifs.filter(n => !n.read).length,
    emergency: allNotifs.filter(n => n.isEmergency).length,
  };

  return (
    <>
      <div className="welcome-banner"><h2><FaBell /> Notifications</h2><p>Job assignments, emergency alerts, and system messages, {providerName}. <span className="req-ref">MOD-008 / REQ-043 / NFR-P03</span></p></div>
      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <div className="stat-card"><div className="stat-value">{stats.total}</div><div className="stat-label">Total</div></div>
        <div className="stat-card"><div className="stat-value" style={{ color: stats.unread > 0 ? 'var(--amber)' : undefined }}>{stats.unread}</div><div className="stat-label">Unread</div></div>
        <div className="stat-card"><div className="stat-value" style={{ color: stats.emergency > 0 ? 'var(--danger)' : undefined }}>{stats.emergency}</div><div className="stat-label"><FaBolt /> Emergency</div></div>
      </div>

      <div className="card">
        <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <span><FaBell /> Notification History ({filtered.length})</span>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {FILTERS.map(f => (
              <button key={f.key} className={`btn btn-sm ${filter === f.key ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter(f.key)}>{f.label}</button>
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
          <div style={{ maxHeight: 560, overflow: 'auto' }}>
            {filtered.map(n => {
              const StatusIcon = STATUS_CONFIG[n.deliveryStatus]?.icon || FaClock;
              const statusColor = STATUS_CONFIG[n.deliveryStatus]?.color || 'var(--text-dim)';
              // Only "assignment" notifications tied to a real ticket can be
              // acted on here; older notifications from before ticket_id
              // existed won't have one, so we fall back gracefully.
              const blockedReason = respondBlockedReason(n);
              const canRespond = n.type === 'assignment' && n.ticketId && !actionResult[n.id] && !blockedReason;
              const result = actionResult[n.id] || blockedReason;
              const busy = busyId === n.id;
              return (
                <div key={n.id} style={{
                  padding: '12px', borderBottom: '1px solid var(--border)',
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                  background: n.isEmergency ? 'rgba(192,57,43,0.04)' :
                    !n.read ? 'rgba(66,133,244,0.05)' :
                    n.deliveryStatus === 'Pending' ? 'rgba(243,156,18,0.04)' : 'transparent',
                  borderLeft: n.isEmergency ? '3px solid var(--danger)' : !n.read ? '3px solid var(--info, #4285f4)' : '3px solid transparent',
                }}>
                  <div style={{ fontSize: 16, color: statusColor, marginTop: 2 }}>
                    {n.isEmergency ? <FaBolt style={{ color: 'var(--danger)' }} /> : (CHANNEL_ICONS[n.type] || <FaBell />)}
                  </div>
                  <div onClick={() => !n.read && handleMarkRead(n.id)} style={{ flex: 1, cursor: n.read ? 'default' : 'pointer' }}>
                    {n.title && <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{n.title}</div>}
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

                    {canRespond && declineFor !== n.id && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }} onClick={e => e.stopPropagation()}>
                        <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => handleAccept(n)}>
                          <FaCheck style={{ marginRight: 4 }} /> {busy ? 'Accepting...' : 'Accept'}
                        </button>
                        <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => openDecline(n.id)}>
                          <FaTimes style={{ marginRight: 4 }} /> Decline
                        </button>
                      </div>
                    )}

                    {/* Same decline form as My Jobs / Job Detail: an inline
                        warning panel with a reason textarea. */}
                    {declineFor === n.id && (
                      <div
                        onClick={e => e.stopPropagation()}
                        style={{ marginTop: 8, padding: 10, border: '1px solid rgba(240,180,50,0.35)', borderRadius: 6, background: 'rgba(240,180,50,0.06)' }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
                          <FaExclamationTriangle style={{ color: 'var(--amber)', marginRight: 4 }} />Decline this job?
                        </div>
                        <div className="form-group">
                          <label className="form-label">Reason for the tenant / manager (optional)</label>
                          <textarea
                            className="form-textarea"
                            style={{ minHeight: 50 }}
                            placeholder="e.g. Waiting for parts — available to reschedule next week."
                            value={declineReason}
                            onChange={e => setDeclineReason(e.target.value)}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => runDecline(n)}>
                            {busy ? 'Declining...' : 'Confirm Decline'}
                          </button>
                          <button className="btn btn-secondary btn-sm" onClick={() => setDeclineFor(null)}>Cancel</button>
                        </div>
                      </div>
                    )}

                    {result && (
                      <div style={{
                        marginTop: 6, fontSize: 12,
                        color: result === 'Accepted' ? 'var(--teal)' : result === 'Declined' ? 'var(--text-dim)' : 'var(--danger)',
                      }}>
                        {result === 'Accepted' && <><FaCheckCircle style={{ marginRight: 4 }} />Job accepted.</>}
                        {result === 'Declined' && <><FaTimes style={{ marginRight: 4 }} />Job declined.</>}
                        {result !== 'Accepted' && result !== 'Declined' && <><FaTimesCircle style={{ marginRight: 4 }} />{result}</>}
                      </div>
                    )}
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

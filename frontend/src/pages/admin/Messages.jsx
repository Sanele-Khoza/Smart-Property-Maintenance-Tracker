import React, { useState, useEffect } from 'react';
import { FaEnvelope, FaMobileAlt, FaBell, FaExclamationTriangle, FaShieldAlt, FaClock, FaUserCheck, FaTag, FaBrain, FaBullhorn, FaPaperPlane, FaSearch } from 'react-icons/fa';
import { getUsers, refreshUsers } from '../../data/authStore';
import { sendBroadcastMessage } from '../../data/messagesStore';

const TEMPLATES = [
  {
    id: 'NT-001', eventType: 'SLA_BREACH', label: 'SLA Breach Escalation',
    message: 'SLA breach: {ticketId} ({title}) escalated — no {action} within {threshold} min',
    defaultRecipient: 'admin', type: 'email', priority: 'EMERGENCY', ttl: 0, retryMax: 3,
    icon: FaClock, iconColor: 'var(--danger)',
  },
  {
    id: 'NT-002', eventType: 'MANUAL_REVIEW_REQUIRED', label: 'AI Conflict — Manual Review',
    message: 'Manual review required: {ticketId} ({title}) — AI conflict detected ({details})',
    defaultRecipient: 'admin', type: 'push', priority: 'HIGH', ttl: 300, retryMax: 2,
    icon: FaBrain, iconColor: 'var(--amber)',
  },
  {
    id: 'NT-003', eventType: 'TICKET_ASSIGNED', label: 'New Ticket Assignment',
    message: 'New assignment: {ticketId} ({title}) — {priority} priority at {property}',
    defaultRecipient: '{assignedTo}', type: 'push', priority: 'NORMAL', ttl: 600, retryMax: 2,
    icon: FaUserCheck, iconColor: 'var(--teal)',
  },
  {
    id: 'NT-004', eventType: 'PROPERTY_NEW_TICKET', label: 'New Ticket on Property',
    message: 'New ticket {ticketId} assigned to your property',
    defaultRecipient: '{propertyManager}', type: 'email', priority: 'NORMAL', ttl: 900, retryMax: 1,
    icon: FaBell, iconColor: 'var(--info)',
  },
  {
    id: 'NT-005', eventType: 'EMERGENCY_DELIVERY_FAILED', label: 'Emergency Notification Failure',
    message: 'EMERGENCY: {ticketId} delivery failed — immediate attention required',
    defaultRecipient: 'admin', type: 'email', priority: 'EMERGENCY', ttl: 0, retryMax: 3,
    icon: FaExclamationTriangle, iconColor: 'var(--danger)',
  },
  {
    id: 'NT-006', eventType: 'TICKET_STATUS_CHANGE', label: 'Status Change Notification',
    message: 'Ticket {ticketId} ({title}) status changed from {oldStatus} to {newStatus}',
    defaultRecipient: '{assignee}', type: 'push', priority: 'NORMAL', ttl: 600, retryMax: 1,
    icon: FaBell, iconColor: 'var(--info)',
  },
  {
    id: 'NT-007', eventType: 'CATEGORY_OVERRIDE', label: 'Category Override (BR-006)',
    message: 'PM override: {ticketId} ai_original={aiCategory} → category={newCategory}',
    defaultRecipient: 'admin', type: 'email', priority: 'LOW', ttl: 3600, retryMax: 1,
    icon: FaTag, iconColor: 'var(--amber)',
  },
  {
    id: 'NT-008', eventType: 'PROVIDER_RATING_ALERT', label: 'Provider Rating Alert',
    message: 'Provider {providerName} rating dropped to {rating} — below threshold ({threshold})',
    defaultRecipient: 'admin', type: 'email', priority: 'HIGH', ttl: 600, retryMax: 2,
    icon: FaShieldAlt, iconColor: 'var(--amber)',
  },
];

const TYPE_CONFIG = {
  email: { icon: FaEnvelope, label: 'Email' },
  push: { icon: FaMobileAlt, label: 'Push' },
};

const Messages = () => {
  const [users, setUsers] = useState(() => getUsers());
  const [recipientMode, setRecipientMode] = useState('specific');
  const [selectedIds, setSelectedIds] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    refreshUsers().then(() => setUsers([...getUsers()]));
    const onUsersUpdated = () => setUsers([...getUsers()]);
    window.addEventListener('spmt:users-updated', onUsersUpdated);
    return () => window.removeEventListener('spmt:users-updated', onUsersUpdated);
  }, []);

  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 5000);
    return () => clearTimeout(t);
  }, [feedback]);

  const toggleUser = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const visibleUsers = users.filter(u =>
    !userSearch ||
    `${u.name} ${u.surname}`.toLowerCase().includes(userSearch.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(userSearch.toLowerCase()) ||
    (u.role || '').toLowerCase().includes(userSearch.toLowerCase())
  );

  const handleSend = async (e) => {
    e.preventDefault();
    if (recipientMode === 'specific' && selectedIds.length === 0) {
      setFeedback({ type: 'error', text: 'Select at least one user.' });
      return;
    }
    setSending(true);
    const result = await sendBroadcastMessage({
      receiverIds: recipientMode === 'specific' ? selectedIds : undefined,
      broadcastAll: recipientMode === 'all' ? true : undefined,
      subject: subject.trim(),
      body: body.trim(),
    });
    setSending(false);
    if (result.success) {
      setFeedback({ type: 'success', text: result.message || 'Announcement sent.' });
      setSelectedIds([]);
      setSubject('');
      setBody('');
    } else {
      setFeedback({ type: 'error', text: result.error });
    }
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-title">
          <span><FaBullhorn /> Send Announcement</span>
        </div>
        <div style={{ padding: '0 0 12px', fontSize: 11, color: 'var(--text-dim)', borderBottom: '1px solid var(--border)', marginBottom: 12 }}>
          Recipients see the message as a popup the next time they log in. Choose specific users or everyone.
        </div>
        {feedback && (
          <div className="card" style={{
            padding: '8px 14px', marginBottom: 8, fontSize: 12,
            backgroundColor: feedback.type === 'success' ? 'rgba(45,183,145,0.08)' : 'rgba(192,57,43,0.08)',
            borderColor: feedback.type === 'success' ? 'rgba(45,183,145,0.3)' : 'rgba(192,57,43,0.3)',
          }}>
            {feedback.text}
          </div>
        )}
        <form onSubmit={handleSend}>
          <div style={{ display: 'flex', gap: 16, marginBottom: 10, fontSize: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="radio" checked={recipientMode === 'specific'} onChange={() => setRecipientMode('specific')} />
              Specific user(s)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="radio" checked={recipientMode === 'all'} onChange={() => setRecipientMode('all')} />
              All users ({users.length})
            </label>
          </div>
          {recipientMode === 'specific' && (
            <>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <FaSearch style={{ color: 'var(--text-dim)', fontSize: 12 }} />
                <input className="form-input" style={{ flex: 1, fontSize: 12, padding: '6px 10px' }} placeholder="Search users by name, email, or role..." value={userSearch} onChange={e => setUserSearch(e.target.value)} />
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{selectedIds.length} selected</span>
              </div>
              <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 4, marginBottom: 10 }}>
                {visibleUsers.length === 0 && (
                  <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: 'var(--text-dim)' }}>No users found.</div>
                )}
                {visibleUsers.map(u => (
                  <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', fontSize: 12, borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={selectedIds.includes(u.id)} onChange={() => toggleUser(u.id)} />
                    <span style={{ fontWeight: 600 }}>{u.name} {u.surname}</span>
                    <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>{u.email}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-dim)' }}>{(u.role || '').replace(/_/g, ' ')}</span>
                  </label>
                ))}
              </div>
            </>
          )}
          <div className="form-group">
            <label className="form-label">Subject</label>
            <input className="form-input" value={subject} onChange={e => setSubject(e.target.value)} required maxLength={300} placeholder="e.g. Scheduled maintenance this weekend" />
          </div>
          <div className="form-group">
            <label className="form-label">Message</label>
            <textarea className="form-input" value={body} onChange={e => setBody(e.target.value)} required rows={4} placeholder="Write the announcement recipients will see on login..." style={{ resize: 'vertical' }} />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-teal" disabled={sending}>
              <FaPaperPlane /> {sending ? 'Sending...' : (recipientMode === 'all' ? `Send to all users` : `Send to ${selectedIds.length} user(s)`)}
            </button>
          </div>
        </form>
      </div>
      <div className="card">
        <div className="card-title">
          <span><FaBell /> Notification Templates <span className="req-ref">SRS §1.4 — In-app chat explicitly excluded; page repurposed as template reference</span></span>
        </div>
        <div style={{ padding: '0 0 12px', fontSize: 11, color: 'var(--text-dim)', borderBottom: '1px solid var(--border)', marginBottom: 12 }}>
          System notification templates per event type. Messages use SNS/SES/SMS adapters configured at deployment (not editable at runtime).
        </div>
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Template</th>
                <th>Event Type</th>
                <th>Message Template</th>
                <th>Default Recipient</th>
                <th>Channel</th>
                <th>Priority</th>
                <th>TTL (s)</th>
                <th>Max Retry</th>
              </tr>
            </thead>
            <tbody>
              {TEMPLATES.map(t => {
                const Icon = t.icon;
                const TypeIcon = TYPE_CONFIG[t.type]?.icon || FaEnvelope;
                return (
                  <tr key={t.id}>
                    <td className="cell-mono" style={{ fontSize: 10 }}>{t.id}</td>
                    <td>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Icon style={{ color: t.iconColor, fontSize: 11 }} />
                        <strong style={{ fontSize: 11 }}>{t.label}</strong>
                      </span>
                      <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 1 }}>{t.eventType}</div>
                    </td>
                    <td style={{ fontSize: 10, maxWidth: 280, fontFamily: 'monospace', color: 'var(--text-dim)', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                      {t.message}
                    </td>
                    <td style={{ fontSize: 11 }}>{t.defaultRecipient}</td>
                    <td>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11 }}>
                        <TypeIcon style={{ fontSize: 10, color: 'var(--text-dim)' }} /> {t.type}
                      </span>
                    </td>
                    <td>
                      {t.priority === 'EMERGENCY' ? (
                        <span className="badge badge-danger" style={{ fontSize: 8 }}>EMERGENCY</span>
                      ) : t.priority === 'HIGH' ? (
                        <span className="badge badge-warning" style={{ fontSize: 8 }}>HIGH</span>
                      ) : t.priority === 'LOW' ? (
                        <span className="badge badge-completed" style={{ fontSize: 8 }}>LOW</span>
                      ) : (
                        <span className="badge badge-info" style={{ fontSize: 8 }}>NORMAL</span>
                      )}
                    </td>
                    <td className="cell-mono" style={{ fontSize: 11 }}>
                      {t.ttl === 0 ? <span style={{ color: 'var(--danger)', fontWeight: 600 }}>0</span> : t.ttl}
                    </td>
                    <td className="cell-mono" style={{ fontSize: 11 }}>{t.retryMax}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Messages;

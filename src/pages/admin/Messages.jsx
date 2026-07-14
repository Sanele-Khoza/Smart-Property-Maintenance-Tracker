import React from 'react';
import { FaEnvelope, FaMobileAlt, FaBell, FaExclamationTriangle, FaShieldAlt, FaClock, FaUserCheck, FaTag, FaBrain } from 'react-icons/fa';

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
  return (
    <div>
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

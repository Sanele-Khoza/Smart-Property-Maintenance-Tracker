import React, { useState, useMemo } from 'react';
import { FaHistory, FaClipboardList, FaShieldAlt, FaBrain, FaExclamationTriangle, FaCheckCircle, FaTimesCircle, FaUserLock, FaUserCheck, FaTag, FaArrowRight, FaClock, FaCamera, FaFileAlt } from 'react-icons/fa';
import { getAuditLogs, getSecurityAuditLogs, getInferenceLogs } from '../../data/store';

const SOURCE_TYPES = [
  { key: 'all', label: 'All Events', icon: FaHistory },
  { key: 'audit', label: 'Audit Log', icon: FaClipboardList },
  { key: 'security', label: 'Security Log', icon: FaShieldAlt },
  { key: 'inference', label: 'AI Inferences', icon: FaBrain },
];

const ACTIVITY_COLORS = {
  audit: { badge: '#3278dc', bg: 'rgba(50, 120, 220, 0.08)', iconColor: '#3278dc' },
  security: { badge: '#dc3c3c', bg: 'rgba(220, 60, 60, 0.08)', iconColor: '#dc3c3c' },
  inference: { badge: '#2db791', bg: 'rgba(45, 183, 145, 0.08)', iconColor: '#2db791' },
};

const AUDIT_ACTION_ICONS = {
  STATUS_CHANGE: FaArrowRight,
  CONFLICT_DETECTED: FaExclamationTriangle,
  CATEGORY_OVERRIDE: FaTag,
  REOPENED: FaClock,
  ESCALATED: FaExclamationTriangle,
  CREATED: FaCheckCircle,
  ASSIGNED: FaUserCheck,
  REASSIGNED: FaUserCheck,
};

const SECURITY_EVENT_ICONS = {
  LOGIN_SUCCESS: FaUserCheck,
  LOGIN_FAIL: FaTimesCircle,
  ACCOUNT_LOCKED: FaUserLock,
  ACCOUNT_UNLOCKED: FaUserLock,
  PASSWORD_RESET: FaShieldAlt,
  LOGOUT: FaUserCheck,
};

const INFERENCE_ICONS = {
  text: FaFileAlt,
  image: FaCamera,
};

const formatAISummary = (log) => {
  const inputIcon = log.inputType === 'image' ? '🖼️' : '📝';
  return `${log.adapter} (${inputIcon} ${log.inputType}): ${log.result} @ ${Math.round(log.confidence * 100)}% — ${log.latencyMs}ms${log.conflictDetected ? ' ⚔️ CONFLICT' : ''}`;
};

const Activity = () => {
  const [sourceFilter, setSourceFilter] = useState('all');

  const auditLogs = useMemo(() => getAuditLogs(), []);
  const securityLogs = useMemo(() => getSecurityAuditLogs(), []);
  const inferenceLogs = useMemo(() => getInferenceLogs(), []);

  const merged = useMemo(() => {
    const tagged = [];

    auditLogs.forEach(log => {
      tagged.push({ ...log, _source: 'audit', _ts: new Date(log.timestamp).getTime() });
    });
    securityLogs.forEach(log => {
      tagged.push({ ...log, _source: 'security', _ts: new Date(log.timestamp).getTime() });
    });
    inferenceLogs.forEach(log => {
      tagged.push({ ...log, _source: 'inference', _ts: new Date(log.timestamp).getTime() });
    });

    tagged.sort((a, b) => b._ts - a._ts);
    return tagged;
  }, [auditLogs, securityLogs, inferenceLogs]);

  const filtered = sourceFilter === 'all'
    ? merged
    : merged.filter(e => e._source === sourceFilter);

  const stats = [
    { label: 'Total Events', value: merged.length, icon: FaHistory },
    { label: 'Audit Log', value: auditLogs.length, icon: FaClipboardList },
    { label: 'Security Events', value: securityLogs.length, icon: FaShieldAlt },
    { label: 'AI Inferences', value: inferenceLogs.length, icon: FaBrain },
  ];

  const renderAuditSummary = (log) => {
    const icon = AUDIT_ACTION_ICONS[log.action] || FaClipboardList;
    const Icon = icon;
    const label = log.action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    let detail = log.comment || '';
    if (log.previousStatus && log.newStatus && log.previousStatus !== log.newStatus) {
      detail = `Status: ${log.previousStatus} → ${log.newStatus}` + (detail ? `. ${detail}` : '');
    }
    return (
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', width: '100%' }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: ACTIVITY_COLORS.audit.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon style={{ color: ACTIVITY_COLORS.audit.iconColor, fontSize: 12 }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 12 }}>{log.actor}</strong>
            <span className="badge badge-info" style={{ fontSize: 8, whiteSpace: 'nowrap' }}>{label}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{detail}</div>
        </div>
      </div>
    );
  };

  const renderSecuritySummary = (log) => {
    const icon = SECURITY_EVENT_ICONS[log.eventType] || FaShieldAlt;
    const Icon = icon;
    const label = log.eventType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const isFailure = ['LOGIN_FAIL', 'ACCOUNT_LOCKED'].includes(log.eventType);
    return (
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', width: '100%' }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: ACTIVITY_COLORS.security.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon style={{ color: isFailure ? 'var(--danger)' : 'var(--teal)', fontSize: 12 }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 12 }}>{log.username}</strong>
            <span className={`badge ${isFailure ? 'badge-danger' : 'badge-completed'}`} style={{ fontSize: 8, whiteSpace: 'nowrap' }}>{label}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
            IP: {log.ipAddress} — {log.userAgent}
          </div>
        </div>
      </div>
    );
  };

  const renderInferenceSummary = (log) => {
    const Icon = INFERENCE_ICONS[log.inputType] || FaBrain;
    const hasConflict = log.conflictDetected;
    return (
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', width: '100%' }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: ACTIVITY_COLORS.inference.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon style={{ color: ACTIVITY_COLORS.inference.iconColor, fontSize: 12 }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 12 }}>{log.adapter}</strong>
            <span className="badge" style={{ fontSize: 8, backgroundColor: ACTIVITY_COLORS.inference.bg, color: ACTIVITY_COLORS.inference.iconColor, border: '1px solid rgba(45,183,145,0.3)' }}>{log.inputType}</span>
            {hasConflict && <span className="badge badge-danger" style={{ fontSize: 8 }}>CONFLICT</span>}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
            Result: <strong style={{ color: 'var(--teal)' }}>{log.result}</strong> @ {Math.round(log.confidence * 100)}% — {log.latencyMs}ms
          </div>
        </div>
      </div>
    );
  };

  const renderEntry = (entry) => {
    const ts = new Date(entry.timestamp).toLocaleString();
    const colors = ACTIVITY_COLORS[entry._source] || ACTIVITY_COLORS.audit;
    return (
      <div key={`${entry._source}-${entry.id}`} style={{
        padding: '10px 14px', borderLeft: `3px solid ${colors.badge}`,
        backgroundColor: colors.bg, borderRadius: '0 6px 6px 0', marginBottom: 8,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {entry._source === 'audit' && renderAuditSummary(entry)}
            {entry._source === 'security' && renderSecuritySummary(entry)}
            {entry._source === 'inference' && renderInferenceSummary(entry)}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', whiteSpace: 'nowrap', flexShrink: 0, paddingTop: 2 }}>{ts}</div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="card">
        <div className="card-title">
          <span><FaHistory /> Activity Feed <span className="req-ref">MOD-004</span></span>
        </div>
        <div className="stat-grid">
          {stats.map((s, i) => (
            <div className="stat-card" key={i}>
              <div className="stat-value"><s.icon /> {s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <span><FaHistory /> Live Feed</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {SOURCE_TYPES.map(st => {
              const Icon = st.icon;
              const isActive = sourceFilter === st.key;
              return (
                <button
                  key={st.key}
                  onClick={() => setSourceFilter(st.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
                    fontSize: 11, fontWeight: isActive ? 600 : 400,
                    color: isActive ? 'var(--teal)' : 'var(--text-dim)',
                    backgroundColor: isActive ? 'rgba(45,183,145,0.1)' : 'transparent',
                    border: isActive ? '1px solid rgba(45,183,145,0.3)' : '1px solid transparent',
                    borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  <Icon /> {st.label}
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ maxHeight: 600, overflowY: 'auto', paddingRight: 4 }}>
          {filtered.length === 0 ? (
            <div className="empty-text" style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>
              No events match the current filter.
            </div>
          ) : (
            filtered.map(renderEntry)
          )}
        </div>
      </div>
    </div>
  );
};

export default Activity;

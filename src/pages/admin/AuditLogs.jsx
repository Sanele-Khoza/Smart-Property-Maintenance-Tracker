import React, { useState, useMemo } from 'react';
import { FaHistory, FaShieldAlt, FaSearch, FaFilter, FaUser, FaCalendarAlt, FaTimes, FaDownload, FaArrowRight } from 'react-icons/fa';
import { getAuditLogs, getSecurityAuditLogs } from '../../data/store';

const EVENT_STYLE = {
  LOGIN_SUCCESS: { className: 'badge badge-completed', label: 'LOGIN SUCCESS' },
  LOGIN_FAIL: { className: 'badge badge-danger', label: 'LOGIN FAIL' },
  ACCOUNT_LOCKED: { className: 'badge', label: 'ACCOUNT LOCKED', custom: 'var(--amber)' },
  ACCOUNT_UNLOCKED: { className: 'badge badge-info', label: 'ACCOUNT UNLOCKED' },
  PASSWORD_RESET: { className: 'badge', label: 'PASSWORD RESET', custom: 'var(--text-dim)' },
  LOGOUT: { className: 'badge', label: 'LOGOUT', custom: 'var(--text-dim)' },
};

const ACTION_OPTIONS = ['', 'STATUS_CHANGE', 'ASSIGNED', 'REOPENED', 'CATEGORY_OVERRIDE', 'CONFLICT_DETECTED', 'ESCALATED', 'CREATED'];
const EVENT_OPTIONS = ['', 'LOGIN_SUCCESS', 'LOGIN_FAIL', 'ACCOUNT_LOCKED', 'ACCOUNT_UNLOCKED', 'PASSWORD_RESET', 'LOGOUT'];

const ITEMS_PER_PAGE = 20;

const formatTimestamp = (ts) => {
  if (!ts) return '—';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  return d.toLocaleString();
};

const truncateUA = (ua, maxLen = 40) => {
  if (!ua) return '—';
  return ua.length > maxLen ? ua.substring(0, maxLen) + '…' : ua;
};

const AuditLogs = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [auditTicketSearch, setAuditTicketSearch] = useState('');
  const [auditActorSearch, setAuditActorSearch] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [auditStartDate, setAuditStartDate] = useState('');
  const [auditEndDate, setAuditEndDate] = useState('');
  const [secUsernameSearch, setSecUsernameSearch] = useState('');
  const [secEventFilter, setSecEventFilter] = useState('');
  const [secStartDate, setSecStartDate] = useState('');
  const [secEndDate, setSecEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const auditLogs = useMemo(() => getAuditLogs(), []);
  const securityLogs = useMemo(() => getSecurityAuditLogs(), []);

  const filteredAuditLogs = useMemo(() => {
    let result = [...auditLogs];
    if (auditTicketSearch) {
      result = result.filter(e => e.ticketId.toLowerCase().includes(auditTicketSearch.toLowerCase()));
    }
    if (auditActorSearch) {
      result = result.filter(e => e.actor.toLowerCase().includes(auditActorSearch.toLowerCase()));
    }
    if (auditActionFilter) {
      result = result.filter(e => e.action === auditActionFilter);
    }
    if (auditStartDate) {
      const s = new Date(auditStartDate).getTime();
      result = result.filter(e => new Date(e.timestamp).getTime() >= s);
    }
    if (auditEndDate) {
      const e = new Date(auditEndDate).getTime() + 86400000;
      result = result.filter(entry => new Date(entry.timestamp).getTime() <= e);
    }
    return result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [auditLogs, auditTicketSearch, auditActorSearch, auditActionFilter, auditStartDate, auditEndDate]);

  const filteredSecurityLogs = useMemo(() => {
    let result = [...securityLogs];
    if (secUsernameSearch) {
      result = result.filter(e => e.username.toLowerCase().includes(secUsernameSearch.toLowerCase()));
    }
    if (secEventFilter) {
      result = result.filter(e => e.eventType === secEventFilter);
    }
    if (secStartDate) {
      const s = new Date(secStartDate).getTime();
      result = result.filter(e => new Date(e.timestamp).getTime() >= s);
    }
    if (secEndDate) {
      const e = new Date(secEndDate).getTime() + 86400000;
      result = result.filter(entry => new Date(entry.timestamp).getTime() <= e);
    }
    return result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [securityLogs, secUsernameSearch, secEventFilter, secStartDate, secEndDate]);

  const totalAuditPages = Math.ceil(filteredAuditLogs.length / ITEMS_PER_PAGE);
  const totalSecPages = Math.ceil(filteredSecurityLogs.length / ITEMS_PER_PAGE);
  const activeTotalPages = activeTab === 0 ? totalAuditPages : totalSecPages;
  const paginatedData = useMemo(() => {
    const data = activeTab === 0 ? filteredAuditLogs : filteredSecurityLogs;
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return data.slice(start, start + ITEMS_PER_PAGE);
  }, [activeTab, filteredAuditLogs, filteredSecurityLogs, currentPage]);

  const resetFilters = () => {
    if (activeTab === 0) {
      setAuditTicketSearch('');
      setAuditActorSearch('');
      setAuditActionFilter('');
      setAuditStartDate('');
      setAuditEndDate('');
    } else {
      setSecUsernameSearch('');
      setSecEventFilter('');
      setSecStartDate('');
      setSecEndDate('');
    }
    setCurrentPage(1);
  };

  const hasActiveFilters = activeTab === 0
    ? (auditTicketSearch || auditActorSearch || auditActionFilter || auditStartDate || auditEndDate)
    : (secUsernameSearch || secEventFilter || secStartDate || secEndDate);

  const renderTabs = () => (
    <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--border)', marginBottom: 16 }}>
      <button
        onClick={() => { setActiveTab(0); setCurrentPage(1); }}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '10px 16px', fontSize: 12, fontWeight: activeTab === 0 ? 600 : 400,
          color: activeTab === 0 ? 'var(--teal)' : 'var(--text-dim)',
          border: 'none', borderBottom: activeTab === 0 ? '2px solid var(--teal)' : '2px solid transparent',
          backgroundColor: 'transparent', cursor: 'pointer', marginBottom: -2,
          transition: 'color 0.15s, border-color 0.15s',
        }}
      >
        <FaHistory /> Audit Log
      </button>
      <button
        onClick={() => { setActiveTab(1); setCurrentPage(1); }}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '10px 16px', fontSize: 12, fontWeight: activeTab === 1 ? 600 : 400,
          color: activeTab === 1 ? 'var(--teal)' : 'var(--text-dim)',
          border: 'none', borderBottom: activeTab === 1 ? '2px solid var(--teal)' : '2px solid transparent',
          backgroundColor: 'transparent', cursor: 'pointer', marginBottom: -2,
          transition: 'color 0.15s, border-color 0.15s',
        }}
      >
        <FaShieldAlt /> Security Audit Log
      </button>
    </div>
  );

  const renderAuditFilters = () => (
    <div style={{ display: 'flex', gap: 8, padding: '12px 0', flexWrap: 'wrap', alignItems: 'end', borderBottom: '1px solid var(--border)', marginBottom: 12 }}>
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label" style={{ fontSize: 10 }}><FaSearch size={10} /> Ticket ID</label>
        <input
          className="form-input" type="text" placeholder="Search ticket…"
          style={{ width: 'auto', minWidth: 100, fontSize: 11, padding: '4px 6px' }}
          value={auditTicketSearch} onChange={e => { setAuditTicketSearch(e.target.value); setCurrentPage(1); }}
        />
      </div>
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label" style={{ fontSize: 10 }}><FaUser size={10} /> Actor</label>
        <input
          className="form-input" type="text" placeholder="Search actor…"
          style={{ width: 'auto', minWidth: 100, fontSize: 11, padding: '4px 6px' }}
          value={auditActorSearch} onChange={e => { setAuditActorSearch(e.target.value); setCurrentPage(1); }}
        />
      </div>
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label" style={{ fontSize: 10 }}><FaFilter size={10} /> Action</label>
        <select className="form-select" style={{ width: 'auto', minWidth: 120, fontSize: 11 }} value={auditActionFilter} onChange={e => { setAuditActionFilter(e.target.value); setCurrentPage(1); }}>
          <option value="">All Actions</option>
          {ACTION_OPTIONS.filter(Boolean).map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
        </select>
      </div>
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label" style={{ fontSize: 10 }}><FaCalendarAlt size={10} /> Start</label>
        <input type="date" className="form-input" style={{ width: 'auto', fontSize: 11, padding: '4px 6px' }} value={auditStartDate} onChange={e => { setAuditStartDate(e.target.value); setCurrentPage(1); }} />
      </div>
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label" style={{ fontSize: 10 }}><FaCalendarAlt size={10} /> End</label>
        <input type="date" className="form-input" style={{ width: 'auto', fontSize: 11, padding: '4px 6px' }} value={auditEndDate} onChange={e => { setAuditEndDate(e.target.value); setCurrentPage(1); }} />
      </div>
      {hasActiveFilters && (
        <button className="btn btn-secondary btn-sm" onClick={resetFilters}><FaTimes /> Clear</button>
      )}
    </div>
  );

  const renderSecFilters = () => (
    <div style={{ display: 'flex', gap: 8, padding: '12px 0', flexWrap: 'wrap', alignItems: 'end', borderBottom: '1px solid var(--border)', marginBottom: 12 }}>
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label" style={{ fontSize: 10 }}><FaUser size={10} /> Username</label>
        <input
          className="form-input" type="text" placeholder="Search username…"
          style={{ width: 'auto', minWidth: 120, fontSize: 11, padding: '4px 6px' }}
          value={secUsernameSearch} onChange={e => { setSecUsernameSearch(e.target.value); setCurrentPage(1); }}
        />
      </div>
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label" style={{ fontSize: 10 }}><FaFilter size={10} /> Event Type</label>
        <select className="form-select" style={{ width: 'auto', minWidth: 140, fontSize: 11 }} value={secEventFilter} onChange={e => { setSecEventFilter(e.target.value); setCurrentPage(1); }}>
          <option value="">All Events</option>
          {EVENT_OPTIONS.filter(Boolean).map(e => <option key={e} value={e}>{e.replace(/_/g, ' ')}</option>)}
        </select>
      </div>
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label" style={{ fontSize: 10 }}><FaCalendarAlt size={10} /> Start</label>
        <input type="date" className="form-input" style={{ width: 'auto', fontSize: 11, padding: '4px 6px' }} value={secStartDate} onChange={e => { setSecStartDate(e.target.value); setCurrentPage(1); }} />
      </div>
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label" style={{ fontSize: 10 }}><FaCalendarAlt size={10} /> End</label>
        <input type="date" className="form-input" style={{ width: 'auto', fontSize: 11, padding: '4px 6px' }} value={secEndDate} onChange={e => { setSecEndDate(e.target.value); setCurrentPage(1); }} />
      </div>
      {hasActiveFilters && (
        <button className="btn btn-secondary btn-sm" onClick={resetFilters}><FaTimes /> Clear</button>
      )}
    </div>
  );

  const renderPagination = (total, filteredCount) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', fontSize: 11, color: 'var(--text-dim)' }}>
      <span>
        <strong>{filteredCount}</strong> {filteredCount === 1 ? 'entry' : 'entries'} found
        {filteredCount !== total && ` (filtered from ${total} total)`}
      </span>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <button
          className="btn btn-secondary btn-sm"
          disabled={currentPage <= 1}
          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          style={{ opacity: currentPage <= 1 ? 0.4 : 1 }}
          aria-label="Previous page"
        >
          Prev
        </button>
        <span style={{ margin: '0 8px' }}>
          Page {currentPage} of {Math.max(activeTotalPages, 1)}
        </span>
        <button
          className="btn btn-secondary btn-sm"
          disabled={currentPage >= activeTotalPages}
          onClick={() => setCurrentPage(p => Math.min(activeTotalPages, p + 1))}
          style={{ opacity: currentPage >= activeTotalPages ? 0.4 : 1 }}
          aria-label="Next page"
        >
          Next
        </button>
      </div>
    </div>
  );

  const renderAuditTable = () => {
    const data = paginatedData;
    return (
      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">ID</th>
              <th scope="col">Ticket ID</th>
              <th scope="col">Actor</th>
              <th scope="col">Action</th>
              <th scope="col">Previous → New Status</th>
              <th scope="col">Comment</th>
              <th scope="col">Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr><td colSpan="7" className="empty-text" style={{ textAlign: 'center', padding: 24 }}>
                <FaHistory style={{ marginRight: 6 }} />No audit log entries found.
              </td></tr>
            ) : (
              data.map(entry => (
                <tr key={entry.id}>
                  <td className="cell-mono" style={{ fontSize: 10 }}>{entry.id}</td>
                  <td className="cell-mono">{entry.ticketId || '—'}</td>
                  <td>{entry.actor}</td>
                  <td><span className="badge badge-info" style={{ fontSize: 10 }}>{entry.action.replace(/_/g, ' ')}</span></td>
                  <td style={{ fontSize: 12 }}>
                    {entry.previousStatus || '—'}
                    <FaArrowRight style={{ margin: '0 6px', fontSize: 10, color: 'var(--text-dim)' }} />
                    {entry.newStatus || '—'}
                  </td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11 }} title={entry.comment}>
                    {entry.comment || '—'}
                  </td>
                  <td className="cell-mono" style={{ fontSize: 10 }}>{formatTimestamp(entry.timestamp)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  };

  const renderSecTable = () => {
    const data = paginatedData;
    return (
      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">ID</th>
              <th scope="col">Username</th>
              <th scope="col">Event Type</th>
              <th scope="col">IP Address</th>
              <th scope="col">User Agent</th>
              <th scope="col">Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr><td colSpan="6" className="empty-text" style={{ textAlign: 'center', padding: 24 }}>
                <FaShieldAlt style={{ marginRight: 6 }} />No security audit log entries found.
              </td></tr>
            ) : (
              data.map(entry => {
                const es = EVENT_STYLE[entry.eventType] || { className: 'badge', label: entry.eventType, custom: 'var(--text-dim)' };
                return (
                  <tr key={entry.id}>
                    <td className="cell-mono" style={{ fontSize: 10 }}>{entry.id}</td>
                    <td>{entry.username}</td>
                    <td>
                      <span
                        className={es.className}
                        style={es.custom ? { backgroundColor: es.custom, color: '#fff', fontSize: 10 } : { fontSize: 10 }}
                      >
                        {es.label}
                      </span>
                    </td>
                    <td className="cell-mono" style={{ fontSize: 11 }}>{entry.ipAddress || '—'}</td>
                    <td
                      style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10, cursor: 'help' }}
                      title={entry.userAgent || ''}
                    >
                      {truncateUA(entry.userAgent)}
                    </td>
                    <td className="cell-mono" style={{ fontSize: 10 }}>{formatTimestamp(entry.timestamp)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div>
      <div className="card">
        <div className="card-title">
          <span>
            {activeTab === 0 ? <FaHistory /> : <FaShieldAlt />}
            {' '}{activeTab === 0 ? 'Audit Log' : 'Security Audit Log'}
            <span className="req-ref">{activeTab === 0 ? 'MOD-007 / BR-004' : 'MOD-007 / REQ-039-042 / NFR-SEC09'}</span>
          </span>
          <button className="btn btn-secondary btn-sm" title="Export CSV (up to 10,000 rows)">
            <FaDownload /> Export CSV
          </button>
        </div>

        {renderTabs()}

        {activeTab === 0 && (
          <>
            {renderAuditFilters()}
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 8, padding: '0 4px' }}>
              <FaHistory /> Ticket state changes — INSERT-only (immutable). Retained permanently (BR-004).
            </div>
            {renderAuditTable()}
            {renderPagination(auditLogs.length, filteredAuditLogs.length)}
          </>
        )}

        {activeTab === 1 && (
          <>
            {renderSecFilters()}
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 8, padding: '0 4px' }}>
              <FaShieldAlt /> Auth events — INSERT-only (immutable). Retained ≥1 year (NFR-SEC09).
            </div>
            {renderSecTable()}
            {renderPagination(securityLogs.length, filteredSecurityLogs.length)}
          </>
        )}
      </div>
    </div>
  );
};

export default AuditLogs;

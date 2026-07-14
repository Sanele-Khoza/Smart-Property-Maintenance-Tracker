import React, { useState, useMemo, useEffect } from 'react';
import { FaTicketAlt, FaSearch, FaEye, FaUndo, FaUserCheck, FaTag, FaExclamationTriangle, FaCheck, FaTimes, FaArrowRight, FaBrain, FaRedo, FaFilter } from 'react-icons/fa';
import { getTickets, getTicketById, updateTicketStatus, assignTicket, reopenTicket, updateTicketCategory, getProviders, getProperties, getCategories, getInferenceLogs, getAuditLogs, getTechnicians } from '../../data/store';
import { getSession } from '../../data/authStore';
import Alert from '../../components/common/Alert';

const STATUS_STYLES = {
  'Open': { bg: 'rgba(100,120,150,0.15)', color: '#8a9bb5' },
  'Manual Review': { bg: 'rgba(240,180,50,0.15)', color: '#f0b432' },
  'Assigned': { bg: 'rgba(50,120,220,0.15)', color: '#3278dc' },
  'In Progress': { bg: 'rgba(45,183,145,0.15)', color: '#2db791' },
  'Waiting for Parts': { bg: 'rgba(130,80,200,0.15)', color: '#8250c8' },
  'Completed (Provider)': { bg: 'rgba(45,183,145,0.15)', color: '#2db791' },
  'Closed': { bg: 'rgba(120,120,130,0.15)', color: '#787882' },
  'Reopened': { bg: 'rgba(230,140,30,0.15)', color: '#e68c1e' },
  'Escalated': { bg: 'rgba(220,60,60,0.15)', color: '#dc3c3c' },
};

const PRIORITY_STYLES = {
  URGENT: { bg: 'rgba(220,60,60,0.15)', color: '#dc3c3c' },
  HIGH: { bg: 'rgba(240,180,50,0.15)', color: '#f0b432' },
  MEDIUM: { bg: 'rgba(50,120,220,0.15)', color: '#3278dc' },
  LOW: { bg: 'rgba(120,120,130,0.15)', color: '#787882' },
};

const TICKET_TRANSITIONS = {
  'Open': ['Manual Review', 'Assigned', 'Escalated'],
  'Manual Review': ['Open', 'Assigned', 'Escalated'],
  'Assigned': ['In Progress', 'Escalated'],
  'In Progress': ['Waiting for Parts', 'Completed (Provider)', 'Escalated'],
  'Waiting for Parts': ['In Progress', 'Escalated'],
  'Completed (Provider)': ['Closed', 'Reopened'],
  'Closed': ['Reopened'],
  'Reopened': ['Assigned', 'In Progress', 'Escalated'],
  'Escalated': ['Assigned', 'In Progress'],
};

const TRANSITION_LABELS = {
  'Manual Review': 'Review', 'Assigned': 'Assign', 'In Progress': 'Progress',
  'Waiting for Parts': 'Wait Parts', 'Completed (Provider)': 'Complete',
  'Closed': 'Close', 'Reopened': 'Reopen', 'Escalated': 'Escalate',
};

const TABS = ['All', 'Open', 'Assigned', 'In Progress', 'Needs Review', 'SLA Warning', 'SLA Breached', 'Completed'];

const Tickets = () => {
  const session = getSession();
  const pmName = session ? `${session.name} ${session.surname}` : '';
  const [allProperties] = useState(getProperties);
  const propNames = useMemo(() => new Set(allProperties.filter(p => p.managerName === pmName).map(p => p.name)), [allProperties, pmName]);
  const [allTickets, setAllTickets] = useState(getTickets);
  const tickets = useMemo(() => allTickets.filter(t => propNames.has(t.propertyName)) , [allTickets, propNames]);
  const [providers] = useState(getProviders);
  const [categories] = useState(getCategories());
  const [auditLogs] = useState(getAuditLogs());
  const [inferenceLogs] = useState(getInferenceLogs());
  const [alert, setAlert] = useState({ msg: '', type: '' });
  const [activeTab, setActiveTab] = useState('All');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [searchText, setSearchText] = useState('');
  const [expandedRows, setExpandedRows] = useState({});
  const [showReassign, setShowReassign] = useState(null);
  const [reassignProvider, setReassignProvider] = useState('');
  const [showAllProviders, setShowAllProviders] = useState(false);
  const [technicians] = useState(getTechnicians);
  const [showReopen, setShowReopen] = useState(null);
  const [reopenText, setReopenText] = useState('');
  const [reopenError, setReopenError] = useState('');
  const [showCategoryModal, setShowCategoryModal] = useState(null);
  const [categoryValue, setCategoryValue] = useState('');
  const [confirmTransition, setConfirmTransition] = useState(null);

  useEffect(() => {
    const handleSlaBreach = () => setAllTickets(getTickets());
    const handleSlaWarning = () => setAllTickets(getTickets());
    window.addEventListener('spmt:sla-breach', handleSlaBreach);
    window.addEventListener('spmt:sla-warning', handleSlaWarning);
    return () => {
      window.removeEventListener('spmt:sla-breach', handleSlaBreach);
      window.removeEventListener('spmt:sla-warning', handleSlaWarning);
    };
  }, []);

  const refresh = () => {
    setAlert({ msg: '', type: '' });
    window.location.reload();
  };

  const showAlert = (msg, type) => { setAlert({ msg, type }); setTimeout(() => setAlert({ msg: '', type: '' }), 5000); };

  const getRoutingRecommendations = (ticket, techs) => {
    if (!ticket?.category) return [];
    const eligible = techs.filter(t =>
      (t.availabilityStatus === 'AVAILABLE' || t.availabilityStatus === 'ON_CALL') &&
      (t.specialisations || []).some(s => s.toLowerCase() === (ticket.category || '').toLowerCase())
    );
    return eligible.map(t => {
      const ratingScore = ((t.rating || 0) / 5) * 0.50;
      const proximityScore = (1 - Math.min(t.currentWorkload || 0, 10) / 10) * 0.30;
      const workloadScore = (1 - Math.min(t.currentWorkload || 0, 10) / 10) * 0.20;
      const compositeScore = ratingScore + proximityScore + workloadScore;
      return {
        ...t, compositeScore: Math.round(compositeScore * 100),
        ratingScore: Math.round(ratingScore * 100),
        proximityScore: Math.round(proximityScore * 100),
        workloadScore: Math.round(workloadScore * 100),
      };
    }).sort((a, b) => b.compositeScore - a.compositeScore).slice(0, 3);
  };

  const getSlaStatus = (ticket) => {
    if (['Closed', 'Completed (Provider)'].includes(ticket.status)) {
      return { label: '\u2713 Resolved', pct: 100, colour: 'var(--teal)', state: 'resolved' };
    }
    if (!ticket.slaResolutionBefore) {
      return { label: '\u2014', pct: 0, colour: 'var(--text-dim)', state: 'unknown' };
    }
    const createdMs = new Date(ticket.createdAt).getTime();
    const now = Date.now();
    const total = ticket.slaResolutionBefore - createdMs;
    const elapsed = now - createdMs;
    const pct = Math.min(100, Math.max(0, (elapsed / total) * 100));
    const remaining = ticket.slaResolutionBefore - now;

    if (remaining <= 0) {
      return { label: '\u26A0 BREACHED', pct: 100, colour: 'var(--danger)', state: 'breached' };
    }
    if (pct >= 75) {
      const hrs = Math.floor(remaining / 3600000);
      const mins = Math.floor((remaining % 3600000) / 60000);
      return {
        label: hrs > 0 ? `${hrs}h ${mins}m left` : `${mins}m left`,
        pct, colour: 'var(--amber)', state: 'warning'
      };
    }
    const days = Math.floor(remaining / 86400000);
    const hrs = Math.floor((remaining % 86400000) / 3600000);
    return {
      label: days > 0 ? `${days}d ${hrs}h left` : `${Math.floor(remaining / 3600000)}h left`,
      pct, colour: 'var(--teal)', state: 'ontrack'
    };
  };

  const filtered = tickets.filter(t => {
    if (activeTab === 'Needs Review' && !t.conflictDetected && !t.manualReviewRequired) return false;
    if (activeTab === 'SLA Warning') { const s = getSlaStatus(t); if (!s || s.state !== 'warning') return false; }
    if (activeTab === 'SLA Breached') { const s = getSlaStatus(t); if (!s || s.state !== 'breached') return false; }
    if (activeTab === 'Open' && t.status !== 'Open') return false;
    if (activeTab === 'Assigned' && t.status !== 'Assigned') return false;
    if (activeTab === 'In Progress' && t.status !== 'In Progress') return false;
    if (activeTab === 'Completed' && t.status !== 'Closed' && t.status !== 'Completed (Provider)') return false;
    if (statusFilter && t.status !== statusFilter) return false;
    if (priorityFilter && t.priority !== priorityFilter) return false;
    if (searchText && !t.title.toLowerCase().includes(searchText.toLowerCase()) && !t.ticketId.toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  }).sort((a, b) => (a.slaResolutionBefore || Infinity) - (b.slaResolutionBefore || Infinity));

  const slaBreached = tickets.filter(t => getSlaStatus(t)?.state === 'breached').length;
  const needsReview = tickets.filter(t => t.conflictDetected || t.manualReviewRequired).length;

  const stats = [
    { label: 'Total', value: tickets.length, icon: FaTicketAlt },
    { label: 'Open', value: tickets.filter(t => t.status === 'Open').length, icon: FaTicketAlt },
    { label: 'In Progress', value: tickets.filter(t => t.status === 'In Progress').length, icon: FaRedo },
    { label: 'Needs Review', value: needsReview, icon: FaBrain },
    { label: 'Conflict', value: tickets.filter(t => t.conflictDetected).length, icon: FaExclamationTriangle },
    { label: 'SLA Breached', value: slaBreached, icon: FaExclamationTriangle },
  ];

  const tabCounts = {
    'All': tickets.length,
    'Open': tickets.filter(t => t.status === 'Open').length,
    'Assigned': tickets.filter(t => t.status === 'Assigned').length,
    'In Progress': tickets.filter(t => t.status === 'In Progress').length,
    'Needs Review': needsReview,
    'SLA Warning': tickets.filter(t => getSlaStatus(t)?.state === 'warning').length,
    'SLA Breached': slaBreached,
    'Completed': tickets.filter(t => t.status === 'Closed' || t.status === 'Completed (Provider)').length,
  };

  const uniqueStatuses = [...new Set(tickets.map(t => t.status))].sort();
  const uniqueCategories = [...new Set(tickets.filter(t => t.category).map(t => t.category))].sort();

  const handleTransition = (ticketId, newStatus) => {
    const r = updateTicketStatus(ticketId, newStatus);
    if (r.success) { showAlert(`Ticket ${ticketId} → ${newStatus}`, 'success'); }
    else showAlert(r.error, 'error');
  };

  const handleReassign = (e) => {
    e.preventDefault();
    if (!reassignProvider) return;
    const prov = providers.find(p => p.name === reassignProvider);
    const r = assignTicket(showReassign.ticketId, reassignProvider, prov?.id);
    if (r.success) { showAlert(`Reassigned ${showReassign.ticketId}`, 'success'); setShowReassign(null); }
    else showAlert(r.error, 'error');
  };

  const handleReopen = (e) => {
    e.preventDefault();
    if (reopenText.trim().length < 10) { setReopenError('Justification ≥10 chars (REQ-041)'); return; }
    const r = reopenTicket(showReopen.ticketId, reopenText.trim());
    if (r.success) { showAlert(`Ticket reopened.`, 'success'); setShowReopen(null); }
    else setReopenError(r.error);
  };

  const handleCategoryOverride = (e) => {
    e.preventDefault();
    const r = updateTicketCategory(showCategoryModal.ticketId, categoryValue);
    if (r.success) { showAlert(`Category override saved (BR-006)`, 'success'); setShowCategoryModal(null); }
    else showAlert(r.error, 'error');
  };

  return (
    <div>
      <div className="card">
        <div className="card-title">
          <span><FaTicketAlt /> Tickets <span className="req-ref">MOD-003 / UC-002</span></span>
          <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-dim)' }}>Manager: {pmName}</span>
        </div>
        <Alert msg={alert.msg} type={alert.type} />
        <div className="stat-grid">{stats.map((s, i) => (
          <div className="stat-card" key={i} style={s.label === 'SLA Breached' && s.value > 0 ? { borderLeftColor: 'var(--danger)' } : {}}>
            <div className="stat-value" style={s.label === 'SLA Breached' && s.value > 0 ? { color: 'var(--danger)' } : {}}><s.icon /> {s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}</div>
      </div>
      <div className="card">
        <div className="card-title" style={{ flexWrap: 'wrap' }}>
          <span><FaTicketAlt /> All Tickets</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <FaSearch style={{ color: 'var(--text-dim)' }} />
            <input className="form-input" style={{ width: 130, fontSize: 11, padding: '4px 6px' }} placeholder="Search..." value={searchText} onChange={e => setSearchText(e.target.value)} />
            <select className="form-select" style={{ width: 'auto', minWidth: 90, fontSize: 11, padding: '4px 6px' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              {uniqueStatuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="form-select" style={{ width: 'auto', minWidth: 80, fontSize: 11, padding: '4px 6px' }} value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
              <option value="">All Priority</option>
              <option value="URGENT">URGENT</option><option value="HIGH">HIGH</option><option value="MEDIUM">MEDIUM</option><option value="LOW">LOW</option>
            </select>
          </div>
        </div>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', padding: '0 0 8px', borderBottom: '1px solid var(--border)', marginBottom: 8 }}>
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: '4px 10px', fontSize: 11, border: 'none', borderRadius: '3px 3px 0 0', cursor: 'pointer',
              backgroundColor: activeTab === tab ? 'rgba(45,183,145,0.1)' : 'transparent',
              color: activeTab === tab ? 'var(--teal)' : 'var(--text-dim)', fontWeight: activeTab === tab ? 600 : 400,
              borderBottom: activeTab === tab ? '2px solid var(--teal)' : '2px solid transparent',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              {tab}
              {tabCounts[tab] > 0 && <span style={{
                fontSize: 9, padding: '1px 5px', borderRadius: 6, fontWeight: 700,
                backgroundColor: tab === 'SLA Breached' ? 'rgba(220,60,60,0.15)' : tab === 'Needs Review' ? 'rgba(240,180,50,0.15)' : 'rgba(255,255,255,0.08)',
                color: tab === 'SLA Breached' ? 'var(--danger)' : tab === 'Needs Review' ? 'var(--amber)' : 'var(--text-dim)',
              }}>{tabCounts[tab]}</span>}
            </button>
          ))}
        </div>
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead><tr><th>ID</th><th>Title</th><th>Property</th><th>Unit</th><th>Status</th><th>Priority</th><th>Category</th><th>AI Orig.</th><th>Conf.</th><th>Badges</th><th>SLA</th><th>Assigned</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.length === 0 ? <tr><td colSpan="14" style={{ textAlign: 'center', padding: 24, color: 'var(--text-dim)' }}>No tickets match.</td></tr> : (
                filtered.map(t => {
                  const st = STATUS_STYLES[t.status] || {};
                  const pt = PRIORITY_STYLES[t.priority] || {};
                  const canAssign = ['Open', 'Manual Review', 'Reopened', 'Escalated'].includes(t.status);
                  const canReopen = ['Closed', 'Completed (Provider)'].includes(t.status);
                  const tc = TICKET_TRANSITIONS[t.status] || [];
                  const override = t.aiOriginalCategory && t.category && t.aiOriginalCategory !== t.category;
                  const expanded = expandedRows[t.ticketId];
                  const sla = getSlaStatus(t);
                  return (
                    <React.Fragment key={t.ticketId}>
                      <tr style={{
                        backgroundColor: sla?.state === 'breached' ? 'rgba(220,60,60,0.04)' : sla?.state === 'warning' ? 'rgba(240,180,50,0.04)' : '',
                        borderLeft: sla?.state === 'breached' ? '3px solid var(--danger)' : sla?.state === 'warning' ? '3px solid var(--amber)' : '3px solid transparent',
                        borderRight: sla?.state === 'breached' ? `3px solid ${sla.colour}` : sla?.state === 'warning' ? `3px solid ${sla.colour}` : '3px solid transparent',
                      }}>
                        <td className="cell-mono">{t.ticketId}</td>
                        <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.title}>{t.title}</td>
                        <td>{t.propertyName}</td>
                        <td className="cell-mono">{t.unitNumber}</td>
                        <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '1px 6px', borderRadius: 3, fontSize: 10, fontWeight: 600, backgroundColor: st.bg || '', color: st.color || 'var(--text)' }}><span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: st.color || 'var(--text-dim)', display: 'inline-block' }} />{t.status}</span></td>
                        <td><span style={{ padding: '1px 6px', borderRadius: 3, fontSize: 10, fontWeight: 700, backgroundColor: pt.bg || '', color: pt.color || 'var(--text)' }}>{t.priority}</span></td>
                        <td>{t.category || <span style={{ color: 'var(--text-dim)' }}>—</span>}</td>
                        <td>{override ? <span title={`${t.aiOriginalCategory} → ${t.category}`} style={{ cursor: 'help' }}><span style={{ color: 'var(--text-dim)', textDecoration: 'line-through' }}>{t.aiOriginalCategory}</span><FaArrowRight style={{ fontSize: 8, margin: '0 3px', color: 'var(--amber)' }} /><span style={{ color: 'var(--amber)', fontWeight: 600 }}>{t.category}</span></span> : (t.aiOriginalCategory || <span style={{ color: 'var(--text-dim)' }}>—</span>)}</td>
                        <td className="cell-mono">{t.combinedConfidence != null ? <span style={{ color: t.combinedConfidence >= 0.8 ? 'var(--teal)' : t.combinedConfidence >= 0.6 ? 'var(--amber)' : 'var(--danger)', fontWeight: 600 }}>{Math.round(t.combinedConfidence * 100)}%</span> : <span style={{ color: 'var(--text-dim)' }}>—</span>}</td>
                        <td><div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>{t.conflictDetected && <span className="badge badge-danger" style={{ fontSize: 8 }}>CONFLICT</span>}{t.manualReviewRequired && <span className="badge badge-warning" style={{ fontSize: 8 }}>REVIEW</span>}{!t.conflictDetected && !t.manualReviewRequired && <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>—</span>}</div></td>
                        <td style={{ minWidth: 110 }}>
                          <div style={{ height: 4, borderRadius: 2, background: 'var(--border)', marginBottom: 4, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${sla.pct}%`, background: sla.colour, transition: 'width 0.3s' }} />
                          </div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: sla.colour }}>
                            {sla.label}
                          </div>
                        </td>
                        <td style={{ fontSize: 11, color: 'var(--text-dim)' }}>{t.assignedTo || '—'}</td>
                        <td style={{ fontSize: 10, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{t.createdAt}</td>
                        <td>
                          <div className="action-cell">
                            <button className="btn btn-secondary btn-sm" onClick={() => setExpandedRows(p => ({ ...p, [t.ticketId]: !p[t.ticketId] }))}><FaEye /></button>
                            {tc.filter(s => s !== 'Reopened').map(s => <button key={s} className="btn btn-secondary btn-sm" onClick={() => handleTransition(t.ticketId, s)} style={{ fontSize: 9, padding: '2px 5px' }}>{TRANSITION_LABELS[s] || s}</button>)}
                            {tc.includes('Reopened') && <button className="btn btn-secondary btn-sm" onClick={() => { setShowReopen(t); setReopenText(''); setReopenError(''); }} style={{ fontSize: 9, padding: '2px 5px' }}><FaUndo /> Reopen</button>}
                            {canAssign && <button className="btn btn-teal btn-sm" onClick={() => { setShowReassign(t); setReassignProvider(''); }}><FaUserCheck /></button>}
                            <button className="btn btn-secondary btn-sm" onClick={() => { setShowCategoryModal(t); setCategoryValue(t.category || ''); }}><FaTag /></button>
                          </div>
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="expanded-row"><td colSpan="14" style={{ padding: '8px 16px', backgroundColor: 'var(--surface)' }}>
                          <div style={{ display: 'flex', gap: 24, fontSize: 12, flexWrap: 'wrap' }}>
                            <div style={{ flex: 2, minWidth: 240 }}>
                              <strong>Description:</strong>
                              <p style={{ margin: '4px 0', color: 'var(--text-dim)', whiteSpace: 'pre-wrap' }}>{t.description}</p>
                              <strong style={{ marginTop: 8, display: 'block' }}>Audit Trail:</strong>
                              {auditLogs.filter(l => l.ticketId === t.ticketId).map(l => (
                                <div key={l.id} style={{ padding: '2px 0', fontSize: 10, color: 'var(--text-dim)', borderBottom: '1px solid var(--border)' }}>
                                  <span style={{ color: 'var(--text)' }}>{l.actor}</span> — {l.action}: {l.comment}
                                  <span style={{ float: 'right' }}>{new Date(l.timestamp).toLocaleString()}</span>
                                </div>
                              ))}
                            </div>
                            <div style={{ flex: 1, minWidth: 160 }}>
                              <strong>AI Inferences:</strong>
                              {inferenceLogs.filter(l => l.ticketId === t.ticketId).length > 0 ? inferenceLogs.filter(l => l.ticketId === t.ticketId).map(l => (
                                <div key={l.id} style={{ padding: '2px 0', fontSize: 10, color: 'var(--text-dim)' }}><FaBrain style={{ fontSize: 8, marginRight: 3 }} />{l.adapter} ({l.inputType}): {Math.round(l.confidence * 100)}% → {l.result}{l.conflictDetected && <span className="badge badge-danger" style={{ fontSize: 7, marginLeft: 4 }}>CONFLICT</span>}</div>
                              )) : <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>No AI inference data</span>}
                            </div>
                          </div>
                        </td></tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showReassign && (
        <div className="modal" onClick={() => setShowReassign(null)}>
          <div className="edit-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="edit-modal-header"><span><FaUserCheck /> Reassign — {showReassign.ticketId}</span><button className="modal-close-btn" onClick={() => setShowReassign(null)}><FaTimes /></button></div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>Routing Recommendations <span className="req-ref">REQ-033-035</span></div>
              {(() => {
                const recs = getRoutingRecommendations(showReassign, technicians);
                if (recs.length === 0) {
                  return <div className="alert alert-warning" style={{ fontSize: 11, padding: '8px 10px' }}>
                    <FaExclamationTriangle style={{ marginRight: 4 }} />No eligible providers match the category '{showReassign.category}'. No available provider has this specialisation. Select manually from the full list below.
                  </div>;
                }
                return recs.map(t => (
                  <div key={t.id} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: 12, marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600 }}>{t.name}</span>
                      <span style={{ background: 'var(--amber)', padding: '2px 8px', borderRadius: 3, fontSize: 10, fontFamily: 'var(--font-mono)', color: '#000' }}>{t.compositeScore}% match</span>
                    </div>
                    <div style={{ color: 'var(--text-mid)', fontSize: 11 }}>{t.companyName}</div>
                    <div style={{ fontSize: 11, marginTop: 4 }}>⭐ {t.rating}/5 &nbsp;|&nbsp; 💼 {t.currentWorkload} active jobs &nbsp;|&nbsp; <span className={`badge ${t.availabilityStatus === 'AVAILABLE' ? 'badge-completed' : 'badge-info'}`} style={{ fontSize: 9 }}>{t.availabilityStatus}</span></div>
                    <div style={{ marginTop: 6, display: 'flex', gap: 4 }}>
                      <span style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 3, padding: '2px 6px', fontSize: 10, fontFamily: 'var(--font-mono)' }}>Rating: {t.ratingScore}%</span>
                      <span style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 3, padding: '2px 6px', fontSize: 10, fontFamily: 'var(--font-mono)' }}>Proximity: {t.proximityScore}%</span>
                      <span style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 3, padding: '2px 6px', fontSize: 10, fontFamily: 'var(--font-mono)' }}>Workload: {t.workloadScore}%</span>
                    </div>
                    <div style={{ marginTop: 6 }}>
                      {reassignProvider === t.name ? (
                        <span style={{ color: 'var(--teal)', fontWeight: 600, fontSize: 11 }}>Selected</span>
                      ) : (
                        <button className="btn btn-primary btn-sm" onClick={() => setReassignProvider(t.name)}>Select This Provider</button>
                      )}
                    </div>
                  </div>
                ));
              })()}
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginBottom: 12 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowAllProviders(!showAllProviders)} style={{ fontSize: 10 }}>
                {showAllProviders ? '▲' : '▼'} Show all providers (manual override)
              </button>
              {showAllProviders && (
                <div className="form-group" style={{ marginTop: 8 }}>
                  <label style={{ fontSize: 11 }}>All Providers</label>
                  <select className="form-select" value={reassignProvider} onChange={e => setReassignProvider(e.target.value)}>
                    <option value="">— Select provider —</option>
                    {providers.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                  </select>
                </div>
              )}
            </div>
            <form onSubmit={handleReassign}>
              <div className="form-actions"><button type="button" className="btn btn-secondary" onClick={() => { setShowReassign(null); setShowAllProviders(false); }}>Cancel</button><button type="submit" className="btn btn-teal" disabled={!reassignProvider}><FaUserCheck /> Assign</button></div>
            </form>
          </div>
        </div>
      )}

      {showReopen && (
        <div className="modal" onClick={() => setShowReopen(null)}>
          <div className="edit-modal" onClick={e => e.stopPropagation()}>
            <div className="edit-modal-header"><span><FaUndo /> Reopen — {showReopen.ticketId}</span><button className="modal-close-btn" onClick={() => setShowReopen(null)}><FaTimes /></button></div>
            <form onSubmit={handleReopen}>
              {reopenError && <Alert msg={reopenError} type="error" />}
              <div className="form-group"><label>Justification <span style={{ color: 'var(--danger)', fontSize: 10 }}>≥10 chars (REQ-041)</span></label><textarea className="form-input" rows={3} value={reopenText} onChange={e => setReopenText(e.target.value)} placeholder="Why reopen?" required /><div style={{ fontSize: 10, marginTop: 4, color: reopenText.trim().length >= 10 ? 'var(--teal)' : 'var(--text-dim)' }}>{reopenText.trim().length}/10</div></div>
              <div className="form-actions"><button type="button" className="btn btn-secondary" onClick={() => setShowReopen(null)}>Cancel</button><button type="submit" className="btn btn-primary" disabled={reopenText.trim().length < 10}><FaUndo /> Reopen</button></div>
            </form>
          </div>
        </div>
      )}

      {showCategoryModal && (
        <div className="modal" onClick={() => setShowCategoryModal(null)}>
          <div className="edit-modal" onClick={e => e.stopPropagation()}>
            <div className="edit-modal-header"><span><FaTag /> Override Category — {showCategoryModal.ticketId}</span><button className="modal-close-btn" onClick={() => setShowCategoryModal(null)}><FaTimes /></button></div>
            <form onSubmit={handleCategoryOverride}>
              {showCategoryModal.aiOriginalCategory && showCategoryModal.aiOriginalCategory !== categoryValue && <p style={{ fontSize: 11, color: 'var(--amber)', marginBottom: 8 }}><FaExclamationTriangle style={{ marginRight: 4 }} />AI originally: <strong>{showCategoryModal.aiOriginalCategory}</strong>. Override logged (BR-006).</p>}
              <div className="form-group"><label>New Category</label><select className="form-select" value={categoryValue} onChange={e => setCategoryValue(e.target.value)} required>{categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
              <div className="form-actions"><button type="button" className="btn btn-secondary" onClick={() => setShowCategoryModal(null)}>Cancel</button><button type="submit" className="btn btn-primary"><FaCheck /> Save Override</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tickets;

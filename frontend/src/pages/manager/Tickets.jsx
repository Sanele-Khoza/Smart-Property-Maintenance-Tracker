import React, { useState, useMemo, useEffect } from 'react';
import { FaTicketAlt, FaSearch, FaEye, FaUndo, FaUserCheck, FaTag, FaExclamationTriangle, FaCheck, FaTimes, FaArrowRight, FaBrain, FaRedo, FaFilter, FaBuilding, FaBox, FaCalendarAlt, FaUser, FaTrash, FaCommentDots, FaRobot } from 'react-icons/fa';
import { getTicketById, updateTicketStatus, assignTicket, reopenTicket, updateTicketCategory, getProviders, getProperties, getCategories, getInferenceLogs, getAuditLogs, getTechnicians, trashTicket, restoreTicket, getTrashTickets } from '../../data/store';
import { getSlaStatus as computeSlaStatus } from '../../data/slaEngine';
import { getSession } from '../../data/authStore';
import Alert from '../../components/common/Alert';
import ImageLightbox from '../../components/common/ImageLightbox';
import useTickets from '../../hooks/useTickets';

const STATUS_STYLES = {
  'New': { bg: 'rgba(100,120,150,0.15)', color: '#8a9bb5' },
  'AI Classified': { bg: 'rgba(100,120,150,0.15)', color: '#8a9bb5' },
  'Manual Review': { bg: 'rgba(240,180,50,0.15)', color: '#f0b432' },
  'Assigned': { bg: 'rgba(50,120,220,0.15)', color: '#3278dc' },
  'Accepted': { bg: 'rgba(50,120,220,0.15)', color: '#3278dc' },
  'In Progress': { bg: 'rgba(45,183,145,0.15)', color: '#2db791' },
  'Waiting for Parts': { bg: 'rgba(130,80,200,0.15)', color: '#8250c8' },
  'Completed': { bg: 'rgba(45,183,145,0.15)', color: '#2db791' },
  'Tenant Confirmed': { bg: 'rgba(45,183,145,0.15)', color: '#2db791' },
  'Closed': { bg: 'rgba(120,120,130,0.15)', color: '#787882' },
  'Cancelled': { bg: 'rgba(120,120,130,0.15)', color: '#787882' },
  'Archived': { bg: 'rgba(120,120,130,0.15)', color: '#787882' },
  'On Hold': { bg: 'rgba(240,180,50,0.15)', color: '#f0b432' },
  'Reopened': { bg: 'rgba(230,140,30,0.15)', color: '#e68c1e' },
  'Escalated': { bg: 'rgba(220,60,60,0.15)', color: '#dc3c3c' },
  'Declined': { bg: 'rgba(240,180,50,0.15)', color: '#f0b432' },
};

const PRIORITY_STYLES = {
  URGENT: { bg: 'rgba(220,60,60,0.15)', color: '#dc3c3c' },
  HIGH: { bg: 'rgba(240,180,50,0.15)', color: '#f0b432' },
  MEDIUM: { bg: 'rgba(50,120,220,0.15)', color: '#3278dc' },
  LOW: { bg: 'rgba(120,120,130,0.15)', color: '#787882' },
};

const TICKET_TRANSITIONS = {
  'New': ['AI Classified', 'Manual Review', 'Cancelled'],
  'AI Classified': ['Assigned', 'Manual Review', 'Cancelled'],
  'Manual Review': ['AI Classified', 'Cancelled'],
  'Assigned': ['Accepted', 'Cancelled', 'On Hold', 'Escalated', 'Declined'],
  'Accepted': ['In Progress', 'Cancelled', 'On Hold'],
  'Declined': ['Assigned', 'Cancelled'],
  'In Progress': ['Waiting for Parts', 'Completed', 'On Hold', 'Escalated'],
  'Waiting for Parts': ['In Progress', 'On Hold'],
  'Completed': ['Tenant Confirmed', 'Reopened'],
  'Tenant Confirmed': ['Closed'],
  'Closed': [],
  'Cancelled': ['Archived'],
  'Archived': ['Reopened'],
  'On Hold': ['In Progress', 'Cancelled'],
  'Reopened': ['Assigned', 'In Progress', 'Cancelled'],
  'Escalated': ['Manual Review', 'Assigned'],
};

const TRANSITION_LABELS = {
  'AI Classified': 'AI', 'Manual Review': 'Review', 'Assigned': 'Assign',
  'Accepted': 'Accept', 'In Progress': 'Progress',
  'Waiting for Parts': 'Wait Parts', 'Completed': 'Complete',
  'Tenant Confirmed': 'Confirm', 'Closed': 'Close', 'Cancelled': 'Cancel',
  'Archived': 'Archive', 'On Hold': 'Hold', 'Reopened': 'Reopen', 'Escalated': 'Escalate',
};

const PROVIDER_ACTIONS = new Set(['Accepted', 'In Progress', 'Waiting for Parts', 'Completed', 'Tenant Confirmed', 'Closed']);

const TABS = ['All', 'New', 'Assigned', 'Accepted', 'In Progress', 'Declined', 'Needs Review', 'SLA Warning', 'SLA Breached', 'Completed'];

const Tickets = () => {
  const session = getSession();
  const pmName = session ? `${session.name} ${session.surname}` : '';
  const [allProperties] = useState(getProperties);
  const propNames = useMemo(() => new Set(allProperties.filter(p => p.managerName === pmName).map(p => p.name)), [allProperties, pmName]);
  const [allTickets, refreshTickets] = useTickets();
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
  const [showDetails, setShowDetails] = useState(null);
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
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showTrash, setShowTrash] = useState(false);
  const [trashTickets, setTrashTickets] = useState([]);
  const [loadingTrash, setLoadingTrash] = useState(false);
  const [lightboxImg, setLightboxImg] = useState(null);

  const openTrash = async () => {
    setShowTrash(true);
    setLoadingTrash(true);
    setTrashTickets(await getTrashTickets());
    setLoadingTrash(false);
  };

  const handleDelete = async (ticket) => {
    const r = await trashTicket(ticket.ticketId);
    if (r.success) {
      showAlert('Ticket moved to trash.', 'success');
      setConfirmDelete(null);
      refreshTickets();
    } else {
      showAlert(r.error, 'error');
      setConfirmDelete(null);
    }
  };

  const handleRestore = async (ticket) => {
    const r = await restoreTicket(ticket.ticketId);
    if (r.success) {
      showAlert('Ticket restored from trash.', 'success');
      setTrashTickets(await getTrashTickets());
      refreshTickets();
    } else {
      showAlert(r.error, 'error');
    }
  };

  useEffect(() => {
    const handleSlaBreach = () => refreshTickets();
    const handleSlaWarning = () => refreshTickets();
    window.addEventListener('spmt:sla-breach', handleSlaBreach);
    window.addEventListener('spmt:sla-warning', handleSlaWarning);
    return () => {
      window.removeEventListener('spmt:sla-breach', handleSlaBreach);
      window.removeEventListener('spmt:sla-warning', handleSlaWarning);
    };
  }, [refreshTickets]);

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
    if (['Completed', 'Tenant Confirmed', 'Closed'].includes(ticket.status)) {
      return { label: '\u2713 Resolved', pctElapsed: 100, color: 'var(--teal)', state: 'resolved' };
    }
    const s = computeSlaStatus(ticket);
    if (!s) return { label: '\u2014', pctElapsed: 0, color: 'var(--text-dim)', state: 'unknown' };
    return { label: s.label, pctElapsed: s.pctElapsed, color: s.color, state: s.state };
  };

  const filtered = tickets.filter(t => {
    if (activeTab === 'Needs Review' && !t.conflictDetected && !t.manualReviewRequired) return false;
    if (activeTab === 'SLA Warning') { const s = getSlaStatus(t); if (!s || s.state !== 'warning') return false; }
    if (activeTab === 'SLA Breached') { const s = getSlaStatus(t); if (!s || s.state !== 'breached') return false; }
    if (activeTab === 'New' && t.status !== 'New') return false;
    if (activeTab === 'Assigned' && t.status !== 'Assigned') return false;
    if (activeTab === 'Accepted' && t.status !== 'Accepted') return false;
    if (activeTab === 'In Progress' && t.status !== 'In Progress') return false;
    if (activeTab === 'Declined' && t.status !== 'Declined') return false;
    if (activeTab === 'Completed' && t.status !== 'Completed' && t.status !== 'Tenant Confirmed' && t.status !== 'Closed') return false;
    if (statusFilter && t.status !== statusFilter) return false;
    if (priorityFilter && t.priority !== priorityFilter) return false;
    if (searchText && !t.title.toLowerCase().includes(searchText.toLowerCase()) && !t.ticketId.toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  }).sort((a, b) => (a.slaResolutionBefore || Infinity) - (b.slaResolutionBefore || Infinity));

  const slaBreached = tickets.filter(t => getSlaStatus(t)?.state === 'breached').length;
  const needsReview = tickets.filter(t => t.conflictDetected || t.manualReviewRequired).length;

  const stats = [
    { label: 'Total', value: tickets.length, icon: FaTicketAlt },
    { label: 'New', value: tickets.filter(t => t.status === 'New').length, icon: FaTicketAlt },
    { label: 'In Progress', value: tickets.filter(t => t.status === 'In Progress').length, icon: FaRedo },
    { label: 'Needs Review', value: needsReview, icon: FaBrain },
    { label: 'Conflict', value: tickets.filter(t => t.conflictDetected).length, icon: FaExclamationTriangle },
    { label: 'SLA Breached', value: slaBreached, icon: FaExclamationTriangle },
  ];

  const tabCounts = {
    'All': tickets.length,
    'New': tickets.filter(t => t.status === 'New').length,
    'Assigned': tickets.filter(t => t.status === 'Assigned').length,
    'Accepted': tickets.filter(t => t.status === 'Accepted').length,
    'In Progress': tickets.filter(t => t.status === 'In Progress').length,
    'Declined': tickets.filter(t => t.status === 'Declined').length,
    'Needs Review': needsReview,
    'SLA Warning': tickets.filter(t => getSlaStatus(t)?.state === 'warning').length,
    'SLA Breached': slaBreached,
    'Completed': tickets.filter(t => t.status === 'Completed' || t.status === 'Tenant Confirmed' || t.status === 'Closed').length,
  };

  const uniqueStatuses = [...new Set(tickets.map(t => t.status))].sort();
  const uniqueCategories = [...new Set(tickets.filter(t => t.category).map(t => t.category))].sort();

  const handleTransition = async (ticketId, newStatus) => {
    const r = await updateTicketStatus(ticketId, newStatus);
    if (r.success) { showAlert(`Status updated to ${newStatus}`, 'success'); }
    else showAlert(r.error, 'error');
  };

  const handleReassign = async (e) => {
    e.preventDefault();
    if (!reassignProvider) return;
    const prov = providers.find(p => p.name === reassignProvider);
    const r = await assignTicket(showReassign.ticketId, reassignProvider, prov?.id);
    if (r.success) { showAlert('Ticket reassigned', 'success'); setShowReassign(null); }
    else showAlert(r.error, 'error');
  };

  const handleReopen = async (e) => {
    e.preventDefault();
    if (reopenText.trim().length < 10) { setReopenError('Justification ≥10 chars (REQ-041)'); return; }
    const r = await reopenTicket(showReopen.ticketId, reopenText.trim());
    if (r.success) { showAlert(`Ticket reopened.`, 'success'); setShowReopen(null); }
    else setReopenError(r.error);
  };

  const handleCategoryOverride = async (e) => {
    e.preventDefault();
    const r = await updateTicketCategory(showCategoryModal.ticketId, categoryValue);
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
            <button className="btn btn-secondary btn-sm" onClick={openTrash} title="Trash" style={{ fontSize: 11 }}><FaTrash /> Trash</button>
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
            <thead><tr><th>Title</th><th>Property</th><th>Unit</th><th>Status</th><th>Priority</th><th>Category</th><th>AI Orig.</th><th>Conf.</th><th>Badges</th><th>SLA</th><th>Assigned</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.length === 0 ? <tr><td colSpan="14" style={{ textAlign: 'center', padding: 24, color: 'var(--text-dim)' }}>No tickets match.</td></tr> : (
                filtered.map(t => {
                  const st = STATUS_STYLES[t.status] || {};
                  const pt = PRIORITY_STYLES[t.priority] || {};
                  const canAssign = ['New', 'AI Classified', 'Manual Review', 'Reopened', 'Escalated', 'Declined'].includes(t.status);
                  const canReopen = ['Completed', 'Archived'].includes(t.status);
                  const tc = TICKET_TRANSITIONS[t.status] || [];
                  const genericButtons = tc.filter(s => s !== 'Reopened' && !PROVIDER_ACTIONS.has(s) && !(t.status === 'Declined' && s === 'Assigned'));
                  const override = t.aiOriginalCategory && t.category && t.aiOriginalCategory !== t.category;
                  const sla = getSlaStatus(t);
                  return (
                      <tr onClick={() => setShowDetails(t)} style={{
                        cursor: 'pointer',
                        backgroundColor: sla?.state === 'breached' ? 'rgba(220,60,60,0.04)' : sla?.state === 'warning' ? 'rgba(240,180,50,0.04)' : '',
                        borderLeft: sla?.state === 'breached' ? '3px solid var(--danger)' : sla?.state === 'warning' ? '3px solid var(--amber)' : '3px solid transparent',
                        borderRight: sla?.state === 'breached' ? `3px solid ${sla.color}` : sla?.state === 'warning' ? `3px solid ${sla.color}` : '3px solid transparent',
                      }}>
                        <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.title}>{t.title}</td>
                        <td>{t.propertyName}</td>
                        <td className="cell-mono">{t.unitNumber}</td>
                        <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '1px 6px', borderRadius: 3, fontSize: 10, fontWeight: 600, backgroundColor: st.bg || '', color: st.color || 'var(--text)' }}><span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: st.color || 'var(--text-dim)', display: 'inline-block' }} />{t.status}</span></td>
                        <td>{t.aiPriorityOverridden && t.aiPriority ? (
                          <span title={`AI reclassified priority: ${t.aiPriority} (${t.aiPriorityReason || 'no reason'})`} style={{ cursor: 'help' }}>
                            <span style={{ color: 'var(--text-dim)', textDecoration: 'line-through' }}>{t.priority}</span>
                            <FaArrowRight style={{ fontSize: 8, margin: '0 3px', color: 'var(--amber)' }} />
                            <span style={{ color: 'var(--amber)', fontWeight: 600 }}>{t.aiPriority}</span>
                            <FaRobot style={{ marginLeft: 3, color: 'var(--teal)' }} />
                          </span>
                        ) : (
                          <span style={{ padding: '1px 6px', borderRadius: 3, fontSize: 10, fontWeight: 700, backgroundColor: pt.bg || '', color: pt.color || 'var(--text)' }}>{t.priority}</span>
                        )}</td>
                        <td>{t.category || <span style={{ color: 'var(--text-dim)' }}>—</span>}</td>
                        <td>{override ? <span title={`${t.aiOriginalCategory} → ${t.category}`} style={{ cursor: 'help' }}><span style={{ color: 'var(--text-dim)', textDecoration: 'line-through' }}>{t.aiOriginalCategory}</span><FaArrowRight style={{ fontSize: 8, margin: '0 3px', color: 'var(--amber)' }} /><span style={{ color: 'var(--amber)', fontWeight: 600 }}>{t.category}</span></span> : (t.aiOriginalCategory || <span style={{ color: 'var(--text-dim)' }}>—</span>)}</td>
                        <td className="cell-mono">{t.combinedConfidence != null ? <span style={{ color: t.combinedConfidence >= 0.8 ? 'var(--teal)' : t.combinedConfidence >= 0.6 ? 'var(--amber)' : 'var(--danger)', fontWeight: 600 }}>{Math.round(t.combinedConfidence * 100)}%</span> : <span style={{ color: 'var(--text-dim)' }}>—</span>}</td>
                        <td><div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>{t.conflictDetected && <span className="badge badge-danger" style={{ fontSize: 8 }}>CONFLICT</span>}{t.manualReviewRequired && <span className="badge badge-warning" style={{ fontSize: 8 }}>REVIEW</span>}{!t.conflictDetected && !t.manualReviewRequired && <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>—</span>}</div></td>
                        <td style={{ minWidth: 110 }}>
                          <div style={{ height: 4, borderRadius: 2, background: 'var(--border)', marginBottom: 4, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${sla.pctElapsed}%`, background: sla.color, transition: 'width 0.3s' }} />
                          </div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: sla.color }}>
                            {sla.label}
                          </div>
                        </td>
                        <td style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                          {t.assignedTo || '—'}
                          {t.autoAssigned && <div style={{ fontSize: 10, color: 'var(--amber)', fontWeight: 600, marginTop: 2 }}>Auto-assigned by system</div>}
                        </td>
                        <td style={{ fontSize: 10, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{t.createdAt}</td>
                        <td>
                          <div className="action-cell">
                            <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); setShowDetails(t); }} title="View full details"><FaEye /></button>
                            {genericButtons.map(s => <button key={s} className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); handleTransition(t.ticketId, s); }} style={{ fontSize: 9, padding: '2px 5px' }}>{TRANSITION_LABELS[s] || s}</button>)}
                            {tc.includes('Reopened') && <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); setShowReopen(t); setReopenText(''); setReopenError(''); }} style={{ fontSize: 9, padding: '2px 5px' }}><FaUndo /> Reopen</button>}
                            {canAssign && <button className="btn btn-teal btn-sm" onClick={(e) => { e.stopPropagation(); setShowReassign(t); setReassignProvider(''); }}><FaUserCheck /></button>}
                            <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); setShowCategoryModal(t); setCategoryValue(t.category || ''); }}><FaTag /></button>
                            <button className="btn btn-danger btn-sm" onClick={(e) => { e.stopPropagation(); setConfirmDelete(t); }} title="Move to trash"><FaTrash /></button>
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

      {showReassign && (
        <div className="modal" onClick={() => setShowReassign(null)}>
          <div className="edit-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="edit-modal-header"><span><FaUserCheck /> Reassign</span><button className="modal-close-btn" onClick={() => setShowReassign(null)}><FaTimes /></button></div>
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
            <div className="edit-modal-header"><span><FaUndo /> Reopen</span><button className="modal-close-btn" onClick={() => setShowReopen(null)}><FaTimes /></button></div>
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
            <div className="edit-modal-header"><span><FaTag /> Override Category</span><button className="modal-close-btn" onClick={() => setShowCategoryModal(null)}><FaTimes /></button></div>
            <form onSubmit={handleCategoryOverride}>
              {showCategoryModal.aiOriginalCategory && showCategoryModal.aiOriginalCategory !== categoryValue && <p style={{ fontSize: 11, color: 'var(--amber)', marginBottom: 8 }}><FaExclamationTriangle style={{ marginRight: 4 }} />AI originally: <strong>{showCategoryModal.aiOriginalCategory}</strong>. Override logged (BR-006).</p>}
              <div className="form-group"><label>New Category</label><select className="form-select" value={categoryValue} onChange={e => setCategoryValue(e.target.value)} required>{categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
              <div className="form-actions"><button type="button" className="btn btn-secondary" onClick={() => setShowCategoryModal(null)}>Cancel</button><button type="submit" className="btn btn-primary"><FaCheck /> Save Override</button></div>
            </form>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="modal" onClick={() => setConfirmDelete(null)}>
          <div className="edit-modal" onClick={e => e.stopPropagation()}>
            <div className="edit-modal-header"><span><FaTrash /> Move to Trash</span><button className="modal-close-btn" onClick={() => setConfirmDelete(null)}><FaTimes /></button></div>
            <p style={{ fontSize: 13 }}>Move ticket <strong>{confirmDelete.title}</strong> ({confirmDelete.ticketId}) to trash?</p>
            <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>It can be restored later from the Trash view.</p>
            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => handleDelete(confirmDelete)}><FaTrash /> Move to Trash</button>
            </div>
          </div>
        </div>
      )}

      {showTrash && (
        <div className="modal" onClick={() => setShowTrash(false)}>
          <div className="edit-modal" onClick={e => e.stopPropagation()} style={{ width: 640, maxWidth: '92vw' }}>
            <div className="edit-modal-header"><span><FaTrash /> Ticket Trash</span><button className="modal-close-btn" onClick={() => setShowTrash(false)}><FaTimes /></button></div>
            <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
              {loadingTrash ? (
                <p className="empty-text" style={{ padding: 24, textAlign: 'center' }}>Loading...</p>
              ) : trashTickets.length === 0 ? (
                <p className="empty-text" style={{ padding: 24, textAlign: 'center' }}>Trash is empty.</p>
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr><th>Title</th><th>Status</th><th>Priority</th><th>Deleted</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {trashTickets.map(t => (
                      <tr key={t.ticketId}>
                        <td style={{ fontSize: 12 }}>{t.title}</td>
                        <td style={{ fontSize: 12 }}>{t.status}</td>
                        <td style={{ fontSize: 12 }}>{t.priority}</td>
                        <td style={{ fontSize: 11, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{t.deletedAt || '—'}</td>
                        <td>
                          <button className="btn btn-teal btn-sm" onClick={() => handleRestore(t)} title="Restore" style={{ fontSize: 9, padding: '2px 6px' }}><FaUndo /> Restore</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {showDetails && (() => {
        const t = showDetails;
        const dtSt = STATUS_STYLES[t.status] || {};
        const dtPt = PRIORITY_STYLES[t.priority] || {};
        const dtSla = getSlaStatus(t);
        const dtOverride = t.aiOriginalCategory && t.category && t.aiOriginalCategory !== t.category;
        const ticketAudit = auditLogs.filter(l => l.ticketId === t.ticketId);
        const ticketInferences = inferenceLogs.filter(l => l.ticketId === t.ticketId);
        return (
          <div className="modal" onClick={() => setShowDetails(null)}>
            <div className="edit-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 680 }}>
              <div className="edit-modal-header">
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FaTicketAlt /> Ticket
                  <span style={{ padding: '1px 6px', borderRadius: 3, fontSize: 10, fontWeight: 600, backgroundColor: dtSt.bg || '', color: dtSt.color || 'var(--text)' }}>{t.status}</span>
                  <span style={{ padding: '1px 6px', borderRadius: 3, fontSize: 10, fontWeight: 700, backgroundColor: dtPt.bg || '', color: dtPt.color || 'var(--text)' }}>{t.priority}</span>
                </span>
                <button className="modal-close-btn" onClick={() => setShowDetails(null)}><FaTimes /></button>
              </div>
              <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, fontWeight: 600 }}>Title</label>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{t.title}</div>
                </div>
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, fontWeight: 600 }}>Ticket ID</label>
                  <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-mid)' }}>{t.ticketId}</div>
                </div>
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, fontWeight: 600 }}>Description</label>
                  <p style={{ margin: '4px 0', color: 'var(--text-dim)', whiteSpace: 'pre-wrap', fontSize: 13 }}>{t.description}</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: 12, marginBottom: 12 }}>
                  <div><FaBuilding style={{ marginRight: 4, fontSize: 10 }} /> <strong>Property:</strong> {t.propertyName || '—'}</div>
                  <div><FaBox style={{ marginRight: 4, fontSize: 10 }} /> <strong>Unit:</strong> {t.unitNumber ? `Unit ${t.unitNumber}` : '—'}</div>
                  <div><FaUser style={{ marginRight: 4, fontSize: 10 }} /> <strong>Submitted by:</strong> {t.createdBy || '—'}</div>
                  <div><FaCalendarAlt style={{ marginRight: 4, fontSize: 10 }} /> <strong>Created:</strong> {t.createdAt || '—'}</div>
                  <div><FaCalendarAlt style={{ marginRight: 4, fontSize: 10 }} /> <strong>Updated:</strong> {t.updatedAt || '—'}</div>
                  <div><FaUserCheck style={{ marginRight: 4, fontSize: 10 }} /> <strong>Assigned to:</strong> {t.assignedTo || '—'}
                    {t.autoAssigned && <span style={{ fontSize: 10, color: 'var(--amber)', fontWeight: 600, marginLeft: 6 }}>Auto-assigned by system</span>}</div>
                  <div><FaCalendarAlt style={{ marginRight: 4, fontSize: 10 }} /> <strong>Postponed until:</strong> {t.postponedUntil ? new Date(t.postponedUntil).toLocaleString() : '—'}</div>
                  <div><FaTag style={{ marginRight: 4, fontSize: 10 }} /> <strong>Category:</strong> {t.category || '—'}</div>
                  <div><FaBrain style={{ marginRight: 4, fontSize: 10 }} /> <strong>AI original:</strong> {t.aiOriginalCategory ? <span>{t.aiOriginalCategory} {dtOverride && <span style={{ color: 'var(--amber)' }}>(overridden)</span>}</span> : '—'}</div>
                  <div><FaBrain style={{ marginRight: 4, fontSize: 10 }} /> <strong>Confidence:</strong> {t.combinedConfidence != null ? `${Math.round(t.combinedConfidence * 100)}%` : '—'}</div>
                  <div><FaExclamationTriangle style={{ marginRight: 4, fontSize: 10 }} /> <strong>SLA:</strong> <span style={{ color: dtSla.color }}>{dtSla.label}</span></div>
                </div>
                {t.conflictDetected && <div className="alert alert-error" style={{ fontSize: 11, padding: '6px 10px', marginBottom: 12 }}><FaExclamationTriangle style={{ marginRight: 4 }} />AI conflict detected — manual review recommended.</div>}
                {t.status === 'Declined' && (
                  <div className="alert alert-warning" style={{ fontSize: 11, padding: '6px 10px', marginBottom: 12 }}>
                    <FaExclamationTriangle style={{ marginRight: 4 }} />Declined by the provider.
                    {t.postponedUntil ? <span> Postponed until <strong>{new Date(t.postponedUntil).toLocaleString()}</strong>.</span> : ' No postponement date set.'}
                    {t.postponedReason ? <span> Reason: <em>{t.postponedReason}</em></span> : null}
                  </div>
                )}
                {t.acceptanceNote && (
                  <div className="alert" style={{ fontSize: 11, padding: '6px 10px', marginBottom: 12, background: 'rgba(0,150,136,0.08)', borderColor: 'rgba(0,150,136,0.35)' }}>
                    <FaCommentDots style={{ marginRight: 4, color: 'var(--teal)' }} />Message from provider when accepting: <em>"{t.acceptanceNote}"</em>
                  </div>
                )}
                {t.images && t.images.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <strong style={{ fontSize: 11 }}>Attachments ({t.images.length})</strong>
                    <div className="image-preview-grid" style={{ marginTop: 4 }}>
                      {t.images.map((img, idx) => <div key={idx} className="image-preview" style={{ width: 72, height: 72, cursor: 'pointer' }} onClick={() => setLightboxImg(img.data || img)}><img src={img.data || img} alt={`Attachment ${idx + 1}`} /></div>)}
                    </div>
                  </div>
                )}
                <div style={{ marginBottom: 12 }}>
                  <strong style={{ fontSize: 11 }}>Audit Trail</strong>
                  {ticketAudit.length > 0 ? ticketAudit.map(l => (
                    <div key={l.id} style={{ padding: '3px 0', fontSize: 11, color: 'var(--text-dim)', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ color: 'var(--text)' }}>{l.actor}</span> — {l.action}: {l.comment}
                      <span style={{ float: 'right' }}>{new Date(l.timestamp).toLocaleString()}</span>
                    </div>
                  )) : <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>No audit entries.</div>}
                </div>
                <div style={{ marginBottom: 12 }}>
                  <strong style={{ fontSize: 11 }}>AI Inferences</strong>
                  {ticketInferences.length > 0 ? ticketInferences.map(l => (
                    <div key={l.id} style={{ padding: '3px 0', fontSize: 11, color: 'var(--text-dim)' }}>
                      <FaBrain style={{ fontSize: 8, marginRight: 3 }} />{l.adapter} ({l.inputType}): {Math.round(l.confidence * 100)}% → {l.result}{l.conflictDetected && <span className="badge badge-danger" style={{ fontSize: 7, marginLeft: 4 }}>CONFLICT</span>}
                    </div>
                  )) : <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>No AI inference data.</div>}
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowDetails(null)}><FaEye /> Close</button>
              </div>
            </div>
          </div>
        );
      })()}
      <ImageLightbox src={lightboxImg} onClose={() => setLightboxImg(null)} />
    </div>
  );
};

export default Tickets;
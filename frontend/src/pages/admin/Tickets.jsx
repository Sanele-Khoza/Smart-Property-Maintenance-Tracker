import React, { useState } from 'react';
import {
  FaTicketAlt, FaSearch, FaEye, FaEdit, FaUndo, FaUserCheck, FaTag,
  FaExclamationTriangle, FaCheck, FaTimes, FaArrowRight, FaPlus,
  FaChartBar, FaBrain, FaHistory, FaFilter, FaRedo, FaExchangeAlt, FaTrash
} from 'react-icons/fa';
import {
  getTicketById, updateTicketStatus, assignTicket, reopenTicket,
  updateTicketCategory, getProviders, getProperties, getCategories,
  getAuditLogs, getInferenceLogs, trashTicket, restoreTicket, getTrashTickets
} from '../../data/store';
import { getSlaStatus } from '../../data/slaEngine';
import Alert from '../../components/common/Alert';
import ImageLightbox from '../../components/common/ImageLightbox';
import useTickets from '../../hooks/useTickets';

const STATUS_STYLES = {
  'New':                { bg: 'rgba(100,120,150,0.15)', color: '#8a9bb5' },
  'AI Classified':      { bg: 'rgba(100,120,150,0.15)', color: '#8a9bb5' },
  'Manual Review':      { bg: 'rgba(240,180,50,0.15)',  color: '#f0b432' },
  'Assigned':           { bg: 'rgba(50,120,220,0.15)',  color: '#3278dc' },
  'Accepted':           { bg: 'rgba(50,120,220,0.15)',  color: '#3278dc' },
  'In Progress':        { bg: 'rgba(45,183,145,0.15)',  color: '#2db791' },
  'Waiting for Parts':  { bg: 'rgba(130,80,200,0.15)',  color: '#8250c8' },
  'Completed':          { bg: 'rgba(45,183,145,0.15)',  color: '#2db791' },
  'Tenant Confirmed':   { bg: 'rgba(45,183,145,0.15)',  color: '#2db791' },
  'Closed':             { bg: 'rgba(120,120,130,0.15)',  color: '#787882' },
  'Cancelled':          { bg: 'rgba(120,120,130,0.15)',  color: '#787882' },
  'Archived':           { bg: 'rgba(120,120,130,0.15)',  color: '#787882' },
  'On Hold':            { bg: 'rgba(240,180,50,0.15)',   color: '#f0b432' },
  'Reopened':           { bg: 'rgba(230,140,30,0.15)',   color: '#e68c1e' },
  'Escalated':          { bg: 'rgba(220,60,60,0.15)',    color: '#dc3c3c' },
};

const PRIORITY_STYLES = {
  URGENT: { bg: 'rgba(220,60,60,0.15)', color: '#dc3c3c' },
  HIGH:   { bg: 'rgba(240,180,50,0.15)', color: '#f0b432' },
  MEDIUM: { bg: 'rgba(50,120,220,0.15)', color: '#3278dc' },
  LOW:    { bg: 'rgba(120,120,130,0.15)', color: '#787882' },
};

const TICKET_TRANSITIONS = {
  'New':                ['AI Classified', 'Manual Review', 'Cancelled'],
  'AI Classified':      ['Assigned', 'Manual Review', 'Cancelled'],
  'Manual Review':      ['AI Classified', 'Cancelled'],
  'Assigned':           ['Accepted', 'Cancelled', 'On Hold', 'Escalated'],
  'Accepted':           ['In Progress', 'Cancelled', 'On Hold'],
  'In Progress':        ['Waiting for Parts', 'Completed', 'On Hold', 'Escalated'],
  'Waiting for Parts':  ['In Progress', 'On Hold'],
  'Completed':          ['Tenant Confirmed', 'Reopened'],
  'Tenant Confirmed':   ['Closed'],
  'Closed':             [],
  'Cancelled':          ['Archived'],
  'Archived':           ['Reopened'],
  'On Hold':            ['In Progress', 'Cancelled'],
  'Reopened':           ['Assigned', 'In Progress', 'Cancelled'],
  'Escalated':          ['Manual Review', 'Assigned'],
};

const TRANSITION_LABELS = {
  'AI Classified': 'AI', 'Manual Review': 'Review', 'Assigned': 'Assign',
  'Accepted': 'Accept', 'In Progress': 'Progress',
  'Waiting for Parts': 'Wait Parts', 'Completed': 'Complete',
  'Tenant Confirmed': 'Confirm', 'Closed': 'Close', 'Cancelled': 'Cancel',
  'Archived': 'Archive', 'On Hold': 'Hold', 'Reopened': 'Reopen', 'Escalated': 'Escalate',
};

const Tickets = () => {
  const [tickets, refresh] = useTickets();
  const [providers] = useState(getProviders);
  const [properties] = useState(getProperties);
  const [categories] = useState(getCategories());
  const [auditLogs] = useState(getAuditLogs());
  const [inferenceLogs] = useState(getInferenceLogs());
  const [alert, setAlert] = useState({ msg: '', type: '' });
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [propertyFilter, setPropertyFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchText, setSearchText] = useState('');
  const [expandedRows, setExpandedRows] = useState({});
  const [showReassign, setShowReassign] = useState(null);
  const [reassignProvider, setReassignProvider] = useState('');
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

  const showAlert = (msg, type) => {
    setAlert({ msg, type });
    setTimeout(() => setAlert({ msg: '', type: '' }), 5000);
  };

  const openTrash = async () => {
    setShowTrash(true);
    setLoadingTrash(true);
    setTrashTickets(await getTrashTickets());
    setLoadingTrash(false);
  };

  const handleDelete = async (ticket) => {
    const r = await trashTicket(ticket.ticketId);
    if (r.success) {
      showAlert(`Ticket moved to trash.`, 'success');
      setConfirmDelete(null);
      refresh();
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
      refresh();
    } else {
      showAlert(r.error, 'error');
    }
  };

  const filtered = tickets.filter(t => {
    if (statusFilter && t.status !== statusFilter) return false;
    if (priorityFilter && t.priority !== priorityFilter) return false;
    if (propertyFilter && t.propertyName !== propertyFilter) return false;
    if (categoryFilter && t.category !== categoryFilter) return false;
    if (searchText && !t.title.toLowerCase().includes(searchText.toLowerCase()) && t.ticketId.toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const slaBreached = tickets.filter(t => getSlaStatus(t)?.state === 'breached').length;

  const stats = [
    { label: 'Total', value: tickets.length, icon: FaTicketAlt },
    { label: 'New', value: tickets.filter(t => t.status === 'New').length, icon: FaTicketAlt },
    { label: 'Manual Review', value: tickets.filter(t => t.status === 'Manual Review').length, icon: FaBrain },
    { label: 'In Progress', value: tickets.filter(t => t.status === 'In Progress').length, icon: FaRedo },
    { label: 'Conflict', value: tickets.filter(t => t.conflictDetected).length, icon: FaExclamationTriangle },
    { label: 'SLA Breached', value: slaBreached, icon: FaExclamationTriangle },
  ];

  const uniqueStatuses = [...new Set(tickets.map(t => t.status))].sort();
  const uniqueCategories = [...new Set(tickets.filter(t => t.category).map(t => t.category))].sort();
  const uniqueProperties = [...new Set(tickets.filter(t => t.propertyName).map(t => t.propertyName))].sort();

  const handleTransition = async (ticketId, newStatus) => {
    const r = await updateTicketStatus(ticketId, newStatus);
    if (r.success) {
      showAlert(`Status updated to ${newStatus}`, 'success');
      refresh();
    } else {
      showAlert(r.error, 'error');
    }
  };

  const handleReassign = async (e) => {
    e.preventDefault();
    if (!reassignProvider) return;
    const prov = providers.find(p => p.name === reassignProvider);
    const r = await assignTicket(showReassign.ticketId, reassignProvider, prov?.id);
    if (r.success) {
      showAlert(`Ticket reassigned to ${reassignProvider}`, 'success');
      setShowReassign(null);
      refresh();
    } else {
      showAlert(r.error, 'error');
    }
  };

  const handleReopen = async (e) => {
    e.preventDefault();
    if (reopenText.trim().length < 10) {
      setReopenError('Justification must be at least 10 characters. (REQ-041)');
      return;
    }
    const r = await reopenTicket(showReopen.ticketId, reopenText.trim());
    if (r.success) {
      showAlert('Ticket reopened.', 'success');
      setShowReopen(null);
      refresh();
    } else {
      setReopenError(r.error);
    }
  };

  const handleCategoryOverride = async (e) => {
    e.preventDefault();
    const r = await updateTicketCategory(showCategoryModal.ticketId, categoryValue);
    if (r.success) {
      showAlert(`Category override saved (BR-006)`, 'success');
      setShowCategoryModal(null);
      refresh();
    } else {
      showAlert(r.error, 'error');
    }
  };

  const toggleExpand = (id) => setExpandedRows(p => ({ ...p, [id]: !p[id] }));

  return (
    <div>
      <div className="card">
        <div className="card-title">
          <span><FaTicketAlt /> Tickets <span className="req-ref">MOD-003 / MOD-007 / REQ-026-027 / REQ-041</span></span>
        </div>
        <Alert msg={alert.msg} type={alert.type} />
        <div className="stat-grid">
          {stats.map((s, i) => (
            <div className="stat-card" key={i} style={s.label === 'SLA Breached' && s.value > 0 ? { borderLeftColor: 'var(--danger)' } : {}}>
              <div className="stat-value" style={s.label === 'SLA Breached' && s.value > 0 ? { color: 'var(--danger)' } : {}}><s.icon /> {s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <span><FaTicketAlt /> All Tickets</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <FaSearch style={{ color: 'var(--text-dim)' }} />
            <input className="form-input" style={{ width: 140, padding: '4px 8px', fontSize: 12 }} placeholder="Search ID/title..." value={searchText} onChange={e => setSearchText(e.target.value)} />
            <select className="form-select" style={{ width: 'auto', minWidth: 100, fontSize: 12, padding: '4px 8px' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              {uniqueStatuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="form-select" style={{ width: 'auto', minWidth: 90, fontSize: 12, padding: '4px 8px' }} value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
              <option value="">All Priorities</option>
              <option value="URGENT">URGENT</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>
            <select className="form-select" style={{ width: 'auto', minWidth: 100, fontSize: 12, padding: '4px 8px' }} value={propertyFilter} onChange={e => setPropertyFilter(e.target.value)}>
              <option value="">All Properties</option>
              {uniqueProperties.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select className="form-select" style={{ width: 'auto', minWidth: 100, fontSize: 12, padding: '4px 8px' }} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
              <option value="">All Categories</option>
              {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button className="btn btn-secondary btn-sm" onClick={openTrash} title="Trash" style={{ fontSize: 11 }}><FaTrash /> Trash</button>
          </div>
        </div>
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Title</th>
                <th scope="col">Property</th>
                <th scope="col">Unit</th>
                <th scope="col">Status</th>
                <th scope="col">Priority</th>
                <th scope="col">Category</th>
                <th scope="col">AI Orig.</th>
                <th scope="col">Conf.</th>
                <th scope="col">Badges</th>
                <th scope="col">SLA</th>
                <th scope="col">Assigned</th>
                <th scope="col">Created</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan="13" className="empty-text" style={{ textAlign: 'center', padding: 24 }}>No tickets match the current filter.</td></tr>
              ) : (
                filtered.map(t => {
                  const st = STATUS_STYLES[t.status] || {};
                  const pt = PRIORITY_STYLES[t.priority] || {};
                  const canAssign = ['New', 'AI Classified', 'Manual Review', 'Reopened', 'Escalated'].includes(t.status);
                  const canReopen = ['Completed', 'Archived'].includes(t.status);
                  const tc = TICKET_TRANSITIONS[t.status] || [];
                  const override = t.aiOriginalCategory && t.category && t.aiOriginalCategory !== t.category;
                  const expanded = expandedRows[t.ticketId];

                  return (
                  <React.Fragment key={t.ticketId}>
                  <tr>
                    <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.title}>{t.title}</td>
                    <td>{t.propertyName}</td>
                    <td className="cell-mono">{t.unitNumber}</td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '1px 6px', borderRadius: 3, fontSize: 10, fontWeight: 600, backgroundColor: st.bg || 'rgba(100,100,100,0.1)', color: st.color || 'var(--text)' }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: st.color || 'var(--text-dim)', display: 'inline-block' }} />
                        {t.status}
                      </span>
                    </td>
                    <td>
                      <span style={{ display: 'inline-block', padding: '1px 6px', borderRadius: 3, fontSize: 10, fontWeight: 700, backgroundColor: pt.bg || 'rgba(100,100,100,0.1)', color: pt.color || 'var(--text)' }}>
                        {t.priority}
                      </span>
                    </td>
                    <td>{t.category || <span style={{ color: 'var(--text-dim)' }}>—</span>}</td>
                    <td>
                      {override ? (
                        <span title={`PM override: ${t.aiOriginalCategory} → ${t.category} (BR-006)`} style={{ cursor: 'help' }}>
                          <span style={{ color: 'var(--text-dim)', textDecoration: 'line-through' }}>{t.aiOriginalCategory}</span>
                          <FaArrowRight style={{ fontSize: 8, margin: '0 3px', color: 'var(--amber)' }} />
                          <span style={{ color: 'var(--amber)', fontWeight: 600 }}>{t.category}</span>
                        </span>
                      ) : (
                        t.aiOriginalCategory || <span style={{ color: 'var(--text-dim)' }}>—</span>
                      )}
                    </td>
                    <td className="cell-mono">
                      {t.combinedConfidence != null ? (
                        <span style={{ color: t.combinedConfidence >= 0.8 ? 'var(--teal)' : t.combinedConfidence >= 0.6 ? 'var(--amber)' : 'var(--danger)', fontWeight: 600 }}>
                          {Math.round(t.combinedConfidence * 100)}%
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-dim)' }}>—</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                        {t.conflictDetected && <span className="badge badge-danger" style={{ fontSize: 8, whiteSpace: 'nowrap' }}>CONFLICT</span>}
                        {t.manualReviewRequired && <span className="badge badge-warning" style={{ fontSize: 8, whiteSpace: 'nowrap' }}>REVIEW</span>}
                        {!t.conflictDetected && !t.manualReviewRequired && <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>—</span>}
                      </div>
                    </td>
                    <td>
                      {(() => {
                        const sla = getSlaStatus(t);
                        if (!sla) return <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>—</span>;
                        const bg = sla.state === 'breached' ? 'rgba(220,60,60,0.15)' : sla.state === 'warning' ? 'rgba(240,180,50,0.15)' : 'rgba(45,183,145,0.15)';
                        return <span style={{ display: 'inline-block', padding: '1px 5px', borderRadius: 3, fontSize: 9, fontWeight: 600, backgroundColor: bg, color: sla.color, whiteSpace: 'nowrap' }}>{sla.label}</span>;
                      })()}
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                          {t.assignedTo || '—'}
                          {t.autoAssigned && <div style={{ fontSize: 10, color: 'var(--amber)', fontWeight: 600, marginTop: 2 }}>Auto-assigned by system</div>}
                        </td>
                    <td style={{ fontSize: 10, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{t.createdAt}</td>
                    <td>
                      <div className="action-cell">
                        <button className="btn btn-secondary btn-sm" onClick={() => toggleExpand(t.ticketId)} title="Details" aria-label="Details"><FaEye /></button>
                        {tc.filter(s => s !== 'Reopened').map(s => (
                          <button key={s} className="btn btn-secondary btn-sm" onClick={() => handleTransition(t.ticketId, s)} title={s} style={{ fontSize: 9, padding: '2px 5px' }}>
                            {TRANSITION_LABELS[s] || s}
                          </button>
                        ))}
                        {tc.includes('Reopened') && (
                          <button className="btn btn-secondary btn-sm" onClick={() => { setShowReopen(t); setReopenText(''); setReopenError(''); }} title="Reopen" style={{ fontSize: 9, padding: '2px 5px' }}>
                            <FaUndo /> Reopen
                          </button>
                        )}
                        {canAssign && (
                          <button className="btn btn-teal btn-sm" onClick={() => { setShowReassign(t); setReassignProvider(''); }} title="Reassign" style={{ fontSize: 9, padding: '2px 5px' }}>
                            <FaUserCheck />
                          </button>
                        )}
                        <button className="btn btn-secondary btn-sm" onClick={() => { setShowCategoryModal(t); setCategoryValue(t.category || ''); }} title="Override category" style={{ fontSize: 9, padding: '2px 5px' }}>
                          <FaTag />
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(t)} title="Move to trash" style={{ fontSize: 9, padding: '2px 5px' }}>
                          <FaTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="expanded-row">
                      <td colSpan="13" style={{ padding: '8px 16px', backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', gap: 24, fontSize: 12, flexWrap: 'wrap' }}>
                          <div style={{ flex: 2, minWidth: 240 }}>
                            <div style={{ marginBottom: 6 }}><strong>Ticket ID:</strong> <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{t.ticketId}</span></div>
                            <strong>Description:</strong>
                            <p style={{ margin: '4px 0', color: 'var(--text-dim)', whiteSpace: 'pre-wrap' }}>{t.description}</p>
                            {t.images && t.images.length > 0 && (
                              <>
                                <strong style={{ marginTop: 8, display: 'block' }}>Attachments ({t.images.length}):</strong>
                                <div className="image-preview-grid" style={{ marginTop: 4 }}>
                                  {t.images.map((img, idx) => (
                                    <div
                                      key={idx}
                                      className="image-preview"
                                      style={{ width: 72, height: 72, cursor: 'pointer' }}
                                      onClick={() => setLightboxImg(img.data || img)}
                                    >
                                      <img src={img.data || img} alt={`Attachment ${idx + 1}`} />
                                    </div>
                                  ))}
                                </div>
                              </>
                            )}
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
                            {inferenceLogs.filter(l => l.ticketId === t.ticketId).map(l => (
                              <div key={l.id} style={{ padding: '2px 0', fontSize: 10, color: 'var(--text-dim)' }}>
                                <FaBrain style={{ fontSize: 8, marginRight: 3 }} />
                                {l.adapter} ({l.inputType}): {Math.round(l.confidence * 100)}% → {l.result}
                                {l.conflictDetected && <span className="badge badge-danger" style={{ fontSize: 7, marginLeft: 4 }}>CONFLICT</span>}
                              </div>
                            ))}
                            {inferenceLogs.filter(l => l.ticketId === t.ticketId).length === 0 && (
                              <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>No AI inference data</span>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
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
          <div className="edit-modal" onClick={e => e.stopPropagation()}>
            <div className="edit-modal-header">
              <span><FaUserCheck /> Reassign</span>
              <button className="modal-close-btn" onClick={() => setShowReassign(null)} aria-label="Close reassign modal"><FaTimes /></button>
            </div>
            <form onSubmit={handleReassign}>
              <div className="form-group">
                <label className="form-label">Provider</label>
                <select className="form-select" value={reassignProvider} onChange={e => setReassignProvider(e.target.value)} required>
                  <option value="">Select a provider</option>
                  {providers.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowReassign(null)}>Cancel</button>
                <button type="submit" className="btn btn-teal"><FaUserCheck /> Assign</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showReopen && (
        <div className="modal" onClick={() => setShowReopen(null)}>
          <div className="edit-modal" onClick={e => e.stopPropagation()}>
            <div className="edit-modal-header">
              <span><FaUndo /> Reopen</span>
              <button className="modal-close-btn" onClick={() => setShowReopen(null)} aria-label="Close reopen modal"><FaTimes /></button>
            </div>
            <form onSubmit={handleReopen}>
              {reopenError && <Alert msg={reopenError} type="error" />}
              <div className="form-group">
                <label className="form-label">Justification <span style={{ color: 'var(--danger)', fontSize: 10 }}>≥10 chars required (REQ-041)</span></label>
                <textarea className="form-input" rows={3} value={reopenText} onChange={e => setReopenText(e.target.value)} placeholder="Explain why this ticket needs to be reopened..." required />
                <div style={{ fontSize: 10, marginTop: 4, color: reopenText.trim().length >= 10 ? 'var(--teal)' : 'var(--text-dim)' }}>
                  {reopenText.trim().length}/10 characters
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowReopen(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={reopenText.trim().length < 10}><FaUndo /> Reopen</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCategoryModal && (
        <div className="modal" onClick={() => setShowCategoryModal(null)}>
          <div className="edit-modal" onClick={e => e.stopPropagation()}>
            <div className="edit-modal-header">
              <span><FaTag /> Override Category</span>
              <button className="modal-close-btn" onClick={() => setShowCategoryModal(null)} aria-label="Close category modal"><FaTimes /></button>
            </div>
            <form onSubmit={handleCategoryOverride}>
              {showCategoryModal.aiOriginalCategory && showCategoryModal.aiOriginalCategory !== categoryValue && (
                <p style={{ fontSize: 11, color: 'var(--amber)', marginBottom: 8 }}>
                  <FaExclamationTriangle style={{ marginRight: 4 }} />
                  AI originally classified as <strong>{showCategoryModal.aiOriginalCategory}</strong>. Override will be logged (BR-006).
                </p>
              )}
              <div className="form-group">
                <label className="form-label">New Category</label>
                <select className="form-select" value={categoryValue} onChange={e => setCategoryValue(e.target.value)} required>
                  {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCategoryModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary"><FaCheck /> Save Override</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="modal" onClick={() => setConfirmDelete(null)}>
          <div className="edit-modal" onClick={e => e.stopPropagation()}>
            <div className="edit-modal-header">
              <span><FaTrash /> Move to Trash</span>
              <button className="modal-close-btn" onClick={() => setConfirmDelete(null)} aria-label="Close delete modal"><FaTimes /></button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text)' }}>
              Move ticket <strong>{confirmDelete.title}</strong> ({confirmDelete.ticketId}) to trash?
            </p>
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
            <div className="edit-modal-header">
              <span><FaTrash /> Ticket Trash</span>
              <button className="modal-close-btn" onClick={() => setShowTrash(false)} aria-label="Close trash modal"><FaTimes /></button>
            </div>
            <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
              {loadingTrash ? (
                <p className="empty-text" style={{ padding: 24, textAlign: 'center' }}>Loading...</p>
              ) : trashTickets.length === 0 ? (
                <p className="empty-text" style={{ padding: 24, textAlign: 'center' }}>Trash is empty.</p>
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th scope="col">Title</th>
                      <th scope="col">Status</th>
                      <th scope="col">Priority</th>
                      <th scope="col">Deleted</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trashTickets.map(t => (
                      <tr key={t.ticketId}>
                        <td style={{ fontSize: 12 }}>{t.title}</td>
                        <td style={{ fontSize: 12 }}>{t.status}</td>
                        <td style={{ fontSize: 12 }}>{t.priority}</td>
                        <td style={{ fontSize: 11, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{t.deletedAt || '—'}</td>
                        <td>
                          <button className="btn btn-teal btn-sm" onClick={() => handleRestore(t)} title="Restore" style={{ fontSize: 9, padding: '2px 6px' }}>
                            <FaUndo /> Restore
                          </button>
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
      <ImageLightbox src={lightboxImg} onClose={() => setLightboxImg(null)} />
    </div>
  );
};

export default Tickets;
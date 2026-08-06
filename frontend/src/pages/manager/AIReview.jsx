import React, { useState, useMemo } from 'react';
import { FaBrain, FaExclamationTriangle, FaCheck, FaTimes, FaArrowRight, FaEye, FaTag, FaUserCheck, FaUndo, FaSearch } from 'react-icons/fa';
import { getTickets, getTicketById, updateTicketCategory, getCategories, getInferenceLogs, getAuditLogs, getProperties } from '../../data/store';
import { getSession } from '../../data/authStore';
import Alert from '../../components/common/Alert';

const STATUS_STYLES = {
  'New': { bg: 'rgba(100,120,150,0.15)', color: '#8a9bb5' },
  'Manual Review': { bg: 'rgba(240,180,50,0.15)', color: '#f0b432' },
  'CONFLICT': { bg: 'rgba(220,60,60,0.15)', color: '#dc3c3c' },
};

const AIReview = () => {
  const session = getSession();
  const pmName = session ? `${session.name} ${session.surname}` : '';
  const [allProperties] = useState(getProperties);
  const [allTickets] = useState(() => getTickets().filter(t => t.conflictDetected || t.manualReviewRequired));
  const propNames = useMemo(() => new Set(allProperties.filter(p => p.managerName === pmName).map(p => p.name)), [allProperties, pmName]);
  const tickets = useMemo(() => allTickets.filter(t => propNames.has(t.propertyName)), [allTickets, propNames]);
  const [categories] = useState(getCategories());
  const [inferenceLogs] = useState(getInferenceLogs());
  const [auditLogs] = useState(getAuditLogs());
  const [alert, setAlert] = useState({ msg: '', type: '' });
  const [searchText, setSearchText] = useState('');
  const [expandedRows, setExpandedRows] = useState({});
  const [showCategoryModal, setShowCategoryModal] = useState(null);
  const [categoryValue, setCategoryValue] = useState('');

  const showAlert = (msg, type) => { setAlert({ msg, type }); setTimeout(() => setAlert({ msg: '', type: '' }), 5000); };

  const filtered = tickets.filter(t => {
    if (searchText && !t.title.toLowerCase().includes(searchText.toLowerCase()) && !t.ticketId.toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const handleCategoryOverride = async (e) => {
    e.preventDefault();
    const r = await updateTicketCategory(showCategoryModal.ticketId, categoryValue);
    if (r.success) { showAlert(`Category override saved (BR-006)`, 'success'); setShowCategoryModal(null); }
    else showAlert(r.error, 'error');
  };

  const stats = [
    { label: 'Needs Review', value: tickets.length, icon: FaBrain },
    { label: 'Conflict', value: tickets.filter(t => t.conflictDetected).length, icon: FaExclamationTriangle },
    { label: 'Manual Review', value: tickets.filter(t => t.manualReviewRequired).length, icon: FaEye },
  ];

  return (
    <div>
      <div className="card">
        <div className="card-title"><span><FaBrain /> AI Review Queue <span className="req-ref">UC-002 / REQ-024-028</span></span></div>
        <Alert msg={alert.msg} type={alert.type} />
        <div className="stat-grid">{stats.map((s, i) => (<div className="stat-card" key={i}><div className="stat-value"><s.icon /> {s.value}</div><div className="stat-label">{s.label}</div></div>))}</div>
      </div>
      <div className="card">
        <div className="card-title">
          <span><FaBrain /> Tickets Requiring AI Review</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <FaSearch style={{ color: 'var(--text-dim)' }} />
            <input className="form-input" style={{ width: 140, fontSize: 12, padding: '4px 8px' }} placeholder="Search..." value={searchText} onChange={e => setSearchText(e.target.value)} />
          </div>
        </div>
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead><tr><th>ID</th><th>Title</th><th>Status</th><th>Priority</th><th>AI Orig.</th><th>Category</th><th>Conf.</th><th>Issue</th><th>AI Inferences</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.length === 0 ? <tr><td colSpan="10" style={{ textAlign: 'center', padding: 24, color: 'var(--text-dim)' }}>No tickets require AI review.</td></tr> : (
                filtered.map(t => {
                  const isConflict = t.conflictDetected;
                  const isReview = t.manualReviewRequired;
                  const infs = inferenceLogs.filter(l => l.ticketId === t.ticketId);
                  return (
                    <React.Fragment key={t.ticketId}>
                      <tr style={{ backgroundColor: isConflict ? 'rgba(220,60,60,0.03)' : 'rgba(240,180,50,0.03)' }}>
                        <td className="cell-mono">{t.ticketId}</td>
                        <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</td>
                        <td><span style={STATUS_STYLES[t.status] || STATUS_STYLES.Open}>{t.status}</span></td>
                        <td><span className={`badge ${t.priority === 'URGENT' ? 'badge-danger' : t.priority === 'HIGH' ? 'badge-warning' : t.priority === 'MEDIUM' ? 'badge-info' : 'badge-completed'}`}>{t.priority}</span></td>
                        <td style={{ color: 'var(--text-dim)' }}>{t.aiOriginalCategory || '—'}</td>
                        <td>{t.category || <span style={{ color: 'var(--text-dim)' }}>—</span>}</td>
                        <td className="cell-mono" style={{ color: t.combinedConfidence >= 0.8 ? 'var(--teal)' : t.combinedConfidence >= 0.6 ? 'var(--amber)' : 'var(--danger)', fontWeight: 600 }}>{t.combinedConfidence != null ? `${Math.round(t.combinedConfidence * 100)}%` : '—'}</td>
                        <td>{isConflict ? <span className="badge badge-danger" style={{ fontSize: 9 }}>CONFLICT</span> : <span className="badge badge-warning" style={{ fontSize: 9 }}>REVIEW</span>}</td>
                        <td style={{ fontSize: 10 }}>
                          {infs.length > 0 ? infs.map((l, i) => (
                            <div key={i} style={{ padding: '1px 0' }}>
                              <span style={{ fontWeight: 600 }}>{l.adapter}</span>: {Math.round(l.confidence * 100)}% → {l.result}
                              {l.latencyMs && <span style={{ color: 'var(--text-dim)' }}> ({l.latencyMs}ms)</span>}
                            </div>
                          )) : <span style={{ color: 'var(--text-dim)' }}>No data</span>}
                        </td>
                        <td>
                          <div className="action-cell">
                            <button className="btn btn-secondary btn-sm" onClick={() => setExpandedRows(p => ({ ...p, [t.ticketId]: !p[t.ticketId] }))}><FaEye /></button>
                            <button className="btn btn-secondary btn-sm" onClick={() => { setShowCategoryModal(t); setCategoryValue(t.category || ''); }}><FaTag /></button>
                          </div>
                        </td>
                      </tr>
                      {expandedRows[t.ticketId] && (
                        <tr className="expanded-row"><td colSpan="10" style={{ padding: '8px 16px', backgroundColor: 'var(--surface)' }}>
                          <div style={{ display: 'flex', gap: 24, fontSize: 12, flexWrap: 'wrap' }}>
                            <div style={{ flex: 2, minWidth: 240 }}>
                              <strong>Description:</strong>
                              <p style={{ margin: '4px 0', color: 'var(--text-dim)', whiteSpace: 'pre-wrap' }}>{t.description}</p>
                              <strong style={{ marginTop: 8, display: 'block' }}>Proposed Resolution (UC-002):</strong>
                              <div style={{ padding: '4px 0', fontSize: 10, color: 'var(--text-dim)' }}>
                                {isConflict
                                  ? 'AI text and image classifiers disagree with high confidence. Review both results below, select or enter a category override with justification (≥10 chars).'
                                  : 'AI could not reach sufficient confidence. Manually classify this ticket from the available categories.'}
                              </div>
                            </div>
                            <div style={{ flex: 1, minWidth: 160 }}>
                              <strong>AI Side-by-Side:</strong>
                              {infs.map(l => (
                                <div key={l.id} style={{ padding: '3px 0', fontSize: 10, borderBottom: '1px solid var(--border)' }}>
                                  <div style={{ fontWeight: 600, color: l.adapter === 'Comprehend' ? '#3278dc' : '#16a085' }}>{l.adapter} ({l.inputType})</div>
                                  <div>Result: <strong>{l.result}</strong></div>
                                  <div>Confidence: {Math.round(l.confidence * 100)}%</div>
                                  <div>Latency: {l.latencyMs}ms</div>
                                </div>
                              ))}
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

      {showCategoryModal && (
        <div className="modal" onClick={() => setShowCategoryModal(null)}>
          <div className="edit-modal" onClick={e => e.stopPropagation()}>
            <div className="edit-modal-header"><span><FaTag /> Override Category — {showCategoryModal.ticketId}</span><button className="modal-close-btn" onClick={() => setShowCategoryModal(null)}><FaTimes /></button></div>
            <form onSubmit={handleCategoryOverride}>
              {showCategoryModal.aiOriginalCategory && showCategoryModal.aiOriginalCategory !== categoryValue && (
                <p style={{ fontSize: 11, color: 'var(--amber)', marginBottom: 8 }}><FaExclamationTriangle style={{ marginRight: 4 }} />AI originally: <strong>{showCategoryModal.aiOriginalCategory}</strong>.</p>
              )}
              <div className="form-group"><label>Override Category</label><select className="form-select" value={categoryValue} onChange={e => setCategoryValue(e.target.value)} required>{categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
              <div className="form-actions"><button type="button" className="btn btn-secondary" onClick={() => setShowCategoryModal(null)}>Cancel</button><button type="submit" className="btn btn-primary"><FaCheck /> Save Override</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIReview;

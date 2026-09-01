import React, { useState, useMemo, useEffect } from 'react';
import { FaTicketAlt, FaSearch, FaEye, FaStar, FaHistory, FaBuilding, FaBox, FaUser, FaCalendarAlt, FaBolt, FaWrench, FaCheckCircle, FaTimesCircle, FaClock, FaExclamationTriangle, FaTrash, FaUndo, FaTimes } from 'react-icons/fa';
import { getSession } from '../../data/authStore';
import { getAuditLogs, updateTicketRating, confirmTicketCompletion, refreshTickets as fetchTickets, trashTicket, restoreTicket, getTrashTickets } from '../../data/store';
import StatusBadge from '../../components/common/StatusBadge';
import useTickets from '../../hooks/useTickets';

const TicketTracking = () => {
  const session = getSession();
  const currentUser = session ? `${session.name} ${session.surname}` : '';
  const currentUserId = session?.id;
  const [tickets] = useTickets();
  const [auditLogs] = useState(getAuditLogs());
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [rating, setRating] = useState({ ticketId: null, stars: 0, comment: '', hover: 0 });
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showTrash, setShowTrash] = useState(false);
  const [trashTickets, setTrashTickets] = useState([]);
  const [loadingTrash, setLoadingTrash] = useState(false);

  const myTickets = useMemo(() => {
    if (!currentUserId) return [];
    return tickets.filter(t => t.createdById === currentUserId || t.createdBy === currentUser);
  }, [tickets, currentUser, currentUserId]);

  useEffect(() => {
    fetchTickets();
  }, []);

  const filtered = myTickets.filter(t =>
    !search || t.ticketId.toLowerCase().includes(search.toLowerCase()) ||
    t.title.toLowerCase().includes(search.toLowerCase())
  );

  const getAuditForTicket = (ticketId) => auditLogs.filter(a => a.ticketId === ticketId);

  const handleRate = async (ticketId) => {
    if (rating.stars < 1) { setMsg({ text: 'Please select a rating.', type: 'error' }); return; }
    const r = await updateTicketRating(ticketId, rating.stars, rating.comment);
    if (r.success) {
      const finalRating = r.data?.finalRating;
      setMsg({
        text: `Rating submitted: ${rating.stars}/5${finalRating ? ` — New service rating ${finalRating.toFixed(1)} (${r.data?.ratingCount || 1} rating${(r.data?.ratingCount || 1) === 1 ? '' : 's'})` : ''}`,
        type: 'success',
      });
      setRating({ ticketId: null, stars: 0, comment: '', hover: 0 });
      setSelected(prev => prev ? {
        ...prev,
        rating: rating.stars,
        ratingComment: rating.comment.trim(),
        providerRating: r.data?.finalRating ?? prev.providerRating,
        providerRatingCount: r.data?.ratingCount ?? prev.providerRatingCount,
      } : prev);
    } else {
      setMsg({ text: r.error, type: 'error' });
    }
    setTimeout(() => setMsg({ text: '', type: '' }), 3000);
  };

  const handleConfirm = async (satisfied) => {
    const r = await confirmTicketCompletion(selected.ticketId, satisfied, '');
    if (r.success) {
      setMsg({ text: satisfied ? 'Completion confirmed.' : 'Ticket reopened — you can add more details.', type: 'success' });
      setSelected(prev => prev ? { ...prev, status: satisfied ? 'Tenant Confirmed' : 'Reopened' } : prev);
    } else {
      setMsg({ text: r.error, type: 'error' });
    }
    setTimeout(() => setMsg({ text: '', type: '' }), 3000);
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
      setMsg({ text: 'Ticket moved to trash.', type: 'success' });
      setConfirmDelete(null);
      if (selected?.ticketId === ticket.ticketId) setSelected(null);
      fetchTickets();
    } else {
      setMsg({ text: r.error, type: 'error' });
      setConfirmDelete(null);
    }
    setTimeout(() => setMsg({ text: '', type: '' }), 3000);
  };

  const handleRestore = async (ticket) => {
    const r = await restoreTicket(ticket.ticketId);
    if (r.success) {
      setMsg({ text: 'Ticket restored from trash.', type: 'success' });
      setTrashTickets(await getTrashTickets());
      fetchTickets();
    } else {
      setMsg({ text: r.error, type: 'error' });
    }
    setTimeout(() => setMsg({ text: '', type: '' }), 3000);
  };

  const StarInput = ({ ticketId, currentRating }) => {
    if (currentRating) return <span style={{ color: 'var(--amber)' }}>{'★'.repeat(currentRating)} {'☆'.repeat(5 - currentRating)}</span>;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
        {[1, 2, 3, 4, 5].map(s => (
          <FaStar
            key={s}
            style={{ cursor: 'pointer', color: s <= (rating.ticketId === ticketId ? rating.hover || rating.stars : 0) ? 'var(--amber)' : 'var(--text-dim)', fontSize: 18 }}
            onClick={() => setRating(r => ({ ...r, ticketId, stars: s }))}
            onMouseEnter={() => setRating(r => ({ ...r, hover: s }))}
            onMouseLeave={() => setRating(r => ({ ...r, hover: 0 }))}
          />
        ))}
        {rating.ticketId === ticketId && rating.stars > 0 && (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginLeft: 8 }}>
            <input className="form-input" style={{ width: 200, padding: '4px 8px', fontSize: 11 }} placeholder="Optional comment..." value={rating.comment} onChange={e => setRating(r => ({ ...r, comment: e.target.value }))} />
            <button className="btn btn-primary btn-sm" onClick={() => handleRate(ticketId)}>Submit</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setRating({ ticketId: null, stars: 0, comment: '', hover: 0 })}>Cancel</button>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="welcome-banner"><h2><FaTicketAlt /> Ticket Tracking</h2><p>View your maintenance request history and rate completed work. <span className="req-ref">SRS §3.1.6 / REQ-047</span></p></div>
      {msg.text && <div className={`alert alert-${msg.type}`} style={{ marginBottom: 8 }}>{msg.type === 'success' ? <FaCheckCircle /> : <FaTimesCircle />} {msg.text}</div>}
      <div className="card">
        <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span><FaTicketAlt /> My Tickets ({filtered.length})</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FaSearch /><input className="form-input" style={{ width: 200, padding: '4px 8px' }} placeholder="Search by ID or title..." value={search} onChange={e => setSearch(e.target.value)} />
            <button className="btn btn-secondary btn-sm" onClick={openTrash} title="Trash"><FaTrash /> Trash</button>
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="empty-state"><div className="empty-text">No tickets found.</div></div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Property</th>
                  <th>Unit</th>
                  <th>Assigned To</th>
                  <th>Created</th>
                  <th>Rating</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => (
                  <tr key={t.ticketId}>
                    <td><strong>{t.title}</strong></td>
                    <td><StatusBadge status={t.status} /></td>
                    <td><span className={`badge ${t.priority === 'URGENT' || t.priority === 'EMERGENCY' ? 'badge-danger' : t.priority === 'HIGH' ? 'badge-warning' : 'badge-open'}`}>{t.priority}</span></td>
                    <td>{t.propertyName}</td>
                    <td>Unit {t.unitNumber}</td>
                    <td>
                      {t.assignedTo || '—'}
                      {t.autoAssigned && <div style={{ fontSize: 10, color: 'var(--amber)', fontWeight: 600, marginTop: 2 }}>Auto-assigned by system</div>}
                    </td>
                    <td style={{ fontSize: 11 }}>{t.createdAt}</td>
                    <td>
                      {t.status === 'Tenant Confirmed' ? (
                        t.rating ? <span style={{ color: 'var(--amber)' }}>{'★'.repeat(t.rating)} {'☆'.repeat(5 - t.rating)} {t.ratingComment && <span style={{ color: 'var(--text-dim)', fontSize: 10, marginLeft: 4 }}>"{t.ratingComment}"</span>}</span>
                          : <StarInput ticketId={t.ticketId} />
                      ) : <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>—</span>}
                    </td>
                    <td><button className="btn btn-secondary btn-sm" aria-label="View ticket details" title="View details" onClick={() => setSelected(selected?.ticketId === t.ticketId ? null : t)}><FaEye /></button>
                        <button className="btn btn-danger btn-sm" aria-label="Move to trash" title="Move to trash" onClick={() => setConfirmDelete(t)} style={{ marginLeft: 4 }}><FaTrash /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {selected && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span><FaTicketAlt /> {selected.title}</span>
            <button className="modal-close-btn" aria-label="Close ticket details" title="Close" onClick={() => setSelected(null)}>×</button>
          </div>
          <table className="table">
            <tbody>
              <tr><td style={{ fontWeight: 600, width: 160 }}>Ticket ID</td><td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{selected.ticketId}</td></tr>
              <tr><td style={{ fontWeight: 600, width: 160 }}>Description</td><td>{selected.description}</td></tr>
              <tr><td style={{ fontWeight: 600 }}>Status</td><td><StatusBadge status={selected.status} /></td></tr>
              <tr><td style={{ fontWeight: 600 }}>Priority</td><td><span className={`badge ${selected.priority === 'URGENT' || selected.priority === 'EMERGENCY' ? 'badge-danger' : selected.priority === 'HIGH' ? 'badge-warning' : 'badge-open'}`}>{selected.priority}</span></td></tr>
              <tr><td style={{ fontWeight: 600 }}>Category</td><td>{selected.category || '—'}</td></tr>
              <tr><td style={{ fontWeight: 600 }}>Assigned To</td><td>{selected.assignedTo || 'Not assigned yet'}
                    {selected.autoAssigned && <span style={{ fontSize: 10, color: 'var(--amber)', fontWeight: 600, marginLeft: 6 }}>Auto-assigned by system</span>}
                  </td></tr>
              <tr><td style={{ fontWeight: 600 }}>Property / Unit</td><td>{selected.propertyName} — Unit {selected.unitNumber}</td></tr>
              <tr><td style={{ fontWeight: 600 }}>Created</td><td>{selected.createdAt}</td></tr>
              <tr><td style={{ fontWeight: 600 }}>Last Updated</td><td>{selected.updatedAt}</td></tr>
              {selected.rating && <tr><td style={{ fontWeight: 600 }}>Your Rating</td><td><span style={{ color: 'var(--amber)' }}>{'★'.repeat(selected.rating)} {'☆'.repeat(5 - selected.rating)}</span>{selected.ratingComment ? <span style={{ color: 'var(--text-dim)', fontSize: 11, marginLeft: 8 }}>"{selected.ratingComment}"</span> : null}</td></tr>}
            </tbody>
          </table>
          {selected.images && selected.images.length > 0 && (
            <>
              <div className="section-title">Attachments</div>
              <div className="image-preview-grid">
                {selected.images.map((img, idx) => (
                  <div key={idx} className="image-preview" style={{ width: 80, height: 80 }}>
                    <img src={img} alt="" />
                  </div>
                ))}
              </div>
            </>
          )}
          {selected.status === 'Completed' && (
            <div className="card" style={{ marginTop: 12, background: 'var(--surface2)' }}>
              <div className="card-title"><FaCheckCircle /> Confirm Completion</div>
              <p style={{ fontSize: 12, color: 'var(--text-mid)', marginBottom: 8 }}>Has the issue been resolved to your satisfaction?</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-teal" onClick={() => handleConfirm(true)}><FaCheckCircle /> Yes, it's resolved</button>
                <button className="btn btn-secondary" onClick={() => handleConfirm(false)}><FaTimesCircle /> No — reopen ticket</button>
              </div>
            </div>
          )}
          {selected.status === 'Tenant Confirmed' && !selected.rating && (
            <div className="card" style={{ marginTop: 12, background: 'var(--surface2)' }}>
              <div className="card-title"><FaStar /> Rate This Service</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8 }}>
                {[1, 2, 3, 4, 5].map(s => (
                  <FaStar
                    key={s}
                    style={{ cursor: 'pointer', color: s <= (rating.ticketId === selected.ticketId ? rating.hover || rating.stars : 0) ? 'var(--amber)' : 'var(--text-dim)', fontSize: 24 }}
                    onClick={() => setRating(r => ({ ...r, ticketId: selected.ticketId, stars: s }))}
                    onMouseEnter={() => setRating(r => ({ ...r, hover: s }))}
                    onMouseLeave={() => setRating(r => ({ ...r, hover: 0 }))}
                  />
                ))}
              </div>
              {rating.ticketId === selected.ticketId && rating.stars > 0 && (
                <div style={{ marginTop: 8 }}>
                  <textarea className="form-textarea" style={{ minHeight: 60 }} placeholder="Optional comment about the service..." value={rating.comment} onChange={e => setRating(r => ({ ...r, comment: e.target.value }))} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button className="btn btn-primary" onClick={() => handleRate(selected.ticketId)}>Submit Rating</button>
                    <button className="btn btn-secondary" onClick={() => setRating({ ticketId: null, stars: 0, comment: '', hover: 0 })}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="card" style={{ marginTop: 12 }}>
            <div className="card-title" style={{ marginBottom: 12 }}><FaClock /> Ticket Details</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '10px 14px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)' }}>Assigned Provider</div>
                <div style={{ fontSize: 13, color: 'var(--ink)', marginTop: 3 }}>
                  {selected.assignedTo ? (
                    <div>
                      <span style={{ color: 'var(--teal)' }}>{selected.assignedTo}</span>
                      {selected.providerRating ? (
                        <div style={{ color: 'var(--amber)', fontSize: 12, marginTop: 3 }}>
                          {'★'.repeat(Math.round(selected.providerRating))} {selected.providerRating.toFixed(1)}
                          <span style={{ color: 'var(--text-dim)', fontSize: 10 }}> ({selected.providerRatingCount || 1} rating{(selected.providerRatingCount || 1) === 1 ? '' : 's'})</span>
                        </div>
                      ) : null}
                    </div>
                  ) : <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>Not yet assigned</span>}
                </div>
              </div>
              <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '10px 14px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)' }}>SLA Deadline (Resolution)</div>
                <div style={{ fontSize: 13, color: 'var(--ink)', marginTop: 3 }}>
                  {selected.slaResolutionBefore ? new Date(selected.slaResolutionBefore).toLocaleString() : '—'}
                  <br />
                  {selected.slaResolutionBefore ? (
                    selected.slaResolutionBefore < Date.now() ? <span style={{ color: 'var(--danger)', fontSize: 11 }}><FaExclamationTriangle /> DEADLINE PASSED</span>
                    : selected.slaResolutionBefore < Date.now() + 2 * 3600 * 1000 ? <span style={{ color: 'var(--amber)', fontSize: 11 }}>URGENT</span>
                    : <span style={{ color: 'var(--teal)', fontSize: 11 }}>On track</span>
                  ) : null}
                </div>
              </div>
              <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '10px 14px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)' }}>Category</div>
                <div style={{ fontSize: 13, color: 'var(--ink)', marginTop: 3 }}>
                  {selected.category || 'Pending AI Classification'}
                  {selected.aiService && (
                    <span
                      style={{
                        display: 'inline-block',
                        marginLeft: 8,
                        padding: '2px 8px',
                        borderRadius: 10,
                        fontSize: 10,
                        fontWeight: 700,
                        verticalAlign: 'middle',
                        color: selected.aiService === 'PYTHON_SKLEARN' ? '#fff' : 'var(--text-dim)',
                        background: selected.aiService === 'PYTHON_SKLEARN' ? 'var(--teal)' : 'var(--surface)',
                        border: selected.aiService === 'PYTHON_SKLEARN' ? 'none' : '1px solid var(--border)',
                      }}
                    >
                      {selected.aiService === 'PYTHON_SKLEARN' ? 'Python AI' : selected.aiService}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '10px 14px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)' }}>AI Confidence</div>
                <div style={{ fontSize: 13, color: 'var(--ink)', marginTop: 3 }}>{selected.combinedConfidence ? `${(selected.combinedConfidence * 100).toFixed(0)}%` : 'Not yet classified'}</div>
              </div>
            </div>
            {selected.acceptanceNote && (
              <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '10px 14px', marginTop: 8 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)' }}>Message from provider</div>
                <div style={{ fontSize: 13, color: 'var(--ink)', marginTop: 3, fontStyle: 'italic' }}>"{selected.acceptanceNote}"</div>
              </div>
            )}
          </div>
          <div className="card" style={{ marginTop: 12 }}>
            <div className="card-title"><FaHistory /> Audit Trail</div>
            <div style={{ maxHeight: 200, overflow: 'auto' }}>
              {getAuditForTicket(selected.ticketId).length === 0 ? (
                <div style={{ padding: 8, color: 'var(--text-dim)', fontSize: 12 }}>No audit entries.</div>
              ) : (
                getAuditForTicket(selected.ticketId).map(a => (
                  <div key={a.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                    <span className="cell-mono" style={{ color: 'var(--text-dim)' }}>{a.id}</span>{' '}
                    <span style={{ color: 'var(--amber)' }}>{a.action}</span>{' '}
                    <span style={{ color: 'var(--text-dim)' }}>by {a.actor}</span>
                    {a.previousStatus && a.newStatus && <span> — {a.previousStatus} → {a.newStatus}</span>}
                    {a.comment && <span style={{ color: 'var(--text-mid)', display: 'block', marginLeft: 16 }}>{a.comment}</span>}
                    <span style={{ color: 'var(--text-dim)', display: 'block', marginLeft: 16, fontSize: 10 }}>{a.timestamp}</span>
                  </div>
                ))
              )}
            </div>
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
            <div className="edit-modal-header">
              <span><FaTrash /> My Trash</span>
              <button className="modal-close-btn" onClick={() => setShowTrash(false)} aria-label="Close trash modal"><FaTimes /></button>
            </div>
            <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
              {loadingTrash ? (
                <p className="empty-text" style={{ padding: 24, textAlign: 'center' }}>Loading...</p>
              ) : trashTickets.length === 0 ? (
                <p className="empty-text" style={{ padding: 24, textAlign: 'center' }}>Trash is empty.</p>
              ) : (
                <table className="table">
                  <thead>
                    <tr><th>Title</th><th>Status</th><th>Priority</th><th>Deleted</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {trashTickets.map(t => (
                      <tr key={t.ticketId}>
                        <td style={{ fontSize: 12 }}>{t.title}</td>
                        <td><StatusBadge status={t.status} /></td>
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
    </>
  );
};

export default TicketTracking;
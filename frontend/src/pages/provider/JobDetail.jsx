import React, { useState, useMemo, useRef } from 'react';
import { FaArrowLeft, FaBuilding, FaBox, FaUser, FaCalendarAlt, FaBolt, FaClock, FaWrench, FaMapMarkerAlt, FaEnvelope, FaPhone, FaCheck, FaPause, FaPlay, FaIdCard, FaCamera, FaTimes } from 'react-icons/fa';
import { getSession } from '../../data/authStore';
import { getUsers } from '../../data/authStore';
import { getTickets, getProperties, getUnits, acceptJob, declineJob, startJob, waitForParts, partsReceived, submitJobCompletion } from '../../data/store';
import StatusBadge from '../../components/common/StatusBadge';
import Alert from '../../components/common/Alert';
import ImageLightbox from '../../components/common/ImageLightbox';

const JobDetail = ({ ticketId, onBack }) => {
  const session = getSession();
  const providerName = session ? `${session.name} ${session.surname}` : '';
  const [tickets, setTickets] = useState(getTickets());
  const [allUsers] = useState(getUsers());
  const [properties] = useState(getProperties());
  const [units] = useState(getUnits());
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [comment, setComment] = useState('');
  const [invoiceText, setInvoiceText] = useState('');
  const [completionPhotos, setCompletionPhotos] = useState([]);
  const [completionPreviews, setCompletionPreviews] = useState([]);
  const [completionMsg, setCompletionMsg] = useState({ text: '', type: '' });
  const [showComplete, setShowComplete] = useState(false);
  const [showDecline, setShowDecline] = useState(false);
  const [declineDate, setDeclineDate] = useState('');
  const [declineReason, setDeclineReason] = useState('');
  const [declineBusy, setDeclineBusy] = useState(false);
  const [lightboxImg, setLightboxImg] = useState(null);
  const fileInputRef = useRef(null);

  const ticket = tickets.find(t => t.ticketId === ticketId);

  const tenant = useMemo(() => {
    if (!ticket) return null;
    const u = allUsers.find(u => `${u.name} ${u.surname}` === ticket.createdBy);
    return u || null;
  }, [ticket, allUsers]);

  const property = useMemo(() => {
    if (!ticket) return null;
    return properties.find(p => p.name === ticket.propertyName) || null;
  }, [ticket, properties]);

  const sla = useMemo(() => {
    if (!ticket) return null;
    const now = Date.now();
    const resol = ticket.slaResolutionBefore || ticket.slaResponseBefore;
    if (!resol) return null;
    const remaining = resol - now;
    const total = (ticket.slaResponseBefore && ticket.slaResolutionBefore)
      ? ticket.slaResolutionBefore - ticket.slaResponseBefore
      : 24 * 3600000;
    const pct = ((total - remaining) / total) * 100;
    return {
      remaining, total, pct,
      deadline: new Date(resol).toLocaleString(),
      state: remaining <= 0 ? 'breached' : pct >= 75 ? 'warning' : 'ok',
    };
  }, [ticket]);

  const showMsg = (text, type) => { setMsg({ text, type }); setTimeout(() => setMsg({ text: '', type: '' }), 3000); };
  const refresh = () => setTickets(getTickets());

  const runWorkflow = async (promise, newStatus) => {
    const r = await promise;
    if (r.success) { refresh(); showMsg(`Status updated to ${newStatus}`, 'success'); setComment(''); }
    else { showMsg(r.error, 'error'); }
  };

  const runDecline = async () => {
    setDeclineBusy(true);
    const r = await declineJob(ticketId, declineReason.trim() || undefined, declineDate || undefined);
    setDeclineBusy(false);
    if (r.success) { refresh(); showMsg('Job declined.', 'success'); setShowDecline(false); setDeclineDate(''); setDeclineReason(''); }
    else { showMsg(r.error, 'error'); }
  };

  if (!ticket) {
    return (
      <div className="card">
        <div className="card-title">Job Detail</div>
        <div className="empty-state"><div className="empty-text">Ticket not found.</div></div>
        <button className="btn btn-secondary" onClick={onBack}><FaArrowLeft /> Back</button>
      </div>
    );
  }

  const ACTIONS = [];
  if (ticket.status === 'Assigned') {
    ACTIONS.push({ label: 'Accept Job', nextStatus: 'Accepted', icon: FaPlay, cls: 'btn-teal', run: () => acceptJob(ticketId, comment.trim() || undefined) });
  }
  if (ticket.status === 'Accepted') {
    ACTIONS.push({ label: 'Start Work', nextStatus: 'In Progress', icon: FaPlay, cls: 'btn-teal', run: () => startJob(ticketId, comment.trim() || undefined) });
  }
  if (ticket.status === 'In Progress') {
    ACTIONS.push({ label: 'Waiting for Parts', nextStatus: 'Waiting for Parts', icon: FaPause, cls: 'btn-secondary', run: () => waitForParts(ticketId, comment.trim() || undefined) });
  }
  if (ticket.status === 'Waiting for Parts') {
    ACTIONS.push({ label: 'Resume Work', nextStatus: 'In Progress', icon: FaPlay, cls: 'btn-primary', run: () => partsReceived(ticketId, comment.trim() || undefined) });
  }

  return (
    <>
      <button className="btn btn-secondary" onClick={onBack} style={{ marginBottom: 12 }}><FaArrowLeft /> Back to Jobs</button>
      {msg.text && <div className={`alert alert-${msg.type}`} style={{ marginBottom: 8 }}>{msg.text}</div>}

      <div className="welcome-banner" style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0 }}><FaWrench /> {ticket.title}</h2>
            <p style={{ margin: '4px 0 0', fontSize: 12, fontFamily: 'var(--font-mono)' }}>ID: {ticket.ticketId}</p>
            <p style={{ margin: '4px 0 0', fontSize: 12 }}><StatusBadge status={ticket.status} /> <span className={`badge ${ticket.priority === 'URGENT' || ticket.priority === 'EMERGENCY' ? 'badge-danger' : ticket.priority === 'HIGH' ? 'badge-warning' : 'badge-open'}`}>{ticket.priority}</span></p>
          </div>
          <div style={{ textAlign: 'right' }}>
            {sla && (
              <div style={{ fontSize: 12, color: sla.state === 'breached' ? 'var(--danger)' : sla.state === 'warning' ? 'var(--amber)' : 'var(--teal)' }}>
                <FaClock /> SLA: {sla.deadline}
                <br /><span style={{ fontSize: 10 }}>({Math.round(sla.pct)}% elapsed — {sla.state})</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <div>
          <div className="card">
            <div className="card-title">Description</div>
            <p style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{ticket.description}</p>
          </div>

          {ticket.images && ticket.images.length > 0 && (
            <div className="card" style={{ marginTop: 12 }}>
              <div className="card-title">Photos ({ticket.images.length})</div>
              <div className="image-preview-grid">
                {ticket.images.map((img, idx) => (
                  <div key={idx} className="image-preview" style={{ width: 100, height: 100, cursor: 'pointer' }} onClick={() => setLightboxImg(img.data || img)}>
                    <img src={img.data || img} alt={`Photo ${idx + 1}`} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {ACTIONS.length > 0 && (
            <div className="card" style={{ marginTop: 12 }}>
              <div className="card-title">Update Status <span className="req-ref">SRS §3.1.5</span></div>
              <div className="form-group">
                <label className="form-label">Comment to tenant (optional)</label>
                <textarea className="form-textarea" style={{ minHeight: 60 }} placeholder="e.g. Arriving at 2pm, need access to the main electrical panel..." value={comment} onChange={e => setComment(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {ACTIONS.map(a => (
                  <button key={a.nextStatus} className={`btn ${a.cls}`} onClick={() => runWorkflow(a.run(), a.nextStatus)}>
                    <a.icon /> {a.label}
                  </button>
                ))}
                {ticket.status === 'Assigned' && (
                  <button className="btn btn-danger" onClick={() => setShowDecline(!showDecline)}>
                    <FaTimes /> {showDecline ? 'Cancel' : 'Decline'}
                  </button>
                )}
              </div>
              {showDecline && (
                <div style={{ marginTop: 12, padding: 10, border: '1px solid rgba(240,180,50,0.35)', borderRadius: 6, background: 'rgba(240,180,50,0.06)' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}><FaBolt style={{ color: 'var(--amber)', marginRight: 4 }} />Decline this job?</div>
                  <div className="form-group">
                    <label className="form-label">Postpone until (optional)</label>
                    <input type="datetime-local" className="form-input" value={declineDate} onChange={e => setDeclineDate(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Reason for the tenant / manager (optional)</label>
                    <textarea className="form-textarea" style={{ minHeight: 50 }} placeholder="e.g. Waiting for parts — available to reschedule next week." value={declineReason} onChange={e => setDeclineReason(e.target.value)} />
                  </div>
                  <button className="btn btn-danger" disabled={declineBusy} onClick={runDecline}>{declineBusy ? 'Declining...' : 'Confirm Decline'}</button>
                </div>
              )}
            </div>
          )}

          {(ticket.status === 'In Progress' || ticket.status === 'Waiting for Parts') && (
            <div className="card" style={{ marginTop: 12 }}>
              <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span><FaCamera /> Mark as Complete</span>
                <button className="btn btn-teal btn-sm" onClick={() => setShowComplete(!showComplete)}>
                  {showComplete ? '▼' : '▶'} {showComplete ? 'Hide' : 'Complete this job'}
                </button>
              </div>
              {showComplete && (
                <div>
                  <Alert msg={completionMsg.text} type={completionMsg.type} />
                  <div className="form-group">
                    <label className="form-label">Before/After Photos (optional, up to 5)</label>
                    <div className="file-upload-area" onClick={() => fileInputRef.current?.click()}>
                      <FaCamera /> Click to upload photos
                    </div>
                    <input type="file" ref={fileInputRef} multiple accept="image/*" style={{ display: 'none' }} onChange={(e) => {
                      const files = Array.from(e.target.files);
                      const newPhotos = [...completionPhotos];
                      const newPreviews = [...completionPreviews];
                      for (const file of files) {
                        if (file.size > 10 * 1024 * 1024) {
                          setCompletionMsg({ text: 'Image must be less than 10MB', type: 'error' }); continue;
                        }
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          newPhotos.push({ name: file.name, size: file.size, type: file.type, preview: reader.result });
                          newPreviews.push(reader.result);
                          setCompletionPhotos([...newPhotos]);
                          setCompletionPreviews([...newPreviews]);
                        };
                        reader.readAsDataURL(file);
                      }
                    }} />
                    {completionPreviews.length > 0 && (
                      <div className="image-preview-grid" style={{ marginTop: 8 }}>
                        {completionPreviews.map((p, idx) => (
                          <div key={idx} className="image-preview" style={{ width: 70, height: 70, position: 'relative' }}>
                            <img src={p} alt="" />
                            <button onClick={() => {
                              setCompletionPhotos(completionPhotos.filter((_, i) => i !== idx));
                              setCompletionPreviews(completionPreviews.filter((_, i) => i !== idx));
                            }} style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: '50%', border: 'none', background: 'var(--danger)', color: '#fff', fontSize: 10, cursor: 'pointer' }}>×</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="invoiceText">Invoice Summary (optional)</label>
                    <textarea id="invoiceText" className="form-textarea" style={{ minHeight: 70 }} placeholder="e.g. Labour: 2hrs @ R350/hr = R700. Parts: pipe fitting R120. Total: R820." value={invoiceText} onChange={e => setInvoiceText(e.target.value)} />
                  </div>
                  <button className="btn btn-primary" onClick={async () => {
                    const r = await submitJobCompletion(ticketId, invoiceText, completionPhotos, providerName);
                    if (r.success) {
                      setCompletionMsg({ text: 'Job marked complete successfully.', type: 'success' });
                      setShowComplete(false);
                      refresh();
                    } else {
                      setCompletionMsg({ text: r.error, type: 'error' });
                    }
                  }}><FaCheck /> Submit Completion</button>
                </div>
              )}
            </div>
          )}

          {ticket.status === 'Completed' && (
            <div className="card" style={{ marginTop: 12 }}>
              <div className="card-title">Status</div>
              <span className="badge badge-completed"><FaCheck /> Awaiting tenant confirmation / manager close.</span>
              {ticket.completionInvoice && <div style={{ marginTop: 8, padding: 8, background: 'var(--surface2)', borderRadius: 4, fontSize: 12 }}><strong>Invoice:</strong> {ticket.completionInvoice}</div>}
              {ticket.completionPhotos && ticket.completionPhotos.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <strong style={{ fontSize: 12 }}>Completion Photos:</strong>
                  <div className="image-preview-grid" style={{ marginTop: 4 }}>
                    {ticket.completionPhotos.map((p, idx) => (
                      <div key={idx} className="image-preview" style={{ width: 70, height: 70, cursor: 'pointer' }} onClick={() => setLightboxImg(p.preview || p.data || p)}>
                        <img src={p.preview || p.data || p} alt="" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <div className="card">
            <div className="card-title"><FaBuilding /> Property</div>
            <div style={{ fontSize: 13, lineHeight: 2 }}>
              <div><strong>{ticket.propertyName}</strong></div>
              <div><FaMapMarkerAlt /> {property?.address || 'Address not available'}</div>
              <div><FaBox /> Unit {ticket.unitNumber}</div>
            </div>
          </div>

          <div className="card" style={{ marginTop: 12 }}>
            <div className="card-title"><FaUser /> Tenant Contact</div>
            {tenant ? (
              <div style={{ fontSize: 13, lineHeight: 2 }}>
                <div><FaIdCard /> {tenant.name} {tenant.surname}</div>
                <div><FaEnvelope /> {tenant.email}</div>
                <div><FaPhone /> {tenant.phone || '—'}</div>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
                <div><FaIdCard /> {ticket.createdBy}</div>
                <div style={{ fontSize: 11, marginTop: 4 }}>Contact details not available.</div>
              </div>
            )}
          </div>

          <div className="card" style={{ marginTop: 12 }}>
            <div className="card-title"><FaCalendarAlt /> Timeline</div>
            <div style={{ fontSize: 12, lineHeight: 2 }}>
              <div><strong>Created:</strong> {ticket.createdAt}</div>
              <div><strong>Updated:</strong> {ticket.updatedAt}</div>
              {ticket.assignedTo && <div><strong>Assigned to:</strong> {ticket.assignedTo}</div>}
              {ticket.category && <div><strong>Category:</strong> {ticket.category}</div>}
            </div>
          </div>
        </div>
      </div>
      <ImageLightbox src={lightboxImg} onClose={() => setLightboxImg(null)} />
    </>
  );
};

export default JobDetail;
import React, { useState, useMemo, useEffect } from 'react';
import { FaBuilding, FaBox, FaBolt, FaCalendarAlt, FaUser, FaTicketAlt, FaCamera, FaExclamationTriangle } from 'react-icons/fa';
import Alert from './common/Alert';
import EmptyState from './common/EmptyState';
import StatusBadge from './common/StatusBadge';
import { createTicket, getUnits, getTickets, getEmergencyHint } from '../data/store';
import { getSession } from '../data/authStore';
import { TICKET_CATEGORIES } from '../data/categories';

const Ticket = ({ currentUser, refreshData }) => {
  const [units, setUnits] = useState(getUnits());
  const [tickets, setTickets] = useState(getTickets());
  const [form, setForm] = useState({ unitId: '', category: '', title: '', description: '', priority: 'MEDIUM' });
  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [selectedImage, setSelectedImage] = useState(null);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [confirmStep, setConfirmStep] = useState(false);
  const [touched, setTouched] = useState({});

  const refresh = () => {
    setUnits(getUnits());
    setTickets(getTickets());
    if (refreshData) refreshData();
  };

  useEffect(() => {
    const onPhotoUploadFailed = (e) => {
      const { failed, total } = e.detail || {};
      setMsg({
        text: `Ticket submitted, but ${failed} of ${total} photo(s) failed to upload. Please try re-attaching ${failed === 1 ? 'it' : 'them'} from the ticket details.`,
        type: 'error',
      });
    };
    window.addEventListener('spmt:photo-upload-failed', onPhotoUploadFailed);
    return () => window.removeEventListener('spmt:photo-upload-failed', onPhotoUploadFailed);
  }, []);

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    const newImages = [...images];
    const newPreviews = [...imagePreviews];

    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        setMsg({ text: 'Image must be less than 10MB', type: 'error' });
        continue;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        newImages.push({ name: file.name, type: file.type, size: file.size, data: reader.result, uploadedAt: new Date().toISOString() });
        newPreviews.push(reader.result);
        setImages(newImages);
        setImagePreviews(newPreviews);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = (index) => {
    const newImages = images.filter((_, i) => i !== index);
    const newPreviews = imagePreviews.filter((_, i) => i !== index);
    setImages(newImages);
    setImagePreviews(newPreviews);
  };

  const doSubmit = async (forceSubmit = false) => {
    const session = getSession();
    const userId = session?.id || null;
    const displayName = session ? `${session.name} ${session.surname}` : currentUser;

    const result = await createTicket(
      form.unitId,
      form.category,
      form.title,
      form.description,
      form.priority,
      images,
      userId,
      displayName,
      forceSubmit
    );

    if (result.isDuplicate) {
      setDuplicateWarning({ message: result.error, existingId: result.existingTicketId });
      setConfirmStep(false);
      return;
    }

    if (result.error) {
      setMsg({ text: result.error, type: 'error' });
    } else {
      setMsg({ text: `Ticket submitted successfully.`, type: 'success' });
      setForm({ unitId: '', category: '', title: '', description: '', priority: 'MEDIUM' });
      setImages([]);
      setImagePreviews([]);
      setConfirmStep(false);
      setDuplicateWarning(null);
      setTouched({});
      refresh();
    }
  };

  const handleSubmit = () => {
    setConfirmStep(true);
  };

  const validate = () => {
    const errs = {};
    if (!form.unitId) errs.unitId = 'Please select your unit.';
    if (!form.category) errs.category = 'Please select a category.';
    if (!form.title || form.title.trim().length < 5) errs.title = 'Title must be at least 5 characters.';
    if (!form.description || form.description.trim().length < 20) errs.description = `${form.description.length}/20 characters minimum.`;
    return errs;
  };

  const validationErrors = validate();
  const canProceed = !validationErrors.unitId && !validationErrors.category && !validationErrors.title && !validationErrors.description;

  const tenantUnits = useMemo(() => units.filter(u => u.status === 'OCCUPIED' && u.tenantName === currentUser), [units, currentUser]);

  const selectedUnitLabel = tenantUnits.find(u => u.unitId === form.unitId);

  return (
    <div className="main-cols">
      <div>
        <div className="card">
          <div className="card-title">Submit Maintenance Ticket <span className="req-ref">REQ-013</span></div>
          <Alert msg={msg.text} type={msg.type} />

          {duplicateWarning && (
            <div style={{ background: 'rgba(240,165,0,0.10)', border: '1px solid var(--amber)', borderRadius: 6, padding: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 12, marginBottom: 8 }}><FaExclamationTriangle style={{ color: 'var(--amber)', marginRight: 4 }} />{duplicateWarning.message}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary btn-sm" onClick={async () => { setDuplicateWarning(null); await doSubmit(true); }}>Submit Anyway</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setDuplicateWarning(null)}>Cancel</button>
              </div>
            </div>
          )}

          {confirmStep ? (
            <div>
              <div className="card-title">Review Your Ticket</div>
              {getEmergencyHint(form.description) && (
                <div style={{ background: 'rgba(220,60,60,0.10)', border: '1px solid var(--danger)', borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 12 }}>
                  <FaExclamationTriangle style={{ color: 'var(--danger)', marginRight: 4 }} />
                  Description contains emergency keywords — ensure priority is set to <strong>Emergency</strong> if this is urgent.
                </div>
              )}
              <table className="table" style={{ marginBottom: 12 }}>
                <tbody>
                  <tr><td style={{ fontWeight: 600, width: 100 }}>Unit</td><td>{selectedUnitLabel ? `${selectedUnitLabel.propertyName} - Unit ${selectedUnitLabel.unitNumber}` : '—'}</td></tr>
                  <tr><td style={{ fontWeight: 600 }}>Category</td><td>{form.category}</td></tr>
                  <tr><td style={{ fontWeight: 600 }}>Title</td><td>{form.title}</td></tr>
                  <tr><td style={{ fontWeight: 600 }}>Priority</td><td><span className={`badge ${form.priority === 'URGENT' || form.priority === 'EMERGENCY' ? 'badge-danger' : form.priority === 'HIGH' ? 'badge-warning' : 'badge-open'}`}>{form.priority}</span></td></tr>
                  <tr><td style={{ fontWeight: 600 }}>Description</td><td><pre style={{ background: 'var(--surface2)', padding: 8, borderRadius: 4, fontSize: 12, whiteSpace: 'pre-wrap', margin: 0 }}>{form.description}</pre></td></tr>
                  <tr><td style={{ fontWeight: 600 }}>Photos</td><td>{imagePreviews.length > 0 ? `${imagePreviews.length} photo(s) attached` : 'None'}</td></tr>
                </tbody>
              </table>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" onClick={async () => await doSubmit(false)} disabled={!canProceed}>Confirm & Submit</button>
                <button className="btn btn-secondary" onClick={() => setConfirmStep(false)}>Edit</button>
              </div>
            </div>
          ) : (
            <>
              <div className="form-group">
                <label className="form-label">Unit</label>
                <select className="form-select" value={form.unitId}
                  onChange={e => { setForm(f => ({ ...f, unitId: e.target.value })); setTouched(t => ({ ...t, unitId: true })); }}
                  onBlur={() => setTouched(t => ({ ...t, unitId: true }))}>
                  <option value="">— Select your unit —</option>
                  {tenantUnits.map(u => (
                    <option key={u.unitId} value={u.unitId}>{u.propertyName} - Unit {u.unitNumber}</option>
                  ))}
                </select>
                {touched.unitId && validationErrors.unitId && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--danger)', marginTop: 3 }}>{validationErrors.unitId}</div>}
              </div>

              <div className="form-group">
                <label className="form-label">Title</label>
                <input className="form-input" placeholder="Brief issue summary" value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  onBlur={() => setTouched(t => ({ ...t, title: true }))} />
                {touched.title && validationErrors.title && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--danger)', marginTop: 3 }}>{validationErrors.title}</div>}
              </div>

              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-select" value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  onBlur={() => setTouched(t => ({ ...t, category: true }))}>
                  <option value="">— Select a category —</option>
                  {TICKET_CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                {touched.category && validationErrors.category && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--danger)', marginTop: 3 }}>{validationErrors.category}</div>}
              </div>

              <div className="form-group">
                <label className="form-label">Priority</label>
                <select className="form-select" value={form.priority}
                  onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="EMERGENCY">Emergency</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Description (min 20 chars)</label>
                <textarea className="form-textarea" placeholder="Describe the issue in detail..." value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  onBlur={() => setTouched(t => ({ ...t, description: true }))} />
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: form.description.length < 20 && form.description.length > 0 ? 'var(--danger)' : 'var(--text-dim)', marginTop: 3 }}>
                  {form.description.length}/20 characters minimum.
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Upload Photos (Optional, up to 5)</label>
                <div className="file-upload-area" onClick={() => document.getElementById('imageUpload').click()}>
                  <FaCamera /> Click or drag to upload images
                </div>
                <input type="file" id="imageUpload" multiple accept="image/*" className="file-upload-input" onChange={handleImageUpload} />
                
                {imagePreviews.length > 0 && (
                  <div className="image-preview-grid">
                    {imagePreviews.map((img, idx) => (
                      <div className="image-preview" key={idx}>
                        <img src={img} alt={`Preview ${idx}`} />
                        <button className="remove-image" onClick={() => removeImage(idx)}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button className="btn btn-primary btn-full" onClick={handleSubmit} disabled={!canProceed}>
                Submit Ticket
              </button>
            </>
          )}
        </div>
      </div>

      <div>
        <div className="card">
          <div className="card-title">My Tickets ({tickets.filter(t => t.createdBy === currentUser || (currentUser === 'Tenant' && t.createdBy === 'John Tenant')).length})</div>
          {tickets.filter(t => t.createdBy === currentUser || (currentUser === 'Tenant' && t.createdBy === 'John Tenant')).length === 0 ? (
            <EmptyState icon={<FaTicketAlt />} text="No tickets yet" />
          ) : (
            <div className="scroll-list ticket-grid">
              {tickets.filter(t => t.createdBy === currentUser || (currentUser === 'Tenant' && t.createdBy === 'John Tenant')).map(t => (
                <div className="ticket-card" key={t.ticketId}>
                  <div className="ticket-header">
                    <StatusBadge status={t.status} />
                  </div>
                  <div className="ticket-desc">
                    <strong>{t.title}</strong><br />
                    {t.description}
                  </div>
                  {t.images && t.images.length > 0 && (
                    <div className="ticket-images">
                      {t.images.map((img, idx) => (
                        <div key={idx} className="ticket-thumb" onClick={() => setSelectedImage(img)}>
                          <img src={img.data || img} alt={t.title} />
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="ticket-meta">
                    <span><FaBuilding /> {t.propertyName}</span>
                    <span><FaBox /> Unit {t.unitNumber}</span>
                    <span><FaBolt /> Priority: {t.priority}</span>
                    <span><FaCalendarAlt /> {t.createdAt}</span>
                    {t.assignedTo && <span><FaUser /> Assigned: {t.assignedTo}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedImage && (
        <div className="modal" onClick={() => setSelectedImage(null)}>
          <span className="modal-close">×</span>
          <img src={selectedImage.data || selectedImage} alt="Full size" />
        </div>
      )}
    </div>
  );
};

export default Ticket;
import React, { useState, useMemo } from 'react';
import { FaWrench, FaStar, FaMapMarkerAlt, FaPhone, FaEnvelope, FaCheckCircle, FaClock, FaBan, FaExclamationTriangle, FaSearch, FaUserCheck, FaTimes } from 'react-icons/fa';
import { getTechnicians, updateTechnicianStatus, getTickets, assignTicket, getProperties } from '../../data/store';
import { getSession } from '../../data/authStore';
import Alert from '../../components/common/Alert';

const ALERT_THRESHOLD = 2.0;
const MIN_JOBS_FOR_ALERT = 5;
const STALE_THRESHOLD_MS = 60 * 60 * 1000;
const STATUS_OPTIONS = ['AVAILABLE', 'ON_CALL', 'OFF_DUTY', 'SUSPENDED'];

const STATUS_STYLE = {
  AVAILABLE: { className: 'badge badge-completed', label: 'Available' },
  ON_CALL: { className: 'badge badge-info', label: 'On Call' },
  OFF_DUTY: { className: 'badge', label: 'Off Duty' },
  SUSPENDED: { className: 'badge badge-danger', label: 'Suspended' },
};

const Technicians = () => {
  const session = getSession();
  const pmName = session ? `${session.name} ${session.surname}` : '';
  const [technicians, setTechnicians] = useState(getTechnicians);
  const [allProperties] = useState(getProperties);
  const [allTickets] = useState(() => getTickets().filter(t => t.status === 'Open' || t.status === 'Assigned' || t.status === 'Reopened'));
  const propNames = useMemo(() => new Set(allProperties.filter(p => p.managerName === pmName).map(p => p.name)), [allProperties, pmName]);
  const tickets = useMemo(() => allTickets.filter(t => propNames.has(t.propertyName)), [allTickets, propNames]);
  const [alert, setAlert] = useState({ msg: '', type: '' });
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRow, setExpandedRow] = useState(null);
  const [assignTarget, setAssignTarget] = useState(null);
  const [assignTicketId, setAssignTicketId] = useState('');

  const refresh = () => setTechnicians(getTechnicians());
  const showAlert = (msg, type) => { setAlert({ msg, type }); setTimeout(() => setAlert({ msg: '', type: '' }), 5000); };

  const getSpecialisations = (t) => t.specialisations || t.specilisations || [];
  const getScore = (tech) => Math.round((tech.rating * 10 + (tech.totalJobsCompleted > 50 ? 20 : tech.totalJobsCompleted > 10 ? 10 : 0)) / 1.5);

  const handleStatusChange = (techId, newStatus) => {
    const r = updateTechnicianStatus(techId, newStatus);
    if (r.success) { showAlert(`Status updated to ${newStatus}.`, 'success'); refresh(); }
    else showAlert(r.error, 'error');
  };

  const handleAssign = (e) => {
    e.preventDefault();
    if (!assignTarget || !assignTicketId) return;
    const ticket = tickets.find(t => t.ticketId === assignTicketId);
    const tech = technicians.find(t => t.id === assignTarget);
    if (!ticket || !tech) return;
    const r = assignTicket(assignTicketId, tech.name, tech.id);
    if (r.success) { showAlert(`${ticket.ticketId} assigned to ${tech.name}.`, 'success'); setAssignTarget(null); }
    else showAlert(r.error, 'error');
  };

  const filtered = technicians.filter(t => {
    if (statusFilter !== 'ALL' && t.availabilityStatus !== statusFilter) return false;
    if (searchTerm) { const q = searchTerm.toLowerCase(); return t.name.toLowerCase().includes(q) || (t.companyName || '').toLowerCase().includes(q); }
    return true;
  });

  const isStale = (iso) => iso ? Date.now() - new Date(iso).getTime() > STALE_THRESHOLD_MS : false;
  const formatLoc = (iso) => { if (!iso) return '—'; const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000); if (m < 1) return 'Just now'; if (m < 60) return `${m}m ago`; return `${Math.floor(m / 60)}h ${m % 60}m ago`; };

  const avgRating = technicians.length > 0 ? (technicians.reduce((s, t) => s + t.rating, 0) / technicians.length).toFixed(1) : '—';

  const stats = [
    { label: 'Total', value: technicians.length, icon: FaWrench },
    { label: 'Available', value: technicians.filter(t => t.availabilityStatus === 'AVAILABLE').length, icon: FaCheckCircle },
    { label: 'On Call', value: technicians.filter(t => t.availabilityStatus === 'ON_CALL').length, icon: FaClock },
    { label: 'Off Duty', value: technicians.filter(t => t.availabilityStatus === 'OFF_DUTY').length, icon: FaBan },
    { label: 'Suspended', value: technicians.filter(t => t.availabilityStatus === 'SUSPENDED').length, icon: FaExclamationTriangle },
    { label: 'Avg Rating', value: avgRating, icon: FaStar },
  ];

  return (
    <div>
      <div className="card">
        <div className="card-title"><span><FaWrench /> Technician Management <span className="req-ref">REQ-035 / MOD-006</span></span></div>
        <Alert msg={alert.msg} type={alert.type} />
        <div className="stat-grid">{stats.map((s, i) => (<div className="stat-card" key={i}><div className="stat-value"><s.icon /> {s.value}</div><div className="stat-label">{s.label}</div></div>))}</div>
      </div>
      <div className="card">
        <div className="card-title">
          <span><FaWrench /> Technicians</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <FaSearch style={{ color: 'var(--text-dim)', fontSize: 12 }} />
            <input className="form-input" style={{ width: 180, fontSize: 12, padding: '4px 8px' }} placeholder="Search name, company..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            <select className="form-select" style={{ width: 'auto', minWidth: 120, fontSize: 11 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="ALL">All Statuses</option>
              {STATUS_OPTIONS.map(o => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
        </div>
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead><tr><th>Name</th><th>Company</th><th>Specialisations</th><th>Rating</th><th>Score</th><th>Jobs</th><th>Workload</th><th>Availability</th><th>Location</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.length === 0 ? <tr><td colSpan="10" style={{ textAlign: 'center', padding: 24, color: 'var(--text-dim)' }}>No technicians found.</td></tr> : (
                filtered.map(tech => {
                  const specialisations = getSpecialisations(tech);
                  const showAlertIcon = tech.rating < ALERT_THRESHOLD && tech.totalJobsCompleted >= MIN_JOBS_FOR_ALERT;
                  const stale = isStale(tech.lastLocationUpdate);
                  const ss = STATUS_STYLE[tech.availabilityStatus] || STATUS_STYLE.AVAILABLE;
                  const excludedFromRouting = tech.availabilityStatus === 'OFF_DUTY' || tech.availabilityStatus === 'SUSPENDED';
                  return (
                    <React.Fragment key={tech.id}>
                      <tr style={showAlertIcon ? { backgroundColor: 'rgba(255,191,0,0.06)' } : {}}>
                        <td><strong>{tech.name}</strong>{showAlertIcon && <FaExclamationTriangle style={{ color: 'var(--amber)', marginLeft: 4, cursor: 'help' }} title={`Underperforming (REQ-050)`} />}</td>
                        <td>{tech.companyName || '—'}</td>
                        <td style={{ fontSize: 12 }}>{specialisations.join(', ') || '—'}</td>
                        <td><FaStar style={{ color: 'var(--amber)', marginRight: 4 }} />{tech.rating.toFixed(1)}</td>
                        <td className="cell-mono" style={{ fontWeight: 600, color: getScore(tech) >= 80 ? 'var(--teal)' : getScore(tech) >= 50 ? 'var(--amber)' : 'var(--text-dim)' }}>{getScore(tech)}</td>
                        <td className="cell-mono">{tech.totalJobsCompleted}</td>
                        <td className="cell-mono">{tech.currentWorkload}</td>
                        <td>
                          <span className={ss.className} style={ss.className === 'badge' ? { backgroundColor: 'var(--text-dim)', color: '#fff' } : {}}>{ss.label}</span>
                          {excludedFromRouting && <span style={{ marginLeft: 4, fontSize: 9, padding: '1px 4px', borderRadius: 2, backgroundColor: 'rgba(192,57,43,0.12)', color: 'var(--danger)', whiteSpace: 'nowrap' }}><FaBan style={{ fontSize: 8, marginRight: 2 }} />Routing</span>}
                        </td>
                        <td><span style={{ fontSize: 11, color: stale ? 'var(--danger)' : 'var(--text-dim)' }}><FaMapMarkerAlt style={{ marginRight: 4 }} />{tech.gpsLatitude != null ? `${tech.gpsLatitude.toFixed(4)}, ${tech.gpsLongitude.toFixed(4)}` : '—'}</span></td>
                        <td>
                          <div className="action-cell">
                            <button className="btn btn-secondary btn-sm" onClick={() => setExpandedRow(expandedRow === tech.id ? null : tech.id)} title="Details"><FaMapMarkerAlt /></button>
                            <select className="form-select" style={{ width: 'auto', minWidth: 85, fontSize: 10, padding: '2px 4px' }} value={tech.availabilityStatus} onChange={e => handleStatusChange(tech.id, e.target.value)}>
                              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                            </select>
                            {!excludedFromRouting && (
                              <button className="btn btn-teal btn-sm" onClick={() => { setAssignTarget(tech.id); setAssignTicketId(''); }} title="Assign ticket"><FaUserCheck /></button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {expandedRow === tech.id && (
                        <tr className="expanded-row"><td colSpan="10" style={{ padding: '8px 16px', backgroundColor: 'var(--surface)' }}>
                          <div style={{ display: 'flex', gap: 32, fontSize: 12, flexWrap: 'wrap' }}>
                            <div><strong><FaMapMarkerAlt /> Location:</strong><br />{tech.gpsLatitude != null ? `${tech.gpsLatitude.toFixed(6)}, ${tech.gpsLongitude.toFixed(6)}` : '—'}</div>
                            <div><strong><FaClock /> Last Update:</strong><br /><span style={{ color: stale ? 'var(--danger)' : 'inherit' }}>{formatLoc(tech.lastLocationUpdate)}{stale && <FaExclamationTriangle style={{ color: 'var(--danger)', marginLeft: 4 }} />}</span></div>
                            <div><strong><FaEnvelope /> Email:</strong><br />{tech.email || '—'}</div>
                            <div><strong><FaPhone /> Phone:</strong><br />{tech.phone || '—'}</div>
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

      {assignTarget && (
        <div className="modal" onClick={() => setAssignTarget(null)}>
          <div className="edit-modal" onClick={e => e.stopPropagation()}>
            <div className="edit-modal-header"><span><FaUserCheck /> Assign Ticket — {technicians.find(t => t.id === assignTarget)?.name}</span><button className="modal-close-btn" onClick={() => setAssignTarget(null)}><FaTimes /></button></div>
            <form onSubmit={handleAssign}>
              <div className="form-group">
                <label>Select Ticket</label>
                <select className="form-select" value={assignTicketId} onChange={e => setAssignTicketId(e.target.value)} required>
                  <option value="">— Choose a ticket —</option>
                  {tickets.filter(t => !t.assignedTo).map(t => <option key={t.ticketId} value={t.ticketId}>{t.ticketId}: {t.title.substring(0, 40)}</option>)}
                  {tickets.filter(t => t.assignedTo).length > 0 && <optgroup label="Reassign from current provider">{tickets.filter(t => t.assignedTo).map(t => <option key={t.ticketId} value={t.ticketId}>{t.ticketId}: {t.title.substring(0, 30)} ({t.assignedTo})</option>)}</optgroup>}
                </select>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setAssignTarget(null)}>Cancel</button>
                <button type="submit" className="btn btn-teal"><FaUserCheck /> Assign</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Technicians;

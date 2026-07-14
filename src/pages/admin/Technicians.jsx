import React, { useState } from 'react';
import { FaWrench, FaStar, FaMapMarkerAlt, FaPhone, FaEnvelope, FaCheckCircle, FaClock, FaBan, FaExclamationTriangle, FaTimes, FaSearch } from 'react-icons/fa';
import { getTechnicians, updateTechnicianStatus, updateTechnician } from '../../data/store';
import Alert from '../../components/common/Alert';

const ALERT_THRESHOLD = 2.0;
const MIN_JOBS_FOR_ALERT = 5;
const STALE_THRESHOLD_MS = 60 * 60 * 1000;

const STATUS_OPTIONS = ['AVAILABLE', 'ON_CALL', 'OFF_DUTY', 'SUSPENDED'];
const FILTER_OPTIONS = ['ALL', ...STATUS_OPTIONS];

const STATUS_STYLE = {
  AVAILABLE: { className: 'badge badge-completed', label: 'Available' },
  ON_CALL: { className: 'badge badge-info', label: 'On Call' },
  OFF_DUTY: { className: 'badge', label: 'Off Duty' },
  SUSPENDED: { className: 'badge badge-danger', label: 'Suspended' },
};

const Technicians = () => {
  const [technicians, setTechnicians] = useState(getTechnicians);
  const [alert, setAlert] = useState({ msg: '', type: '' });
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRow, setExpandedRow] = useState(null);

  const refresh = () => setTechnicians(getTechnicians());

  const showAlert = (msg, type) => {
    setAlert({ msg, type });
    setTimeout(() => setAlert({ msg: '', type: '' }), 5000);
  };

  const avgRating = technicians.length > 0
    ? (technicians.reduce((sum, t) => sum + t.rating, 0) / technicians.length).toFixed(1)
    : '—';

  const stats = [
    { label: 'Total Technicians', value: technicians.length, icon: FaWrench },
    { label: 'Available', value: technicians.filter(t => t.availabilityStatus === 'AVAILABLE').length, icon: FaCheckCircle },
    { label: 'On Call', value: technicians.filter(t => t.availabilityStatus === 'ON_CALL').length, icon: FaClock },
    { label: 'Off Duty', value: technicians.filter(t => t.availabilityStatus === 'OFF_DUTY').length, icon: FaBan },
    { label: 'Suspended', value: technicians.filter(t => t.availabilityStatus === 'SUSPENDED').length, icon: FaExclamationTriangle },
    { label: 'Avg Rating', value: avgRating, icon: FaStar },
  ];

  const getSpecialisations = (t) => t.specialisations || t.specilisations || [];

  const handleStatusChange = async (techId, newStatus) => {
    const r = await updateTechnicianStatus(techId, newStatus);
    if (r.success) {
      showAlert(`Status updated to ${newStatus} for ${r.data.name}.`, 'success');
      refresh();
    } else {
      showAlert(r.error, 'error');
    }
  };

  const handleSuspend = async (tech) => {
    const r = await updateTechnician(tech.id, { availabilityStatus: 'SUSPENDED' });
    if (r.success) {
      showAlert(`${tech.name} has been suspended.`, 'success');
      refresh();
    } else {
      showAlert(r.error, 'error');
    }
  };

  const filtered = technicians.filter(t => {
    if (statusFilter !== 'ALL' && t.availabilityStatus !== statusFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const match = t.name.toLowerCase().includes(q) ||
        (t.companyName || '').toLowerCase().includes(q) ||
        (t.email || '').toLowerCase().includes(q) ||
        (t.phone || '').includes(q);
      if (!match) return false;
    }
    return true;
  });

  const toggleExpand = (id) => {
    setExpandedRow(prev => prev === id ? null : id);
  };

  const isStale = (isoString) => {
    if (!isoString) return false;
    return Date.now() - new Date(isoString).getTime() > STALE_THRESHOLD_MS;
  };

  const formatLocationTime = (isoString) => {
    if (!isoString) return '—';
    const d = new Date(isoString);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    const remainMins = mins % 60;
    return `${hrs}h ${remainMins}m ago`;
  };

  return (
    <div>
      <div className="card">
        <div className="card-title">
          <span><FaWrench /> Technician Management <span className="req-ref">MOD-009</span></span>
        </div>
        <Alert msg={alert.msg} type={alert.type} />
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
          <span><FaWrench /> Technicians</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <FaSearch style={{ color: 'var(--text-dim)', fontSize: 12 }} />
              <input className="form-input" style={{ width: 180, fontSize: 12, padding: '4px 8px' }} placeholder="Search name, company, email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              <select className="form-select" style={{ width: 'auto', minWidth: 130, fontSize: 11 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                {FILTER_OPTIONS.map(o => <option key={o} value={o}>{o === 'ALL' ? 'All Statuses' : o.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
        </div>
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Company</th>
                <th>Specialisations</th>
                <th>Rating</th>
                <th>Jobs Completed</th>
                <th>Workload</th>
                <th>Availability</th>
                <th>Last Location</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan="9" className="empty-text" style={{ textAlign: 'center', padding: 24 }}>No technicians match the current filter.</td></tr>
              ) : (
                filtered.map(tech => {
                  const specialisations = getSpecialisations(tech);
                  const showRatingAlert = tech.rating < ALERT_THRESHOLD && tech.totalJobsCompleted >= MIN_JOBS_FOR_ALERT;
                  const stale = isStale(tech.lastLocationUpdate);
                  const ss = STATUS_STYLE[tech.availabilityStatus] || STATUS_STYLE.AVAILABLE;
                  const excludedFromRouting = tech.availabilityStatus === 'OFF_DUTY' || tech.availabilityStatus === 'SUSPENDED';

                  return (
                    <React.Fragment key={tech.id}>
                      <tr style={showRatingAlert ? { backgroundColor: 'rgba(255, 191, 0, 0.08)' } : {}}>
                        <td>
                          <strong>{tech.name}</strong>
                          {showRatingAlert && (
                            <FaExclamationTriangle
                              style={{ color: 'var(--amber)', marginLeft: 6, cursor: 'help' }}
                              title={`Underperforming: rating below ${ALERT_THRESHOLD} threshold (REQ-050)`}
                            />
                          )}
                        </td>
                        <td>{tech.companyName || '—'}</td>
                        <td style={{ fontSize: 12 }}>{specialisations.join(', ') || '—'}</td>
                        <td>
                          <FaStar style={{ color: 'var(--amber)', marginRight: 4 }} />
                          {tech.rating.toFixed(1)}
                        </td>
                        <td className="cell-mono">{tech.totalJobsCompleted}</td>
                        <td className="cell-mono">{tech.currentWorkload}</td>
                        <td>
                          <span className={ss.className} style={ss.className === 'badge' ? { backgroundColor: 'var(--text-dim)', color: '#fff' } : {}}>
                            {ss.label}
                          </span>
                          {excludedFromRouting && (
                            <span style={{
                              marginLeft: 4, fontSize: 9, padding: '1px 4px', borderRadius: 2, whiteSpace: 'nowrap',
                              backgroundColor: 'rgba(192,57,43,0.12)', color: 'var(--danger)',
                            }} title="Excluded from auto-routing (BR-007)"><FaBan style={{ fontSize: 8, marginRight: 2 }} />Routing</span>
                          )}
                        </td>
                        <td>
                          <span style={{ fontSize: 12, color: stale ? 'var(--danger)' : 'var(--text-dim)' }}>
                            <FaMapMarkerAlt style={{ marginRight: 4 }} />
                            {tech.gpsLatitude && tech.gpsLongitude
                              ? `${tech.gpsLatitude.toFixed(4)}, ${tech.gpsLongitude.toFixed(4)}`
                              : '—'}
                          </span>
                        </td>
                        <td>
                          <div className="action-cell">
                            <button className="btn btn-secondary btn-sm" onClick={() => toggleExpand(tech.id)} title="Details">
                              <FaMapMarkerAlt />
                            </button>
                            <select
                              className="form-select"
                              style={{ width: 'auto', minWidth: 90, fontSize: 11, padding: '2px 4px' }}
                              value={tech.availabilityStatus}
                              onChange={e => handleStatusChange(tech.id, e.target.value)}
                            >
                              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                            </select>
                            {tech.rating < ALERT_THRESHOLD && (
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => handleSuspend(tech)}
                                title={`Underperforming: rating below ${ALERT_THRESHOLD} threshold (REQ-050)`}
                              >
                                <FaBan />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {expandedRow === tech.id && (
                        <tr className="expanded-row">
                          <td colSpan="9" style={{ padding: '8px 16px', backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', gap: 32, fontSize: 12, flexWrap: 'wrap' }}>
                              <div>
                                <strong><FaMapMarkerAlt /> Location:</strong><br />
                                {tech.gpsLatitude && tech.gpsLongitude
                                  ? `${tech.gpsLatitude.toFixed(6)}, ${tech.gpsLongitude.toFixed(6)}`
                                  : '—'}
                              </div>
                              <div>
                                <strong><FaClock /> Last Update:</strong><br />
                                <span style={{ color: stale ? 'var(--danger)' : 'inherit', fontWeight: stale ? 600 : 'normal' }}>
                                  {formatLocationTime(tech.lastLocationUpdate)}
                                  {stale && <FaExclamationTriangle style={{ color: 'var(--danger)', marginLeft: 4 }} title="Stale: > 1 hour old" />}
                                </span>
                              </div>
                              <div>
                                <strong><FaEnvelope /> Email:</strong><br />
                                {tech.email || '—'}
                              </div>
                              <div>
                                <strong><FaPhone /> Phone:</strong><br />
                                {tech.phone || '—'}
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
    </div>
  );
};

export default Technicians;

import React, { useState, useMemo } from 'react';
import { FaExclamationTriangle, FaBolt, FaBuilding, FaBox, FaUser, FaCalendarAlt, FaWrench, FaStar, FaMapMarkerAlt, FaClock, FaPlay, FaBell, FaTrophy, FaUsers } from 'react-icons/fa';
import { getSession } from '../../data/authStore';
import { getTickets, getTechnicians, updateTicketStatus } from '../../data/store';
import StatusBadge from '../../components/common/StatusBadge';

const Emergency = () => {
  const session = getSession();
  const providerName = session ? `${session.name} ${session.surname}` : '';
  const [tickets, setTickets] = useState(getTickets());
  const [technicians] = useState(getTechnicians());
  const [msg, setMsg] = useState({ text: '', type: '' });

  const refresh = () => setTickets(getTickets());

  const myEmergencyTickets = tickets.filter(t =>
    t.assignedTo === providerName &&
    (t.priority === 'URGENT' || t.priority === 'EMERGENCY')
  );

  const openEmergencyJobs = tickets.filter(t =>
    (!t.assignedTo || t.assignedTo !== providerName) &&
    t.status === 'Open' &&
    (t.priority === 'URGENT' || t.priority === 'EMERGENCY')
  );

  const emergencyQualifiedProviders = useMemo(() => {
    return technicians
      .filter(t => t.availabilityStatus === 'AVAILABLE' || t.availabilityStatus === 'ON_CALL')
      .sort((a, b) => (b.rating || 0) - (a.rating || 0));
  }, [technicians]);

  const showMsg = (text, type) => { setMsg({ text, type }); setTimeout(() => setMsg({ text: '', type: '' }), 4000); };

  const handleAccept = async (ticketId) => {
    const r = await updateTicketStatus(ticketId, 'In Progress');
    if (r.success) { refresh(); showMsg(`${ticketId} accepted — job started`, 'success'); }
    else { showMsg(r.error, 'error'); }
  };

  const formatTimeSince = (iso) => {
    if (!iso) return null;
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
  };

  const getAutoAssignTime = (ticket) => {
    if (!ticket.createdAt) return null;
    const created = new Date(ticket.createdAt).getTime();
    const elapsed = Date.now() - created;
    const remaining = 20 * 60 * 1000 - elapsed;
    return { elapsed, remaining, isOverdue: remaining <= 0 };
  };

  return (
    <>
      <div className="welcome-banner" style={{ borderLeft: '4px solid var(--danger)', background: 'rgba(192,57,43,0.06)' }}>
        <h2 style={{ color: 'var(--danger)' }}><FaExclamationTriangle /> Emergency Center</h2>
        <p>Emergency-priority auto-assignments and active urgent jobs. <span className="req-ref">REQ-036 / NFR-S02 / BR-003</span></p>
      </div>

      {msg.text && <div className={`alert alert-${msg.type}`} style={{ marginBottom: 8 }}>{msg.text}</div>}

      {openEmergencyJobs.length > 0 && (
        <div className="card" style={{ border: '2px solid var(--danger)', marginBottom: 16 }}>
          <div className="card-title" style={{ color: 'var(--danger)' }}>
            <FaBell /> Incoming Emergency — Unassigned ({openEmergencyJobs.length})
          </div>
          <div style={{ padding: '8px 12px', background: 'rgba(192,57,43,0.04)', borderRadius: 4, marginBottom: 8, fontSize: 12 }}>
            <FaClock /> BR-003: Auto-assignment window is 20 minutes. Unassigned emergencies will be routed to the highest-ranked available provider.
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr style={{ background: 'rgba(192,57,43,0.08)' }}>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Property</th>
                  <th>Unit</th>
                  <th>Created</th>
                  <th>Auto-Assign In</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {openEmergencyJobs.map(t => {
                  const aa = getAutoAssignTime(t);
                  return (
                    <tr key={t.ticketId} style={{ background: aa?.isOverdue ? 'rgba(192,57,43,0.06)' : 'transparent' }}>
                      <td className="cell-mono" style={{ color: 'var(--danger)', fontWeight: 700 }}>{t.ticketId}</td>
                      <td><strong>{t.title}</strong></td>
                      <td>{t.propertyName}</td>
                      <td>Unit {t.unitNumber}</td>
                      <td style={{ fontSize: 11 }}>{t.createdAt}</td>
                      <td>
                        {aa ? (
                          aa.isOverdue
                            ? <span style={{ color: 'var(--danger)', fontWeight: 600 }}>Overdue</span>
                            : <span style={{ color: 'var(--amber)' }}>{Math.ceil(aa.remaining / 60000)}m remaining</span>
                        ) : '—'}
                      </td>
                      <td>
                        <button className="btn btn-danger btn-sm" onClick={() => handleAccept(t.ticketId)}>
                          <FaPlay /> Accept Emergency
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-title" style={{ color: 'var(--danger)' }}>
          <FaBolt /> My Emergency Jobs ({myEmergencyTickets.length})
        </div>
        {myEmergencyTickets.length === 0 ? (
          <div className="empty-state"><div className="empty-text">No emergency jobs assigned.</div></div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Property / Unit</th>
                  <th>Created</th>
                  <th>By</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {myEmergencyTickets.map(t => (
                  <tr key={t.ticketId}>
                    <td className="cell-mono" style={{ color: 'var(--danger)', fontWeight: 700 }}>{t.ticketId}</td>
                    <td><strong>{t.title}</strong></td>
                    <td><StatusBadge status={t.status} /></td>
                    <td style={{ fontSize: 12 }}>{t.propertyName} / Unit {t.unitNumber}</td>
                    <td style={{ fontSize: 11 }}>{t.createdAt}</td>
                    <td style={{ fontSize: 12 }}>{t.createdBy}</td>
                    <td>
                      {t.status === 'Assigned' && (
                        <button className="btn btn-danger btn-sm" onClick={() => handleAccept(t.ticketId)}>
                          <FaPlay /> Start Now
                        </button>
                      )}
                      {t.status === 'In Progress' && (
                        <button className="btn btn-teal btn-sm" onClick={async () => {
                          const r = await updateTicketStatus(t.ticketId, 'Completed (Provider)');
                          if (r.success) { refresh(); showMsg(`${t.ticketId} marked complete`, 'success'); }
                          else { showMsg(r.error, 'error'); }
                        }}>
                          Complete
                        </button>
                      )}
                      {t.status === 'Completed (Provider)' && <span className="badge badge-completed">Awaiting Close</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="main-cols" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="card-title"><FaTrophy /> Emergency-Qualified Providers</div>
          <div style={{ fontSize: 12, lineHeight: 2 }}>
            {emergencyQualifiedProviders.length === 0 ? (
              <div style={{ color: 'var(--text-dim)' }}>No available emergency providers.</div>
            ) : (
              emergencyQualifiedProviders.map((p, i) => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                  <span>{i === 0 && <FaStar style={{ color: 'var(--amber)', marginRight: 4 }} />}{p.name}</span>
                  <span style={{ color: 'var(--text-dim)' }}>
                    <FaStar style={{ color: 'var(--amber)', fontSize: 10 }} /> {p.rating.toFixed(1)}
                    <span style={{ marginLeft: 8 }}>{p.specialisations?.join(', ')}</span>
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="card">
          <div className="card-title"><FaClock /> 20-Minute Window (BR-003)</div>
          <div style={{ fontSize: 12, lineHeight: 1.8, color: 'var(--text-mid)' }}>
            <p>Emergency tickets that remain unassigned for 20 minutes are automatically routed to the highest-ranked available provider with Emergency category qualification.</p>
            <p style={{ marginTop: 8 }}>When a provider is assigned, all Emergency-qualified providers and the property manager receive instant notifications (NFR-S02, 30-second delivery target).</p>
            <p style={{ marginTop: 8, color: 'var(--amber)' }}><FaExclamationTriangle /> If you decline an emergency assignment, it is re-offered to the next-highest-ranked provider.</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default Emergency;
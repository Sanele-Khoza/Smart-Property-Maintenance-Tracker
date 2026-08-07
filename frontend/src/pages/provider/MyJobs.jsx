import React, { useState } from 'react';
import { FaTicketAlt, FaSearch, FaCheck, FaTimes, FaPlay, FaPause, FaWrench, FaBuilding, FaBox, FaUser, FaCalendarAlt, FaBolt, FaEye, FaUndo } from 'react-icons/fa';
import { getSession } from '../../data/authStore';
import { acceptJob, startJob, waitForParts, partsReceived, submitJobCompletion } from '../../data/store';
import StatusBadge from '../../components/common/StatusBadge';
import useTickets from '../../hooks/useTickets';

const STATUS_TABS = ['all', 'Assigned', 'Accepted', 'In Progress', 'Waiting for Parts', 'Completed'];

const MyJobs = ({ onViewDetails }) => {
  const session = getSession();
  const providerName = session ? `${session.name} ${session.surname}` : '';
  const [tickets, refresh] = useTickets();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [msg, setMsg] = useState({ text: '', type: '' });

  const myTickets = tickets.filter(t => t.assignedTo === providerName || (session && t.assignedToId === session.id));

  const filtered = myTickets.filter(t => {
    if (filter !== 'all' && t.status !== filter) return false;
    if (search && !t.ticketId.toLowerCase().includes(search.toLowerCase()) && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const showMsg = (text, type) => { setMsg({ text, type }); setTimeout(() => setMsg({ text: '', type: '' }), 3000); };

  const countByStatus = (status) => status === 'all' ? myTickets.length : myTickets.filter(t => t.status === status).length;

  const run = async (promise, successText) => {
    const r = await promise;
    if (r.success) { refresh(); showMsg(successText, 'success'); }
    else { showMsg(r.error, 'error'); }
  };

  const ActionButtons = ({ t }) => {
    switch (t.status) {
      case 'Assigned':
        return (
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn btn-teal btn-sm" onClick={() => run(acceptJob(t.ticketId), `${t.ticketId} accepted.`)} title="Accept job"><FaPlay /> Accept</button>
          </div>
        );
      case 'Accepted':
        return (
          <button className="btn btn-teal btn-sm" onClick={() => run(startJob(t.ticketId), `${t.ticketId} started.`)} title="Start work"><FaPlay /> Start</button>
        );
      case 'In Progress':
        return (
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => run(waitForParts(t.ticketId), `${t.ticketId} → Waiting for Parts`)}><FaPause /> Waiting for Parts</button>
            <button className="btn btn-teal btn-sm" onClick={() => run(submitJobCompletion(t.ticketId, '', []), `${t.ticketId} completed.`)}><FaCheck /> Complete</button>
          </div>
        );
      case 'Waiting for Parts':
        return (
          <button className="btn btn-primary btn-sm" onClick={() => run(partsReceived(t.ticketId), `${t.ticketId} resumed.`)}><FaPlay /> Resume</button>
        );
      case 'Completed':
        return <span className="badge badge-completed" style={{ fontSize: 10 }}><FaCheck /> Awaiting Confirmation</span>;
      default:
        return null;
    }
  };

  return (
    <>
      <div className="welcome-banner"><h2><FaWrench /> My Jobs</h2><p>Manage your assigned maintenance jobs. <span className="req-ref">MOD-007 / SRS §3.1.5</span></p></div>
      {msg.text && <div className={`alert alert-${msg.type}`} style={{ marginBottom: 8 }}>{msg.text}</div>}
      <div className="card">
        <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <span><FaTicketAlt /> Jobs ({myTickets.length})</span>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
            {STATUS_TABS.map(s => (
              <button key={s} className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter(s)}>
                {s === 'all' ? 'All' : s} <span className="badge" style={{ fontSize: 9, marginLeft: 2, opacity: 0.7 }}>({countByStatus(s)})</span>
              </button>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8 }}>
              <FaSearch /><input className="form-input" style={{ width: 140, padding: '4px 6px', fontSize: 11 }} placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="empty-state"><div className="empty-text">No jobs match the current filter.</div></div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Property / Unit</th>
                  <th>Created</th>
                  <th>By</th>
                  <th>Actions</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => (
                  <React.Fragment key={t.ticketId}>
                    <tr style={{ background: expandedId === t.ticketId ? 'var(--surface2)' : 'transparent' }}>
                      <td className="cell-mono">{t.ticketId}</td>
                      <td><strong>{t.title}</strong></td>
                      <td><StatusBadge status={t.status} /></td>
                      <td><span className={`badge ${t.priority === 'URGENT' || t.priority === 'EMERGENCY' ? 'badge-danger' : t.priority === 'HIGH' ? 'badge-warning' : 'badge-open'}`}>{t.priority}</span></td>
                      <td style={{ fontSize: 12 }}>{t.propertyName} / Unit {t.unitNumber}</td>
                      <td style={{ fontSize: 11 }}>{t.createdAt}</td>
                      <td style={{ fontSize: 12 }}>{t.createdBy}</td>
                      <td><ActionButtons t={t} /></td>
                      <td>
                        <button className="btn btn-secondary btn-sm" onClick={() => setExpandedId(expandedId === t.ticketId ? null : t.ticketId)} title="Quick view"><FaEye /></button>
                        {onViewDetails && <button className="btn btn-primary btn-sm" style={{ marginLeft: 4 }} onClick={() => onViewDetails(t.ticketId)} title="Full details">Open</button>}
                      </td>
                    </tr>
                    {expandedId === t.ticketId && (
                      <tr>
                        <td colSpan={9} style={{ padding: '12px 16px', background: 'var(--surface2)' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
                            <div><strong>Description:</strong><br />{t.description}</div>
                            <div>
                              <strong>Details</strong>
                              <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.8 }}>
                                <div><FaBuilding /> {t.propertyName}</div>
                                <div><FaBox /> Unit {t.unitNumber}</div>
                                <div><FaUser /> {t.createdBy}</div>
                                <div><FaCalendarAlt /> Created: {t.createdAt} | Updated: {t.updatedAt}</div>
                                <div><FaBolt /> {t.priority}{t.category ? ` — Category: ${t.category}` : ''}</div>
                              </div>
                            </div>
                          </div>
                          {t.images && t.images.length > 0 && (
                            <div style={{ marginTop: 8 }}>
                              <strong>Attachments:</strong>
                              <div className="image-preview-grid" style={{ marginTop: 4 }}>
                                {t.images.map((img, idx) => (
                                  <div key={idx} className="image-preview" style={{ width: 60, height: 60 }}>
                                    <img src={img} alt="" />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
};

export default MyJobs;
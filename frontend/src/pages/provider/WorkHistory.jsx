import React, { useState } from 'react';
import { FaHistory, FaStar, FaBuilding, FaBox, FaUser, FaCalendarAlt, FaCheckCircle, FaSearch, FaFilter, FaClock, FaQuoteLeft } from 'react-icons/fa';
import { getSession } from '../../data/authStore';
import { getTickets } from '../../data/store';
import StatusBadge from '../../components/common/StatusBadge';

const WorkHistory = () => {
  const session = getSession();
  const providerName = session ? `${session.name} ${session.surname}` : '';
  const [tickets] = useState(getTickets());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);

  const completedTickets = tickets.filter(t =>
    (t.assignedTo === providerName || (session && t.assignedToId === session.id)) &&
    (t.status === 'Completed' || t.status === 'Tenant Confirmed' || t.status === 'Closed')
  );

  const filtered = completedTickets.filter(t => {
    if (statusFilter === 'rated' && !t.rating) return false;
    if (statusFilter === 'unrated' && t.rating) return false;
    if (search && !t.ticketId.toLowerCase().includes(search.toLowerCase()) && !t.title.toLowerCase().includes(search.toLowerCase()) && !t.propertyName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

  const stats = {
    total: completedTickets.length,
    rated: completedTickets.filter(t => t.rating).length,
    avgRating: (() => {
      const rated = completedTickets.filter(t => t.rating);
      if (rated.length === 0) return null;
      return rated.reduce((s, t) => s + t.rating, 0) / rated.length;
    })(),
  };

  return (
    <>
      <div className="welcome-banner"><h2><FaHistory /> Work History</h2><p>Completed jobs and tenant ratings. <span className="req-ref">REQ-047 / REQ-048 / REQ-049</span></p></div>
      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <div className="stat-card"><div className="stat-value">{stats.total}</div><div className="stat-label">Completed Jobs</div></div>
        <div className="stat-card"><div className="stat-value" style={{ color: 'var(--amber)' }}>{stats.rated}</div><div className="stat-label">Rated</div></div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--amber)' }}>
            {stats.avgRating !== null ? <><FaStar /> {stats.avgRating.toFixed(1)}</> : '—'}
          </div>
          <div className="stat-label">Avg Rating</div>
        </div>
      </div>
      <div className="card">
        <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <span><FaHistory /> Job History ({filtered.length})</span>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button className={`btn btn-sm ${statusFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setStatusFilter('all')}>All</button>
            <button className={`btn btn-sm ${statusFilter === 'rated' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setStatusFilter('rated')}><FaStar /> Rated</button>
            <button className={`btn btn-sm ${statusFilter === 'unrated' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setStatusFilter('unrated')}>Unrated</button>
            <FaSearch style={{ marginLeft: 8 }} /><input className="form-input" style={{ width: 140, padding: '4px 6px', fontSize: 11 }} placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="empty-state"><div className="empty-text">No completed jobs found.</div></div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Property</th>
                  <th>Unit</th>
                  <th>Completed</th>
                  <th>Rating</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => (
                  <React.Fragment key={t.ticketId}>
                    <tr style={{ background: expandedId === t.ticketId ? 'var(--surface2)' : 'transparent', cursor: 'pointer' }} onClick={() => setExpandedId(expandedId === t.ticketId ? null : t.ticketId)}>
                      <td><strong>{t.title}</strong></td>
                      <td><StatusBadge status={t.status} /></td>
                      <td style={{ fontSize: 12 }}>{t.propertyName}</td>
                      <td>Unit {t.unitNumber}</td>
                      <td style={{ fontSize: 11 }}>{t.updatedAt}</td>
                      <td>
                        {t.rating ? (
                          <span style={{ color: 'var(--amber)' }}>
                            {'★'.repeat(t.rating)}{'☆'.repeat(5 - t.rating)}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>No rating</span>
                        )}
                      </td>
                      <td><button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === t.ticketId ? null : t.ticketId); }}>{expandedId === t.ticketId ? '−' : '+'}</button></td>
                    </tr>
                    {expandedId === t.ticketId && (
                      <tr>
                        <td colSpan={7} style={{ padding: '12px 16px', background: 'var(--surface2)' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
                            <div>
                              <strong>Details</strong>
                              <div style={{ marginTop: 4, lineHeight: 1.8, fontSize: 12 }}>
                                <div><FaBuilding /> {t.propertyName}</div>
                                <div><FaBox /> Unit {t.unitNumber}</div>
                                <div><FaUser /> Created by: {t.createdBy}</div>
                                <div><FaCalendarAlt /> Created: {t.createdAt}</div>
                                <div><FaClock /> Completed: {t.updatedAt}</div>
                                {t.assignedTo && <div><FaCheckCircle /> Provider: {t.assignedTo}</div>}
                              </div>
                            </div>
                            <div>
                              <strong>Rating</strong>
                              <div style={{ marginTop: 4 }}>
                                {t.rating ? (
                                  <>
                                    <div style={{ fontSize: 20, color: 'var(--amber)' }}>
                                      {'★'.repeat(t.rating)}{'☆'.repeat(5 - t.rating)}
                                      <span style={{ fontSize: 14, marginLeft: 8, color: 'var(--text-dim)' }}>{t.rating}/5</span>
                                    </div>
                                    {t.ratingComment && (
                                      <div style={{ marginTop: 8, padding: 8, background: 'var(--surface)', borderRadius: 4, fontSize: 12, fontStyle: 'italic' }}>
                                        <FaQuoteLeft style={{ marginRight: 4, opacity: 0.3 }} />{t.ratingComment}
                                      </div>
                                    )}
                                    {t.ratingSubmittedAt && (
                                      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>Submitted: {new Date(t.ratingSubmittedAt).toLocaleString()}</div>
                                    )}
                                  </>
                                ) : (
                                  <span style={{ color: 'var(--text-dim)' }}>No rating submitted yet.</span>
                                )}
                              </div>
                            </div>
                          </div>
                          {t.images && t.images.length > 0 && (
                            <div style={{ marginTop: 8 }}>
                              <strong>Completion Photos:</strong>
                              <div className="image-preview-grid" style={{ marginTop: 4 }}>
                                {t.images.map((img, idx) => (
                                  <div key={idx} className="image-preview" style={{ width: 64, height: 64 }}>
                                    <img src={img} alt={`Job photo ${idx + 1}`} />
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

export default WorkHistory;
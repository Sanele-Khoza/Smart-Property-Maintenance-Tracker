import React, { useState } from 'react';
import { FaChartBar, FaStar, FaWrench, FaCheckCircle, FaClock, FaBuilding, FaBox, FaUser, FaCalendarAlt, FaTrophy } from 'react-icons/fa';
import { getSession } from '../../data/authStore';
import { getTickets, getTechnicians } from '../../data/store';

const MyPerformance = () => {
  const session = getSession();
  const providerName = session ? `${session.name} ${session.surname}` : '';
  const [tickets] = useState(getTickets());
  const [technicians] = useState(getTechnicians());

  const myTickets = tickets.filter(t => t.assignedTo === providerName);
  const myTech = technicians.find(t => t.name === providerName);

  const completed = myTickets.filter(t => t.status === 'Completed' || t.status === 'Tenant Confirmed' || t.status === 'Closed');
  const rated = completed.filter(t => t.rating);
  const avgRating = rated.length > 0 ? rated.reduce((s, t) => s + t.rating, 0) / rated.length : null;

  const ratingDistribution = [0, 0, 0, 0, 0];
  rated.forEach(t => { if (t.rating >= 1 && t.rating <= 5) ratingDistribution[t.rating - 1]++; });

  const timeline = {};
  myTickets.forEach(t => {
    if (!t.createdAt) return;
    const month = t.createdAt.substring(0, 7) || 'Unknown';
    if (!timeline[month]) timeline[month] = { total: 0, completed: 0 };
    timeline[month].total++;
    if (t.status === 'Completed' || t.status === 'Tenant Confirmed' || t.status === 'Closed') timeline[month].completed++;
  });

  const recentMonths = Object.entries(timeline).sort().slice(-6);

  return (
    <>
      <div className="welcome-banner"><h2><FaChartBar /> My Performance</h2><p>Personal job completion and rating summary.</p></div>
      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <div className="stat-card"><div className="stat-value">{myTickets.length}</div><div className="stat-label">Total Jobs</div></div>
        <div className="stat-card"><div className="stat-value" style={{ color: 'var(--teal)' }}>{completed.length}</div><div className="stat-label">Completed</div></div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--amber)' }}>
            {avgRating !== null ? <><FaStar /> {avgRating.toFixed(1)}</> : '—'}
          </div>
          <div className="stat-label">Avg Rating</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{myTech?.specialisations?.length || 0}</div>
          <div className="stat-label">Specialisations</div>
        </div>
      </div>
      <div className="main-cols">
        <div className="card">
          <div className="card-title"><FaTrophy /> Rating Breakdown</div>
          {rated.length === 0 ? (
            <div className="empty-state"><div className="empty-text">No ratings yet.</div></div>
          ) : (
            <div style={{ padding: '8px 0' }}>
              {[5, 4, 3, 2, 1].map(star => {
                const count = ratingDistribution[star - 1] || 0;
                const pct = rated.length > 0 ? (count / rated.length) * 100 : 0;
                return (
                  <div key={star} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 12 }}>
                    <span style={{ width: 30, color: 'var(--amber)' }}>{'★'.repeat(star)}{'☆'.repeat(5 - star)}</span>
                    <div style={{ flex: 1, height: 14, background: 'var(--surface)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'var(--amber)', borderRadius: 3 }} />
                    </div>
                    <span style={{ width: 30, textAlign: 'right', color: 'var(--text-dim)' }}>{count}</span>
                  </div>
                );
              })}
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-dim)' }}>
                {rated.length} job(s) rated · Avg {avgRating?.toFixed(1) || '—'}/5
              </div>
            </div>
          )}
        </div>
        <div className="card">
          <div className="card-title"><FaCalendarAlt /> Monthly Activity</div>
          {recentMonths.length === 0 ? (
            <div className="empty-state"><div className="empty-text">No job data.</div></div>
          ) : (
            <div style={{ padding: '8px 0' }}>
              {recentMonths.map(([month, data]) => {
                const pct = data.total > 0 ? (data.completed / data.total) * 100 : 0;
                return (
                  <div key={month} style={{ marginBottom: 10, fontSize: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontWeight: 600 }}>{month}</span>
                      <span style={{ color: 'var(--text-dim)' }}>{data.completed}/{data.total} done</span>
                    </div>
                    <div style={{ height: 8, background: 'var(--surface)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'var(--teal)', borderRadius: 4 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title"><FaWrench /> My Specialisations</div>
        {myTech?.specialisations?.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {myTech.specialisations.map(s => (
              <span key={s} className="badge badge-completed" style={{ fontSize: 11 }}>{s}</span>
            ))}
          </div>
        ) : (
          <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>No specialisations listed.</span>
        )}
        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
          <div><strong>Company:</strong> {myTech?.companyName || '—'}</div>
          <div><strong>Workload:</strong> {myTech?.currentWorkload || 0} active job(s)</div>
          <div><strong>Availability:</strong> {myTech?.availabilityStatus || '—'}</div>
          <div><strong>Jobs Completed:</strong> {myTech?.totalJobsCompleted || 0}</div>
        </div>
      </div>
    </>
  );
};

export default MyPerformance;
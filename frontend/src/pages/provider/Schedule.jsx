import React, { useState } from 'react';
import { FaCalendarAlt, FaChevronLeft, FaChevronRight, FaWrench, FaBuilding, FaBox, FaClock, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';
import { getSession } from '../../data/authStore';
import { getTickets } from '../../data/store';
import StatusBadge from '../../components/common/StatusBadge';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const Schedule = () => {
  const session = getSession();
  const providerName = session ? `${session.name} ${session.surname}` : '';
  const [tickets] = useState(getTickets());
  const [weekOffset, setWeekOffset] = useState(0);

  const myTickets = tickets.filter(t => t.assignedTo === providerName);

  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() + weekOffset * 7 - today.getDay());

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    return d;
  });

  const getTicketsForDay = (date) => {
    const dateStr = date.toLocaleDateString();
    return myTickets.filter(t => {
      const created = t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '';
      const updated = t.updatedAt ? new Date(t.updatedAt).toLocaleDateString() : '';
      return created === dateStr || updated === dateStr;
    });
  };

  const isToday = (date) => date.toDateString() === today.toDateString();

  const statusCounts = {
    assigned: myTickets.filter(t => t.status === 'Assigned').length,
    inProgress: myTickets.filter(t => t.status === 'In Progress').length,
    waiting: myTickets.filter(t => t.status === 'Waiting for Parts').length,
    completed: myTickets.filter(t => t.status === 'Completed' || t.status === 'Tenant Confirmed' || t.status === 'Closed').length,
  };

  return (
    <>
      <div className="welcome-banner"><h2><FaCalendarAlt /> My Schedule</h2><p>Upcoming job visits mapped to your assigned tickets.</p></div>
      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <div className="stat-card"><div className="stat-value">{statusCounts.assigned}</div><div className="stat-label">Assigned</div></div>
        <div className="stat-card"><div className="stat-value">{statusCounts.inProgress}</div><div className="stat-label">In Progress</div></div>
        <div className="stat-card"><div className="stat-value">{statusCounts.waiting}</div><div className="stat-label">Waiting</div></div>
        <div className="stat-card"><div className="stat-value">{statusCounts.completed}</div><div className="stat-label">Completed</div></div>
      </div>
      <div className="card">
        <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setWeekOffset(w => w - 1)}><FaChevronLeft /></button>
          <span style={{ fontSize: 14, fontWeight: 600 }}>
            {weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — {weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          <button className="btn btn-secondary btn-sm" onClick={() => setWeekOffset(w => w + 1)}><FaChevronRight /></button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginTop: 8 }}>
          {weekDays.map((day, idx) => {
            const dayTickets = getTicketsForDay(day);
            return (
              <div key={idx} style={{
                minHeight: 120, padding: 6, borderRadius: 4,
                background: isToday(day) ? 'rgba(45,183,145,0.06)' : 'var(--surface)',
                border: isToday(day) ? '1px solid var(--teal)' : '1px solid var(--border)',
              }}>
                <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 4, color: isToday(day) ? 'var(--teal)' : 'var(--text-dim)' }}>
                  {DAYS[day.getDay()]} {day.getDate()}
                </div>
                {dayTickets.length === 0 ? (
                  <div style={{ fontSize: 9, color: 'var(--text-dim)', opacity: 0.5 }}>No jobs</div>
                ) : (
                  dayTickets.map(t => (
                    <div key={t.ticketId} style={{
                      padding: '3px 4px', marginBottom: 2, borderRadius: 2, fontSize: 9,
                      background: t.status === 'Completed' || t.status === 'Tenant Confirmed' || t.status === 'Closed' ? 'rgba(45,183,145,0.1)' :
                        t.status === 'In Progress' ? 'rgba(243,156,18,0.1)' : 'rgba(52,152,219,0.1)',
                      cursor: 'default',
                    }}>
                      <div style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: 8 }}>{t.ticketId}</div>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                      <div style={{ fontSize: 8, color: 'var(--text-dim)' }}>{t.propertyName} / U{t.unitNumber}</div>
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <div className="card-title"><FaWrench /> All Scheduled Jobs ({myTickets.length})</div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Property</th>
                <th>Unit</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {myTickets.map(t => (
                <tr key={t.ticketId}>
                  <td className="cell-mono">{t.ticketId}</td>
                  <td>{t.title}</td>
                  <td><StatusBadge status={t.status} /></td>
                  <td><span className={`badge ${t.priority === 'URGENT' || t.priority === 'EMERGENCY' ? 'badge-danger' : 'badge-open'}`}>{t.priority}</span></td>
                  <td>{t.propertyName}</td>
                  <td>Unit {t.unitNumber}</td>
                  <td style={{ fontSize: 11 }}>{t.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default Schedule;
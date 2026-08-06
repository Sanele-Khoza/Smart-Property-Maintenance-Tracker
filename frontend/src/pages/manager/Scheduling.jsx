import React, { useState, useMemo } from 'react';
import { FaCalendarAlt, FaClock, FaWrench, FaUser, FaBuilding, FaMapMarkerAlt, FaChevronLeft, FaChevronRight, FaCheckCircle, FaSpinner } from 'react-icons/fa';
import { getTickets, getTechnicians, getProperties } from '../../data/store';
import { getSession } from '../../data/authStore';

const STATUS_COLORS = {
  'Assigned': '#3278dc',
  'Accepted': '#3278dc',
  'In Progress': '#2db791',
  'Waiting for Parts': '#8250c8',
  'Completed': '#2db791',
  'Tenant Confirmed': '#2db791',
  'Scheduled': '#f0b432',
};

const Scheduling = () => {
  const session = getSession();
  const pmName = session ? `${session.name} ${session.surname}` : '';
  const [allProperties] = useState(getProperties);
  const [allTickets] = useState(() => getTickets().filter(t => ['Assigned', 'In Progress', 'Waiting for Parts'].includes(t.status)));
  const propNames = useMemo(() => new Set(allProperties.filter(p => p.managerName === pmName).map(p => p.name)), [allProperties, pmName]);
  const tickets = useMemo(() => allTickets.filter(t => propNames.has(t.propertyName)), [allTickets, propNames]);
  const [technicians] = useState(getTechnicians);
  const [weekOffset, setWeekOffset] = useState(0);

  const startOfWeek = () => {
    const d = new Date();
    d.setDate(d.getDate() + weekOffset * 7);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const weekStart = startOfWeek();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const weekLabel = weekOffset === 0 ? 'This Week' : weekOffset === -1 ? 'Last Week' : weekOffset === 1 ? 'Next Week' : `Week ${weekOffset > 0 ? '+' : ''}${weekOffset}`;

  const getEventsForDay = (day) => {
    const dayStr = day.toDateString();
    return tickets.filter(t => {
      const created = new Date(t.createdAt);
      return created.toDateString() === dayStr || (t.updatedAt && new Date(t.updatedAt).toDateString() === dayStr);
    });
  };

  const techMap = {};
  technicians.forEach(t => { techMap[t.name] = t; });

  const stats = [
    { label: 'Active Assignments', value: tickets.length, icon: FaWrench },
    { label: 'Technicians', value: technicians.filter(t => t.availabilityStatus === 'AVAILABLE' || t.availabilityStatus === 'ON_CALL').length, icon: FaUser },
  ];

  return (
    <div>
      <div className="card">
        <div className="card-title">
          <span><FaCalendarAlt /> Scheduling <span className="req-ref">SRS §3.1.3 — Access Date Scheduling</span></span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>{weekLabel}</span>
            <button className="btn btn-secondary btn-sm" onClick={() => setWeekOffset(p => p - 1)}><FaChevronLeft /></button>
            <button className="btn btn-secondary btn-sm" onClick={() => setWeekOffset(0)}>Today</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setWeekOffset(p => p + 1)}><FaChevronRight /></button>
          </div>
        </div>
        <div className="stat-grid">{stats.map((s, i) => (<div className="stat-card" key={i}><div className="stat-value"><s.icon /> {s.value}</div><div className="stat-label">{s.label}</div></div>))}</div>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(7, 1fr)`, gap: 4, minWidth: 700 }}>
          {days.map((day, i) => {
            const events = getEventsForDay(day);
            const isToday = day.toDateString() === new Date().toDateString();
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
            return (
              <div key={i} style={{
                border: `1px solid ${isToday ? 'var(--amber)' : 'var(--border)'}`,
                borderRadius: 4, minHeight: 200, padding: 6,
                backgroundColor: isToday ? 'rgba(240,180,50,0.04)' : isWeekend ? 'rgba(255,255,255,0.02)' : 'transparent',
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, textAlign: 'center', marginBottom: 4, color: isToday ? 'var(--amber)' : isWeekend ? 'var(--text-dim)' : 'var(--text)' }}>
                  {day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </div>
                {events.length === 0 && <div style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'center', paddingTop: 20 }}>No visits</div>}
                {events.slice(0, 4).map(t => {
                  const tech = techMap[t.assignedTo];
                  const color = STATUS_COLORS[t.status] || 'var(--text-dim)';
                  return (
                    <div key={t.ticketId} style={{
                      fontSize: 9, padding: '3px 4px', marginBottom: 2, borderRadius: 2,
                      borderLeft: `2px solid ${color}`, backgroundColor: `${color}10`,
                      cursor: 'default',
                    }} title={`${t.title}\n${t.assignedTo || 'Unassigned'}\n${t.status}`}>
                      <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.ticketId}: {t.title}</div>
                      <div style={{ color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <FaUser style={{ fontSize: 7 }} />{t.assignedTo || '—'}
                        {tech && <><FaMapMarkerAlt style={{ fontSize: 7, marginLeft: 2 }} />{tech.gpsLatitude?.toFixed(2)},{tech.gpsLongitude?.toFixed(2)}</>}
                      </div>
                    </div>
                  );
                })}
                {events.length > 4 && <div style={{ fontSize: 9, color: 'var(--amber)', textAlign: 'center' }}>+{events.length - 4} more</div>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="card-title"><span><FaWrench /> Technician Schedule Overview</span></div>
        <table className="data-table" style={{ fontSize: 11 }}>
          <thead><tr><th>Technician</th><th>Status</th><th>Workload</th><th>Assigned Tickets</th><th>Today's Visits</th></tr></thead>
          <tbody>
            {technicians.filter(t => t.availabilityStatus === 'AVAILABLE' || t.availabilityStatus === 'ON_CALL' || t.availabilityStatus === 'OFF_DUTY').map(tech => {
              const assigned = tickets.filter(t => t.assignedTo === tech.name);
              const todayVisits = assigned.filter(t => {
                const d = new Date(t.createdAt);
                return d.toDateString() === new Date().toDateString();
              });
              return (
                <tr key={tech.id}>
                  <td><strong>{tech.name}</strong></td>
                  <td><span className={`badge ${tech.availabilityStatus === 'AVAILABLE' ? 'badge-completed' : tech.availabilityStatus === 'ON_CALL' ? 'badge-info' : 'badge'}`} style={tech.availabilityStatus === 'OFF_DUTY' ? { backgroundColor: 'var(--text-dim)', color: '#fff' } : {}}>{tech.availabilityStatus}</span></td>
                  <td className="cell-mono">{tech.currentWorkload}</td>
                  <td className="cell-mono">{assigned.length}</td>
                  <td className="cell-mono">{todayVisits.length > 0 ? <span style={{ color: 'var(--teal)' }}><FaCheckCircle style={{ fontSize: 9, marginRight: 3 }} />{todayVisits.length}</span> : <span style={{ color: 'var(--text-dim)' }}>—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Scheduling;

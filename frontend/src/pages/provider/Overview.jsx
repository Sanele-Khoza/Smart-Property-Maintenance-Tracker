import React from 'react';
import { FaBriefcase, FaCheckDouble, FaExclamationTriangle, FaUsers, FaClipboardList, FaBolt, FaEye, FaUserEdit, FaStar } from 'react-icons/fa';
import { getTickets, getTechnicians } from '../../data/store';
import { getSession } from '../../data/authStore';
import StatusBadge from '../../components/common/StatusBadge';

const Overview = () => {
  const session = getSession();
  const myName = session ? `${session.name} ${session.surname}` : '';
  const myTickets = getTickets().filter(t => t.assignedTo === myName || (session && t.assignedToId === session.id));
  const allTechs = getTechnicians();

  const activeJobs = myTickets.filter(t => t.status === 'Assigned' || t.status === 'In Progress');
  const completedJobs = myTickets.filter(t => t.status.includes('Completed') || t.status === 'Closed');
  const emergencyJobs = myTickets.filter(t => t.priority === 'EMERGENCY');
  const peersAvailable = allTechs.filter(t => t.availabilityStatus === 'AVAILABLE').length;

  const myTech = allTechs.find(t => t.id === session?.id || t.name === myName);
  const specialisations = myTech?.specialisations || [];

  const recentActive = activeJobs.slice(0, 3);

  return (
    <div>
      <div className="welcome-banner">
        <h2>Welcome, {session?.name}! <FaBriefcase style={{ marginLeft: 8 }} /></h2>
        <p>Manage your assigned jobs and track your performance.</p>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-value">{activeJobs.length}</div>
          <div className="stat-label"><FaClipboardList style={{ marginRight: 6 }} />Active Jobs</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{completedJobs.length}</div>
          <div className="stat-label"><FaCheckDouble style={{ marginRight: 6 }} />Completed Jobs</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{emergencyJobs.length}</div>
          <div className="stat-label"><FaExclamationTriangle style={{ marginRight: 6 }} />Emergency Jobs</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{peersAvailable}</div>
          <div className="stat-label"><FaUsers style={{ marginRight: 6 }} />Peers Available</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title"><FaClipboardList style={{ marginRight: 8 }} />My Active Jobs</div>
        {recentActive.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><FaClipboardList /></div>
            <div className="empty-text">No active jobs</div>
          </div>
        ) : (
          <div className="data-list">
            {recentActive.map(t => (
              <div key={t.ticketId} className="data-item">
                <span className="data-item-name">{t.title}</span>
                <StatusBadge status={t.status} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title"><FaBolt style={{ marginRight: 8 }} />Quick Actions</div>
        <div className="data-list">
          <div className="data-item" style={{ cursor: 'pointer' }}>
            <span className="data-item-id"><FaEye /></span>
            <span className="data-item-name">View My Jobs</span>
            <span className="data-item-meta">See all assigned and in-progress tickets</span>
          </div>
          <div className="data-item" style={{ cursor: 'pointer' }}>
            <span className="data-item-id"><FaExclamationTriangle /></span>
            <span className="data-item-name">Emergency Queue</span>
            <span className="data-item-meta">Check for urgent unassigned emergency tickets</span>
          </div>
          <div className="data-item" style={{ cursor: 'pointer' }}>
            <span className="data-item-id"><FaUserEdit /></span>
            <span className="data-item-name">Update Profile</span>
            <span className="data-item-meta">Set your availability and specialisations</span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title"><FaStar style={{ marginRight: 8 }} />Your Specialisations</div>
        {specialisations.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><FaStar /></div>
            <div className="empty-text">Update your profile to add specialisations.</div>
          </div>
        ) : (
          <div className="data-list">
            {specialisations.map(s => (
              <span key={s} className="badge badge-assigned" style={{ marginRight: 8, marginBottom: 8, display: 'inline-block' }}>{s}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Overview;

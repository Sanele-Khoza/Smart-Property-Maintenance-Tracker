import React, { useState } from 'react';
import { FaTicketAlt, FaFolderOpen, FaSpinner, FaCheckCircle, FaBolt, FaPlus, FaSearch, FaBell, FaLightbulb } from 'react-icons/fa';
import { getTickets } from '../../data/store';
import { getSession } from '../../data/authStore';
import StatusBadge from '../../components/common/StatusBadge';

const Overview = () => {
  const session = getSession();
  const myName = session ? `${session.name} ${session.surname}` : '';
  const myTickets = getTickets().filter(t => t.createdBy === myName);

  const open = myTickets.filter(t => t.status === 'New').length;
  const inProgress = myTickets.filter(t => t.status === 'In Progress').length;
  const completed = myTickets.filter(t => t.status === 'Completed' || t.status === 'Tenant Confirmed' || t.status === 'Closed').length;
  const recent = myTickets.slice(-3).reverse();

  return (
    <div>
      <div className="welcome-banner">
        <h2>Welcome back, {session?.name}!</h2>
        <p>Here's a summary of your maintenance requests. <span className="req-ref">SRS §2.3 / REQ-013</span></p>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-value">{myTickets.length}</div>
          <div className="stat-label"><FaTicketAlt style={{ marginRight: 6 }} />Total Tickets</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{open}</div>
          <div className="stat-label"><FaFolderOpen style={{ marginRight: 6 }} />Open</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{inProgress}</div>
          <div className="stat-label"><FaSpinner style={{ marginRight: 6 }} />In Progress</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{completed}</div>
          <div className="stat-label"><FaCheckCircle style={{ marginRight: 6 }} />Completed</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title"><FaTicketAlt style={{ marginRight: 8 }} />Recent Requests</div>
        {recent.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><FaTicketAlt /></div>
            <div className="empty-text">No tickets submitted yet</div>
          </div>
        ) : (
          <div className="data-list">
            {recent.map(t => (
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
            <span className="data-item-id"><FaPlus /></span>
            <span className="data-item-name">Submit a new maintenance request</span>
            <span className="data-item-meta">Report a new issue in your unit</span>
          </div>
          <div className="data-item" style={{ cursor: 'pointer' }}>
            <span className="data-item-id"><FaSearch /></span>
            <span className="data-item-name">Track ticket status</span>
            <span className="data-item-meta">View progress and provider updates</span>
          </div>
          <div className="data-item" style={{ cursor: 'pointer' }}>
            <span className="data-item-id"><FaBell /></span>
            <span className="data-item-name">View your notifications</span>
            <span className="data-item-meta">Check alerts and updates from your manager</span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title"><FaLightbulb style={{ marginRight: 8 }} />Tips for a good ticket</div>
        <ul style={{ marginLeft: 18, color: 'var(--text-mid)', lineHeight: 2 }}>
          <li>Write at least 20 characters in your description</li>
          <li>Attach photos to help diagnose the issue faster</li>
          <li>Select the correct urgency level — Emergency triggers immediate action</li>
          <li>You can track progress any time from "Ticket Tracking"</li>
        </ul>
      </div>
    </div>
  );
};

export default Overview;

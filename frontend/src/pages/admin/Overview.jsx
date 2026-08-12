import React, { useState, useEffect } from 'react';
import { FaShieldAlt, FaUsers, FaUserClock, FaTicketAlt, FaExclamationCircle, FaHistory, FaUserCheck, FaBolt, FaCog, FaClipboardList } from 'react-icons/fa';
import { getTickets, getNotifications, getAuditLogs } from '../../data/store';
import { getUsers } from '../../data/authStore';

const Overview = () => {
  const [, setVersion] = useState(0);
  useEffect(() => {
    const onUsersUpdated = () => setVersion(v => v + 1);
    window.addEventListener('spmt:users-updated', onUsersUpdated);
    return () => window.removeEventListener('spmt:users-updated', onUsersUpdated);
  }, []);
  const users = getUsers();
  const tickets = getTickets();
  const notifications = getNotifications();
  const auditLogs = getAuditLogs();

  const pendingApprovals = users.filter(u => u.status === 'Pending' || u.status === 'Unverified');
  const failedNotifs = notifications.filter(n => n.deliveryStatus === 'Failed');

  const securityEvents = auditLogs.filter(
    l => l.action.includes('LOGIN') || l.action.includes('LOCK') || l.action.includes('STATUS_CHANGE')
  );
  const displayEvents = securityEvents.length > 0 ? securityEvents.slice(-5).reverse() : auditLogs.slice(-5).reverse();

  const pendingUsers = users.filter(u => u.status === 'Pending' || u.status === 'Unverified');

  return (
    <div>
      <div className="welcome-banner">
        <h2>System Administration <FaShieldAlt style={{ marginLeft: 8 }} /></h2>
        <p>Monitor system health, manage accounts, and review security events. <span className="req-ref">SRS §2.3 / REQ-008</span></p>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-value">{users.length}</div>
          <div className="stat-label"><FaUsers style={{ marginRight: 6 }} />Total Users</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={pendingApprovals.length > 0 ? { color: 'var(--amber)' } : {}}>{pendingApprovals.length}</div>
          <div className="stat-label"><FaUserClock style={{ marginRight: 6 }} />Pending Approvals</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{tickets.length}</div>
          <div className="stat-label"><FaTicketAlt style={{ marginRight: 6 }} />Total Tickets</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={failedNotifs.length > 0 ? { color: 'var(--danger)' } : {}}>{failedNotifs.length}</div>
          <div className="stat-label"><FaExclamationCircle style={{ marginRight: 6 }} />Failed Notifications</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title"><FaHistory style={{ marginRight: 8 }} />Recent Security Events</div>
        <div className="data-list">
          {displayEvents.map(l => (
            <div key={l.id} className="data-item">
              <span className="data-item-id" style={{ color: 'var(--amber)' }}>{l.actor}</span>
              <span className="data-item-name">{l.action}</span>
              <span className="data-item-meta">{new Date(l.timestamp).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-title"><FaUserCheck style={{ marginRight: 8 }} />Users Pending Approval</div>
        {pendingUsers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><FaUserCheck /></div>
            <div className="empty-text">No users pending approval</div>
          </div>
        ) : (
          <div className="data-list">
            {pendingUsers.map(u => (
              <div key={u.id} className="data-item">
                <span className="data-item-id">{u.id}</span>
                <span className="data-item-name">{u.name} {u.surname}</span>
                <span className="data-item-meta">{u.role}</span>
                <span className={`badge ${u.status === 'Pending' ? 'badge-open' : 'badge-assigned'}`}>{u.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title"><FaBolt style={{ marginRight: 8 }} />Quick Actions</div>
        <div className="data-list">
          <div className="data-item" style={{ cursor: 'pointer' }}>
            <span className="data-item-id"><FaUsers /></span>
            <span className="data-item-name">Manage Users</span>
            <span className="data-item-meta">Approve, suspend, or deactivate accounts</span>
          </div>
          <div className="data-item" style={{ cursor: 'pointer' }}>
            <span className="data-item-id"><FaClipboardList /></span>
            <span className="data-item-name">View Audit Logs</span>
            <span className="data-item-meta">Full immutable audit trail of all system events</span>
          </div>
          <div className="data-item" style={{ cursor: 'pointer' }}>
            <span className="data-item-id"><FaCog /></span>
            <span className="data-item-name">System Health</span>
            <span className="data-item-meta">Monitor API performance, DB connections, and alerts</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Overview;

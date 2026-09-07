import React, { useState, useEffect } from 'react';
import { FaBuilding, FaLayerGroup, FaFolderOpen, FaBrain, FaHistory, FaWrench, FaBolt, FaRobot, FaUserCog, FaChartBar, FaUserPlus, FaCheck } from 'react-icons/fa';
import { getTickets, getProperties, getUnits, getTechnicians, getAuditLogs } from '../../data/store';
import { getUsers, approveManager, refreshUsers } from '../../data/authStore';
import StatusBadge from '../../components/common/StatusBadge';
import Alert from '../../components/common/Alert';

const pulseKeyframes = `
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
`;

const Overview = () => {
  const tickets = getTickets();
  const auditLogs = getAuditLogs();
  const recentLogs = auditLogs.slice(-4).reverse();
  const [allUsers, setAllUsers] = useState(() => getUsers());
  const [alert, setAlert] = useState({ msg: '', type: '' });

  useEffect(() => {
    let cancelled = false;
    const syncUsers = () => refreshUsers().then(() => { if (!cancelled) setAllUsers(getUsers()); });
    syncUsers();
    const onUsersUpdated = () => { if (!cancelled) setAllUsers(getUsers()); };
    window.addEventListener('spmt:users-updated', onUsersUpdated);
    return () => { cancelled = true; window.removeEventListener('spmt:users-updated', onUsersUpdated); };
  }, []);

  const showAlert = (msg, type) => { setAlert({ msg, type }); setTimeout(() => setAlert({ msg: '', type: '' }), 5000); };

  const pendingApprovals = allUsers.filter(u =>
    (u.role === 'TENANT' || u.role === 'SERVICE_PROVIDER') &&
    String(u.status).toUpperCase() === 'PENDING'
  );

  const handleApprove = async (userId) => {
    const r = await approveManager(userId);
    if (r.success) { showAlert('Account approved.', 'success'); window.location.reload(); }
    else showAlert(r.error, 'error');
  };

  const openTickets = tickets.filter(t => t.status === 'New');
  const needsAI = tickets.filter(t => t.conflictDetected || t.manualReviewRequired);

  const availableTechs = getTechnicians().filter(
    t => t.availabilityStatus === 'AVAILABLE' || t.availabilityStatus === 'ON_CALL'
  );

  return (
    <div>
      <style>{pulseKeyframes}</style>
      <div className="welcome-banner">
        <h2>Property Manager Dashboard <FaBuilding style={{ marginLeft: 8 }} /></h2>
        <p>Monitor your portfolio and manage maintenance workflows. <span className="req-ref">SRS §2.3 / REQ-009</span></p>
      </div>

      <Alert msg={alert.msg} type={alert.type} />

      {pendingApprovals.length > 0 && (
        <div className="card" style={{ borderLeft: '3px solid var(--amber)' }}>
          <div className="card-title"><span><FaUserPlus /> Pending Approvals <span className="req-ref">REQ-004</span></span><span style={{ fontSize: 11, color: 'var(--amber)', fontWeight: 600 }}>{pendingApprovals.length} pending</span></div>
          <table className="data-table" style={{ fontSize: 12 }}>
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Action</th></tr></thead>
            <tbody>{pendingApprovals.map(u => (
              <tr key={u.id}>
                <td>{u.name} {u.surname}</td>
                <td>{u.email}</td>
                <td><span className="badge badge-info">{u.role}</span></td>
                <td><button className="btn btn-teal btn-sm" onClick={() => handleApprove(u.id)}><FaCheck /> Approve</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-value">{getProperties().length}</div>
          <div className="stat-label"><FaBuilding style={{ marginRight: 6 }} />Total Properties</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{getUnits().length}</div>
          <div className="stat-label"><FaLayerGroup style={{ marginRight: 6 }} />Total Units</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{openTickets.length}</div>
          <div className="stat-label"><FaFolderOpen style={{ marginRight: 6 }} />Open Tickets</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {needsAI.length}
            {needsAI.length > 0 && (
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)', display: 'inline-block', marginLeft: 6, animation: 'pulse 1.5s ease-in-out infinite' }} />
            )}
          </div>
          <div className="stat-label"><FaBrain style={{ marginRight: 6 }} />Needs AI Review</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title"><FaHistory style={{ marginRight: 8 }} />Recent Audit Activity</div>
        <div className="data-list">
          {recentLogs.map(log => (
            <div key={log.id} className="data-item">
              <span className="data-item-id">{log.actor}</span>
              <span className="data-item-name">{log.comment}</span>
              <span className="data-item-meta">{new Date(log.timestamp).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-title"><FaWrench style={{ marginRight: 8 }} />Available Technicians</div>
        {availableTechs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><FaWrench /></div>
            <div className="empty-text">No technicians available</div>
          </div>
        ) : (
          <div className="data-list">
            {availableTechs.map(t => (
              <div key={t.id} className="data-item">
                <span className="data-item-id">{t.name}</span>
                <span className="data-item-name">{t.companyName}</span>
                <span className="badge badge-assigned">{t.availabilityStatus}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title"><FaBolt style={{ marginRight: 8 }} />Quick Actions</div>
        <div className="data-list">
          <div className="data-item" style={{ cursor: 'pointer' }}>
            <span className="data-item-id"><FaRobot /></span>
            <span className="data-item-name">Review AI Queue</span>
            <span className="data-item-meta">Classify conflicted and low-confidence tickets</span>
          </div>
          <div className="data-item" style={{ cursor: 'pointer' }}>
            <span className="data-item-id"><FaUserCog /></span>
            <span className="data-item-name">Assign Technicians</span>
            <span className="data-item-meta">Route open tickets to qualified providers</span>
          </div>
          <div className="data-item" style={{ cursor: 'pointer' }}>
            <span className="data-item-id"><FaChartBar /></span>
            <span className="data-item-name">Generate Reports</span>
            <span className="data-item-meta">Export SLA compliance and performance reports</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Overview;
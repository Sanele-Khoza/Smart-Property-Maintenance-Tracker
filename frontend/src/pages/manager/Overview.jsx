import React from 'react';
import { FaBuilding, FaLayerGroup, FaFolderOpen, FaBrain, FaHistory, FaWrench, FaBolt, FaRobot, FaUserCog, FaChartBar } from 'react-icons/fa';
import { getTickets, getProperties, getUnits, getTechnicians, getAuditLogs } from '../../data/store';
import StatusBadge from '../../components/common/StatusBadge';

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

  const openTickets = tickets.filter(t => t.status === 'Open');
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

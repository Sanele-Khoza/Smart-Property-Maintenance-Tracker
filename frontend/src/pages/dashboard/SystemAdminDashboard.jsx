import React, { useState } from 'react';
import { FaBuilding, FaBox, FaUser, FaCalendarAlt, FaWrench } from 'react-icons/fa';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { getStats, getTickets, getProperties, getUnits, getAllData, resetData } from '../../data/store';
import StatusBadge from '../../components/common/StatusBadge';
import Alert from '../../components/common/Alert';
import Overview from '../admin/Overview';
import Users from '../admin/Users';
import Properties from '../admin/Properties';
import Units from '../admin/Units';
import Tickets from '../admin/Tickets';
import Categories from '../admin/Categories';
import Reports from '../admin/Reports';
import AuditLogs from '../admin/AuditLogs';
import Activity from '../admin/Activity';
import Notifications from '../admin/Notifications';
import Messages from '../admin/Messages';
import Settings from '../admin/Settings';
import Backup from '../admin/Backup';
import Analytics from '../admin/Analytics';
import Help from '../admin/Help';
import Roles from '../admin/Roles';
import SystemHealth from '../admin/SystemHealth';
import Technicians from '../admin/Technicians';
import Tenants from '../admin/Tenants';
import RatingsList from '../../components/ratings/RatingsList';

const SystemAdminDashboard = ({ activePage }) => {
  const [stats, setStats] = useState(getStats());
  const [allData, setAllData] = useState(getAllData());
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedTicketDetails, setSelectedTicketDetails] = useState(null);
  const [resetMsg, setResetMsg] = useState({ text: '', type: '' });

  const refresh = () => {
    setStats(getStats());
    setAllData(getAllData());
  };

  const handleResetData = () => {
    if (window.confirm('Are you sure you want to reset all data to demo values? This cannot be undone.')) {
      resetData();
      refresh();
      setResetMsg({ text: 'Data reset to demo values successfully!', type: 'success' });
      setTimeout(() => setResetMsg({ text: '', type: '' }), 3000);
    }
  };

  const tickets = allData.tickets || [];
  const properties = allData.properties || [];
  const units = allData.units || [];

  const openTickets = tickets.filter(t => t.status === 'New');
  const assignedTickets = tickets.filter(t => t.status === 'Assigned');
  const inProgressTickets = tickets.filter(t => t.status === 'In Progress');
  const completedTickets = tickets.filter(t => t.status === 'Completed');

  const renderPage = () => {
    switch (activePage) {
      case 'Overview':
        return (
          <>
            <div className="welcome-banner">
              <h2>System Administrator Dashboard</h2>
              <p>Full system oversight: manage all properties, units, tickets, and system data.</p>
            </div>
            <Alert msg={resetMsg.text} type={resetMsg.type} />
            <div className="stat-grid" style={{ marginBottom: 20 }}>
              <div className="stat-card"><div className="stat-value">{stats.totalProperties}</div><div className="stat-label">Properties</div></div>
              <div className="stat-card"><div className="stat-value">{stats.totalUnits}</div><div className="stat-label">Units</div></div>
              <div className="stat-card"><div className="stat-value">{stats.occupiedUnits}</div><div className="stat-label">Occupied</div></div>
              <div className="stat-card"><div className="stat-value">{stats.totalTickets}</div><div className="stat-label">Tickets</div></div>
              <div className="stat-card"><div className="stat-value">{stats.openTickets}</div><div className="stat-label">Open</div></div>
              <div className="stat-card"><div className="stat-value">{stats.completedTickets}</div><div className="stat-label">Completed</div></div>
            </div>
            <div className="main-cols">
              <div>
                <div className="card">
                  <div className="card-title">
                    System Overview
                    <button className="btn btn-danger btn-sm" onClick={handleResetData}>Reset to Demo Data</button>
                  </div>
                  <div className="section-title">Properties ({properties.length})</div>
                  <div className="scroll-list data-list" style={{ maxHeight: 200 }}>
                    {properties.map(p => (
                      <div className="data-item" key={p.propertyId}>
                        <div>
                          <div className="data-item-name">{p.name}</div>
                          <div className="data-item-meta">{p.address}</div>
                        </div>
                        <div className="data-item-meta">Manager: {p.managerName}</div>
                      </div>
                    ))}
                  </div>
                  <div className="divider" />
                  <div className="section-title">Units ({units.length})</div>
                  <div className="scroll-list data-list" style={{ maxHeight: 200 }}>
                    {units.map(u => (
                      <div className="data-item" key={u.unitId}>
                        <div>
                          <div className="data-item-name">Unit {u.unitNumber}</div>
                          <div className="data-item-meta">{u.propertyName}</div>
                        </div>
                        <div>
                          <span className={`badge ${u.status === 'OCCUPIED' ? 'badge-assigned' : 'badge-open'}`}>{u.status}</span>
                          {u.tenantName && <div className="data-item-meta">{u.tenantName}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <div className="card">
                  <div className="card-title">Ticket Analytics</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <div className="chart-block-title">By Status</div>
                      <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={[
                          { name: 'Open', count: openTickets.length },
                          { name: 'Assigned', count: assignedTickets.length },
                          { name: 'In Progress', count: inProgressTickets.length },
                          { name: 'Completed', count: completedTickets.length },
                        ]}>
                          <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-dim)' }} />
                          <YAxis tick={{ fontSize: 10, fill: 'var(--text-dim)' }} allowDecimals={false} />
                          <Tooltip contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11 }} />
                          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                            <Cell fill="#00c9a7" />
                            <Cell fill="#3498db" />
                            <Cell fill="#f39c12" />
                            <Cell fill="#2ecc71" />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div>
                      <div className="chart-block-title">By Priority</div>
                      <ResponsiveContainer width="100%" height={160}>
                        <PieChart>
                          <Pie
                            data={Object.entries(
                              tickets.reduce((acc, t) => { acc[t.priority] = (acc[t.priority] || 0) + 1; return acc; }, {})
                            ).map(([name, value]) => ({ name, value }))}
                            cx="50%"
                            cy="50%"
                            innerRadius={35}
                            outerRadius={55}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {['EMERGENCY', 'URGENT', 'HIGH', 'MEDIUM', 'LOW'].map((p, i) => (
                              <Cell key={p} fill={['#e74c3c', '#e67e22', '#f1c40f', '#3498db', '#95a5a6'][i]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11 }} />
                          <Legend wrapperStyle={{ fontSize: 10 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="card-title">All Tickets ({tickets.length})</div>
              {tickets.length === 0 ? (
                <div className="empty-state"><div className="empty-text">No tickets</div></div>
              ) : (
                <div className="ticket-grid" style={{ maxHeight: 400, overflow: 'auto' }}>
                  {[...tickets].reverse().map(t => (
                    <div className="ticket-card" key={t.ticketId} style={{ cursor: 'pointer' }} onClick={() => setSelectedTicketDetails(t)}>
                      <div className="ticket-header">
                        <StatusBadge status={t.status} />
                        <span className="provider-badge">{t.priority}</span>
                      </div>
                      <div className="ticket-desc">
                        <strong>{t.title}</strong><br />
                        {t.description.substring(0, 100)}...
                      </div>
                      {t.images && t.images.length > 0 && (
                        <div className="ticket-images">
                          {t.images.slice(0, 3).map((img, idx) => (
                            <div key={idx} className="ticket-thumb" onClick={(e) => { e.stopPropagation(); setSelectedImage(img); }}>
                              <img src={img.data || img} alt="" />
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="ticket-meta">
                        <span><FaBuilding /> {t.propertyName}</span>
                        <span><FaBox /> Unit {t.unitNumber}</span>
                        <span><FaUser /> By: {t.createdBy}</span>
                        <span><FaCalendarAlt /> {t.createdAt}</span>
                        {t.assignedTo && <span><FaWrench /> {t.assignedTo}</span>}
                        {t.autoAssigned && <span style={{ fontSize: 10, color: 'var(--amber)', fontWeight: 600, marginLeft: 6 }}>Auto-assigned by system</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {selectedTicketDetails && (
              <div className="modal" onClick={() => setSelectedTicketDetails(null)} style={{ alignItems: 'flex-start', paddingTop: 60 }}>
                <div className="card" style={{ maxWidth: 600, margin: 'auto', background: 'var(--surface2)', maxHeight: '80vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                    <h3 style={{ color: 'var(--amber)' }}>Ticket Details</h3>
                    <StatusBadge status={selectedTicketDetails.status} />
                  </div>
                  <div className="ticket-details">
                    <div className="ticket-details-row">
                      <span className="ticket-details-label">Title:</span>
                      <span className="ticket-details-value">{selectedTicketDetails.title}</span>
                    </div>
                    <div className="ticket-details-row">
                      <span className="ticket-details-label">Ticket ID:</span>
                      <span className="ticket-details-value" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{selectedTicketDetails.ticketId}</span>
                    </div>
                    <div className="ticket-details-row">
                      <span className="ticket-details-label">Description:</span>
                      <span className="ticket-details-value">{selectedTicketDetails.description}</span>
                    </div>
                    <div className="ticket-details-row">
                      <span className="ticket-details-label">Property:</span>
                      <span className="ticket-details-value">{selectedTicketDetails.propertyName}</span>
                    </div>
                    <div className="ticket-details-row">
                      <span className="ticket-details-label">Unit:</span>
                      <span className="ticket-details-value">Unit {selectedTicketDetails.unitNumber}</span>
                    </div>
                    <div className="ticket-details-row">
                      <span className="ticket-details-label">Submitted By:</span>
                      <span className="ticket-details-value">{selectedTicketDetails.createdBy}</span>
                    </div>
                    <div className="ticket-details-row">
                      <span className="ticket-details-label">Submitted At:</span>
                      <span className="ticket-details-value">{selectedTicketDetails.createdAt}</span>
                    </div>
                    <div className="ticket-details-row">
                      <span className="ticket-details-label">Last Updated:</span>
                      <span className="ticket-details-value">{selectedTicketDetails.updatedAt}</span>
                    </div>
                    <div className="ticket-details-row">
                      <span className="ticket-details-label">Priority:</span>
                      <span className="ticket-details-value">{selectedTicketDetails.priority}</span>
                    </div>
                    <div className="ticket-details-row">
                      <span className="ticket-details-label">Assigned To:</span>
                      <span className="ticket-details-value">{selectedTicketDetails.assignedTo || 'Not assigned'}</span>
                    </div>
                  </div>
                  {selectedTicketDetails.images && selectedTicketDetails.images.length > 0 && (
                    <>
                      <div className="section-title">Attached Images ({selectedTicketDetails.images.length})</div>
                      <div className="image-preview-grid">
                        {selectedTicketDetails.images.map((img, idx) => (
                          <div key={idx} className="image-preview" style={{ width: 100, height: 100 }} onClick={() => setSelectedImage(img)}>
                            <img src={img.data || img} alt={`Attachment ${idx}`} />
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  <button className="btn btn-secondary btn-full" style={{ marginTop: 16 }} onClick={() => setSelectedTicketDetails(null)}>Close</button>
                </div>
              </div>
            )}
            {selectedImage && (
              <div className="modal" onClick={() => setSelectedImage(null)}>
                <span className="modal-close">×</span>
                <img src={selectedImage.data || selectedImage} alt="Full size" />
              </div>
            )}
          </>
        );
      case 'Users':
        return <Users />;
      case 'Properties':
        return <Properties />;
      case 'Units':
        return <Units />;
      case 'Tickets':
        return <Tickets />;
      case 'Categories':
        return <Categories />;
      case 'Reports':
        return <Reports />;
      case 'Audit Logs':
        return <AuditLogs />;
      case 'Activity':
        return <Activity />;
      case 'Notifications':
        return <Notifications />;
      case 'Messages':
        return <Messages />;
      case 'Settings':
        return <Settings />;
      case 'Backup':
        return <Backup />;
      case 'Analytics':
        return <Analytics />;
      case 'Help':
        return <Help />;
      case 'Roles':
        return <Roles />;
      case 'System Health':
        return <SystemHealth />;
      case 'Technicians':
        return <Technicians />;
      case 'Tenants':
        return <Tenants />;
      case 'Ratings':
        return <RatingsList title="All Ratings" subtitle="Every individual rating and comment across the system." />;
      default:
        return <Overview />;
    }
  };

  return renderPage();
};

export default SystemAdminDashboard;

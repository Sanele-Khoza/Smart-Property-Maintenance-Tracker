import React, { useState, useMemo } from 'react';
import { FaBuilding, FaBox, FaUser, FaCalendarAlt, FaBolt, FaWrench, FaExclamationTriangle, FaCheckCircle, FaClock, FaBrain } from 'react-icons/fa';
import Property from '../../components/Property';
import Assignment from '../../components/Assignment';
import { getStats, getProperties, getUnits } from '../../data/store';
import { getSlaStatus } from '../../data/slaEngine';
import { getSession } from '../../data/authStore';
import StatusBadge from '../../components/common/StatusBadge';
import useTickets from '../../hooks/useTickets';
import Overview from '../manager/Overview';
import Properties from '../manager/Properties';
import Units from '../manager/Units';
import Tenants from '../manager/Tenants';
import Tickets from '../manager/Tickets';
import Technicians from '../manager/Technicians';
import Scheduling from '../manager/Scheduling';
import Reports from '../manager/Reports';
import AIReview from '../manager/AIReview';
import RatingsList from '../../components/ratings/RatingsList';

const PropertyManagerDashboard = ({ activePage }) => {
  const session = getSession();
  const pmName = session ? `${session.name} ${session.surname}` : '';
  const [allTickets] = useTickets();
  const [allProperties, setAllProperties] = useState(getProperties());
  const [allUnits, setAllUnits] = useState(getUnits());
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedTicketDetails, setSelectedTicketDetails] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const properties = useMemo(() => allProperties.filter(p => p.managerName === pmName), [allProperties, pmName]);
  const propNames = useMemo(() => new Set(properties.map(p => p.name)), [properties]);
  const tickets = useMemo(() => allTickets.filter(t => propNames.has(t.propertyName)), [allTickets, propNames]);
  const units = useMemo(() => allUnits.filter(u => properties.some(p => p.propertyId === u.propertyId)), [allUnits, properties]);

  const refresh = () => {
    setAllProperties(getProperties());
    setAllUnits(getUnits());
    setRefreshTrigger(prev => prev + 1);
  };

  const openTickets = tickets.filter(t => t.status === 'New');
  const assignedTickets = tickets.filter(t => t.status === 'Assigned');
  const inProgressTickets = tickets.filter(t => t.status === 'In Progress');
  const completedTickets = tickets.filter(t => t.status === 'Completed');

  const slaBreached = tickets.filter(t => getSlaStatus(t)?.state === 'breached').length;
  const slaWarning = tickets.filter(t => getSlaStatus(t)?.state === 'warning').length;
  const slaOntrack = tickets.filter(t => {
    const s = getSlaStatus(t);
    return s && s.state !== 'breached' && s.state !== 'warning';
  }).length;

  const needsReviewCount = tickets.filter(t => t.conflictDetected || t.manualReviewRequired).length;

  const getUnitDetails = (unitId) => {
    const unit = units.find(u => u.unitId === unitId);
    return unit || null;
  };

  const renderPage = () => {
    switch (activePage) {
      case 'Overview':
        return (
          <>
            <div className="welcome-banner">
              <h2>Property Manager Dashboard</h2>
              <p>Manage properties, assign maintenance requests, and monitor ticket progress.</p>
            </div>
            <div className="stat-grid" style={{ marginBottom: 20 }}>
              <div className="stat-card"><div className="stat-value">{properties.length}</div><div className="stat-label">Properties</div></div>
              <div className="stat-card"><div className="stat-value">{units.length}</div><div className="stat-label">Units</div></div>
              <div className="stat-card"><div className="stat-value">{units.filter(u => u.status === 'OCCUPIED').length}</div><div className="stat-label">Occupied</div></div>
              <div className="stat-card"><div className="stat-value">{openTickets.length}</div><div className="stat-label">Open Tickets</div></div>
            </div>
            <div className="main-cols" style={{ marginBottom: 16 }}>
              <div className="card">
                <div className="card-title">Open Tickets ({openTickets.length})</div>
                {openTickets.length === 0 ? (
                  <div className="empty-state"><div className="empty-text">No open tickets</div></div>
                ) : (
                  <div className="scroll-list ticket-grid">
                    {openTickets.map(t => {
                      const unit = getUnitDetails(t.unitId);
                      return (
                        <div className="ticket-card" key={t.ticketId} style={{ cursor: 'pointer' }} onClick={() => setSelectedTicketDetails(t)}>
                          <div className="ticket-header">
                            <span className="badge badge-open">Open</span>
                          </div>
                          <div className="ticket-desc"><strong>{t.title}</strong><br />{t.description.substring(0, 80)}...</div>
                          {t.images && t.images.length > 0 && (
                            <div className="ticket-images">
                              {t.images.slice(0, 2).map((img, idx) => (
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
                            <span><FaBolt /> Priority: {t.priority}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div>
                <Property refreshData={refresh} pmName={pmName} />
              </div>
            </div>
            <div className="main-cols" style={{ marginBottom: 16 }}>
              <div className="card">
                <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>SLA Status</span>
                  <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-dim)' }}><FaClock /> SRS §3.1.4</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
                  <div style={{ padding: '8px', borderRadius: 4, backgroundColor: 'rgba(45,183,145,0.08)', textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--teal)' }}>{slaOntrack}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>On Track</div>
                  </div>
                  <div style={{ padding: '8px', borderRadius: 4, backgroundColor: 'rgba(243,156,18,0.08)', textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: slaWarning > 0 ? 'var(--amber)' : 'var(--text-dim)' }}>{slaWarning}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Warning (≥75%)</div>
                  </div>
                  <div style={{ padding: '8px', borderRadius: 4, backgroundColor: 'rgba(192,57,43,0.08)', textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: slaBreached > 0 ? 'var(--danger)' : 'var(--text-dim)' }}>{slaBreached}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Breached</div>
                  </div>
                </div>
                {slaBreached > 0 && (
                  <div style={{ fontSize: 10, padding: '4px 8px', backgroundColor: 'rgba(192,57,43,0.08)', borderRadius: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <FaExclamationTriangle style={{ color: 'var(--danger)', fontSize: 10 }} />
                    {slaBreached} ticket(s) past SLA deadline — immediate attention required
                  </div>
                )}
              </div>
              <div className="card">
                <div className="card-title">In Progress ({inProgressTickets.length})</div>
                {inProgressTickets.map(t => {
                  const unit = getUnitDetails(t.unitId);
                  return (
                    <div className="ticket-card" key={t.ticketId} style={{ cursor: 'pointer' }} onClick={() => setSelectedTicketDetails(t)}>
                      <div className="ticket-header">
                        <StatusBadge status={t.status} />
                      </div>
                      <div className="ticket-desc">{t.title}</div>
                      <div className="ticket-meta">
                        <span><FaWrench /> {t.assignedTo}</span>
                        <span><FaCalendarAlt /> Updated: {t.updatedAt}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <Assignment refreshData={refresh} pmName={pmName} />
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
                      <span className="ticket-details-label">Priority:</span>
                      <span className="ticket-details-value">{selectedTicketDetails.priority}</span>
                    </div>
                    <div className="ticket-details-row">
                      <span className="ticket-details-label">Assigned To:</span>
                      <span className="ticket-details-value">{selectedTicketDetails.assignedTo || 'Not assigned yet'}</span>
                    </div>
                    <div className="ticket-details-row">
                      <span className="ticket-details-label">Last Updated:</span>
                      <span className="ticket-details-value">{selectedTicketDetails.updatedAt}</span>
                    </div>
                  </div>
                  {selectedTicketDetails.images && selectedTicketDetails.images.length > 0 && (
                    <>
                      <div className="section-title">Attached Images</div>
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
      case 'Properties':
        return <Properties />;
      case 'Units':
        return <Units />;
      case 'Tenants':
        return <Tenants />;
      case 'Tickets':
        return <Tickets />;
      case 'AI Review':
        return <AIReview />;
      case 'Technicians':
        return <Technicians />;
      case 'Scheduling':
        return <Scheduling />;
      case 'Reports':
        return <Reports />;
      case 'Ratings':
        return <RatingsList title="Ratings" subtitle="Individual ratings and comments for your managed properties." />;
      default:
        return <Overview />;
    }
  };

  return renderPage();
};

export default PropertyManagerDashboard;

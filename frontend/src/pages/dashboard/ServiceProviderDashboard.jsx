import React, { useState } from 'react';
import { FaBuilding, FaBox, FaUser, FaCalendarAlt, FaBolt, FaArrowLeft } from 'react-icons/fa';
import { getSession } from '../../data/authStore';
import { acceptJob, startJob, submitJobCompletion } from '../../data/store';
import StatusBadge from '../../components/common/StatusBadge';
import Alert from '../../components/common/Alert';
import useTickets from '../../hooks/useTickets';
import Overview from '../provider/Overview';
import Profile from '../provider/Profile';
import MyJobs from '../provider/MyJobs';
import JobDetail from '../provider/JobDetail';
import Schedule from '../provider/Schedule';
import Emergency from '../provider/Emergency';
import Notifications from '../provider/Notifications';
import Messages from '../provider/Messages';
import WorkHistory from '../provider/WorkHistory';
import Reports from '../provider/Reports';

const ServiceProviderDashboard = ({ activePage }) => {
  const [tickets, refresh] = useTickets();
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedTicketDetails, setSelectedTicketDetails] = useState(null);
  const [statusMsg, setStatusMsg] = useState({ text: '', type: '' });
  const [drillDownTicketId, setDrillDownTicketId] = useState(null);

  const session = getSession();
  const providerName = session ? `${session.name} ${session.surname}` : 'Mike Provider';
  const isMine = (t) => t.assignedTo === providerName || (session && t.assignedToId === session.id);
  const myTickets = tickets.filter(isMine);
  const openTickets = tickets.filter(t => t.status === 'New' && !isMine(t));

  const handleWorkflow = async (ticketId, promise, newStatus) => {
    const result = await promise;
    if (result.error) {
      setStatusMsg({ text: result.error, type: 'error' });
    } else {
      setStatusMsg({ text: `Status updated to ${newStatus}`, type: 'success' });
      refresh();
      setTimeout(() => setStatusMsg({ text: '', type: '' }), 3000);
    }
  };

  const handleViewJobDetail = (ticketId) => {
    setDrillDownTicketId(ticketId);
  };

  const handleBackFromJobDetail = () => {
    setDrillDownTicketId(null);
  };

  if (drillDownTicketId) {
    return <JobDetail ticketId={drillDownTicketId} onBack={handleBackFromJobDetail} />;
  }

  const renderPage = () => {
    switch (activePage) {
      case 'Overview':
        return (
          <>
            <div className="welcome-banner">
              <h2>Service Provider Dashboard</h2>
              <p>View assigned jobs, update status, and communicate with property managers.</p>
            </div>
            <Alert msg={statusMsg.text} type={statusMsg.type} />
            <div className="stat-grid" style={{ marginBottom: 20 }}>
              <div className="stat-card"><div className="stat-value">{myTickets.length}</div><div className="stat-label">My Tickets</div></div>
              <div className="stat-card"><div className="stat-value">{myTickets.filter(t => t.status === 'Assigned').length}</div><div className="stat-label">Assigned</div></div>
              <div className="stat-card"><div className="stat-value">{myTickets.filter(t => t.status === 'In Progress').length}</div><div className="stat-label">In Progress</div></div>
              <div className="stat-card"><div className="stat-value">{myTickets.filter(t => t.status === 'Completed' || t.status === 'Tenant Confirmed' || t.status === 'Closed').length}</div><div className="stat-label">Completed</div></div>
            </div>
            <div className="main-cols">
              <div>
                <div className="card">
                  <div className="card-title">My Assigned Tickets ({myTickets.length})</div>
                  {myTickets.length === 0 ? (
                    <div className="empty-state"><div className="empty-text">No assigned tickets</div></div>
                  ) : (
                    <div className="scroll-list ticket-grid">
                      {myTickets.map(t => (
                        <div className="ticket-card" key={t.ticketId}>
                          <div className="ticket-header">
                            <StatusBadge status={t.status} />
                          </div>
                          <div className="ticket-desc">
                            <strong>{t.title}</strong><br />
                            {t.description}
                          </div>
                          {t.images && t.images.length > 0 && (
                            <div className="ticket-images">
                              {t.images.slice(0, 3).map((img, idx) => (
                                <div key={idx} className="ticket-thumb" onClick={() => setSelectedImage(img)}>
                                  <img src={img} alt="" />
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="ticket-meta">
                            <span><FaBuilding /> {t.propertyName}</span>
                            <span><FaBox /> Unit {t.unitNumber}</span>
                            <span><FaUser /> By: {t.createdBy}</span>
                            <span><FaCalendarAlt /> {t.createdAt}</span>
                          </div>
                          <div className="ticket-actions">
                            {t.status === 'Assigned' && (
                              <button className="btn btn-primary btn-sm" onClick={() => handleWorkflow(t.ticketId, acceptJob(t.ticketId), 'Accepted')}>
                                Accept Job
                              </button>
                            )}
                            {t.status === 'Accepted' && (
                              <button className="btn btn-primary btn-sm" onClick={() => handleWorkflow(t.ticketId, startJob(t.ticketId), 'In Progress')}>
                                Start Job
                              </button>
                            )}
                            {t.status === 'In Progress' && (
                              <button className="btn btn-teal btn-sm" onClick={() => handleWorkflow(t.ticketId, submitJobCompletion(t.ticketId, '', []), 'Completed')}>
                                Mark Completed
                              </button>
                            )}
                            {t.status === 'Completed' && (
                              <span className="badge badge-completed" style={{ fontSize: 10 }}>Awaiting Confirmation</span>
                            )}
                            <button className="btn btn-secondary btn-sm" onClick={() => setSelectedTicketDetails(t)}>
                              View Details
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <div className="card">
                  <div className="card-title">Available Jobs ({openTickets.length})</div>
                  {openTickets.length === 0 ? (
                    <div className="empty-state"><div className="empty-text">No available jobs</div></div>
                  ) : (
                    <div className="scroll-list ticket-grid">
                      {openTickets.map(t => (
                        <div className="ticket-card" key={t.ticketId} style={{ cursor: 'pointer' }} onClick={() => setSelectedTicketDetails(t)}>
                          <div className="ticket-header">
                            <span className="badge badge-open">Open</span>
                          </div>
                          <div className="ticket-desc">
                            <strong>{t.title}</strong><br />
                            {t.description.substring(0, 100)}...
                          </div>
                          <div className="ticket-meta">
                            <span><FaBuilding /> {t.propertyName}</span>
                            <span><FaBox /> Unit {t.unitNumber}</span>
                            <span><FaBolt /> {t.priority}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
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
                      <span className="ticket-details-label">Location:</span>
                      <span className="ticket-details-value">{selectedTicketDetails.propertyName}, Unit {selectedTicketDetails.unitNumber}</span>
                    </div>
                  </div>
                  {selectedTicketDetails.images && selectedTicketDetails.images.length > 0 && (
                    <>
                      <div className="section-title">Attached Images</div>
                      <div className="image-preview-grid">
                        {selectedTicketDetails.images.map((img, idx) => (
                          <div key={idx} className="image-preview" style={{ width: 100, height: 100 }} onClick={() => setSelectedImage(img)}>
                            <img src={img} alt={`Attachment ${idx}`} />
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
                <img src={selectedImage} alt="Full size" />
              </div>
            )}
          </>
        );
      case 'Profile':
        return <Profile />;
      case 'My Jobs':
        return <MyJobs onViewDetails={handleViewJobDetail} />;
      case 'Job Detail':
        return <JobDetail ticketId={drillDownTicketId} onBack={handleBackFromJobDetail} />;
      case 'Schedule':
        return <Schedule />;
      case 'Emergency':
        return <Emergency />;
      case 'Notifications':
        return <Notifications />;
      case 'Messages':
        return <Messages />;
      case 'Work History':
        return <WorkHistory />;
      case 'My Performance':
        return <Reports />;
      default:
        return <Overview />;
    }
  };

  return renderPage();
};

export default ServiceProviderDashboard;

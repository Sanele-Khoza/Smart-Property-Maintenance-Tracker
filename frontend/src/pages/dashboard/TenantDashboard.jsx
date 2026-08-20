import React from 'react';
import Ticket from '../../components/Ticket';
import useTickets from '../../hooks/useTickets';
import Overview from '../tenant/Overview';
import Profile from '../tenant/Profile';
import MyProperty from '../tenant/MyProperty';
import MyUnit from '../tenant/MyUnit';
import TicketTracking from '../tenant/TicketTracking';
import Notification from '../tenant/Notification';
import RatingsList from '../../components/ratings/RatingsList';

const TenantDashboard = ({ currentUser, activePage }) => {
  const [tickets, refresh] = useTickets();

  const myTickets = tickets.filter(t => t.createdBy === currentUser || (currentUser === 'Tenant' && t.createdBy === 'John Tenant'));

  const renderPage = () => {
    switch (activePage) {
      case 'Overview':
        return (
          <>
            <div className="welcome-banner">
              <h2>Welcome, {currentUser}!</h2>
              <p>Submit maintenance requests and track their status from your dashboard.</p>
            </div>
            <div className="main-cols">
              <div>
                <div className="card">
                  <div className="card-title">Your Activity Summary</div>
                  <div className="stat-grid">
                    <div className="stat-card">
                      <div className="stat-value">{myTickets.length}</div>
                      <div className="stat-label">Total Tickets</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">{myTickets.filter(t => t.status === 'New').length}</div>
                      <div className="stat-label">Open</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">{myTickets.filter(t => t.status === 'In Progress').length}</div>
                      <div className="stat-label">In Progress</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">{myTickets.filter(t => t.status === 'Completed').length}</div>
                      <div className="stat-label">Completed</div>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <div className="card">
                  <div className="card-title">Quick Tips</div>
                  <ul style={{ marginLeft: 20, color: 'var(--text-mid)', lineHeight: 1.8 }}>
                    <li>Provide detailed descriptions (min 20 chars)</li>
                    <li>Upload photos to help diagnose the issue</li>
                    <li>Mark emergency issues appropriately</li>
                    <li>Track ticket status from your dashboard</li>
                  </ul>
                </div>
              </div>
            </div>
            <Ticket currentUser={currentUser} refreshData={refresh} />
          </>
        );
      case 'Create Ticket':
        return <Ticket currentUser={currentUser} refreshData={refresh} />;
      case 'Profile':
        return <Profile />;
      case 'My Property':
        return <MyProperty />;
      case 'My Unit':
        return <MyUnit />;
      case 'Ticket Tracking':
        return <TicketTracking />;
      case 'Notification':
        return <Notification />;
      case 'My Ratings':
        return <RatingsList title="My Ratings" subtitle="The ratings and comments you have submitted." />;
      default:
        return <Overview />;
    }
  };

  return renderPage();
};

export default TenantDashboard;
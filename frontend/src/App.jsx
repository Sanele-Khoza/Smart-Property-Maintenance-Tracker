import React, { useState, useEffect } from 'react';
import { getSession, logoutUser, refreshUsers } from './data/authStore';
import { getTickets } from './data/store';
import { startSlaPolling, stopSlaPolling } from './data/slaEngine';
import { setLogoutHandler, api, getToken } from './api/client';
import Navbar from './components/common/Navbar';
import LoginPage from './components/auth/LoginPage';
import RegisterPage from './components/auth/RegisterPage';
import VerifyEmailPage from './components/auth/VerifyEmailPage';
import ForgotPasswordPage from './components/auth/ForgotPasswordPage';
import TenantDashboard from './pages/dashboard/TenantDashboard';
import PropertyManagerDashboard from './pages/dashboard/PropertyManagerDashboard';
import ServiceProviderDashboard from './pages/dashboard/ServiceProviderDashboard';
import SystemAdminDashboard from './pages/dashboard/SystemAdminDashboard';

const adminNavItems = [
  'Overview', 'Users', 'Properties', 'Units', 'Tickets',
  'Categories', 'Reports', 'Audit Logs', 'Activity',
  'Notifications', 'Messages', 'Settings', 'Backup',
  'Analytics', 'Help', 'Roles', 'System Health',
  'Technicians', 'Tenants',
];

const managerNavItems = [
  'Overview', 'Properties', 'Units', 'Tenants',
  'Tickets', 'AI Review', 'Technicians', 'Scheduling', 'Reports',
];

const tenantNavItems = [
  'Overview', 'Create Ticket', 'Profile', 'My Property', 'My Unit',
  'Ticket Tracking', 'Notification',
];

const providerNavItems = [
  'Overview', 'Profile', 'My Jobs', 'Job Detail',
  'Schedule', 'Emergency', 'Notifications', 'Messages',
  'Work History', 'My Performance',
];

function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('loading');
  const [activeAdminPage, setActiveAdminPage] = useState('Overview');
  const [activeManagerPage, setActiveManagerPage] = useState('Overview');
  const [activeTenantPage, setActiveTenantPage] = useState('Overview');
  const [activeProviderPage, setActiveProviderPage] = useState('Overview');
  const [verificationToken, setVerificationToken] = useState('');

  useEffect(() => {
    setLogoutHandler(() => {
      stopSlaPolling();
      setUser(null);
      setPage('login');
    });

    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    if (urlToken) {
      setVerificationToken(urlToken);
      setPage('verify-email');
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    const session = getSession();
    if (session) {
      // Validate the stored session against the backend — stale/expired
      // tokens get cleared so the user lands on the login page.
      api('/auth/me', { skipAuthRetry: true })
        .then((result) => {
          if (!getToken()) return;
          if (!result.success) {
            logoutUser().then(() => { setUser(null); setPage('login'); });
            return;
          }
          setUser(session);
          setPage('app');
          startSlaPolling();
          refreshUsers();
        })
        .catch(() => {
          if (getToken()) {
            logoutUser().then(() => { setUser(null); setPage('login'); });
          }
        });
    } else {
      setPage('login');
    }

    const handleSlaBreach = (e) => {
      const { ticketId, priority } = e.detail;
      if (Notification.permission === 'granted') {
        new Notification('SLA Breach', {
          body: `${ticketId} (${priority}) — resolution deadline exceeded.`,
        });
      } else {
        console.warn(`SLA BREACH: ${ticketId} (${priority}) — resolution deadline exceeded.`);
      }
    };
    window.addEventListener('spmt:sla-breach', handleSlaBreach);
    return () => window.removeEventListener('spmt:sla-breach', handleSlaBreach);
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    setPage('app');
  };

  const handleLogout = async () => {
    stopSlaPolling();
    await logoutUser();
    setUser(null);
    setPage('login');
  };

  const navigateToRegister = () => setPage('register');
  const navigateToLogin = () => setPage('login');
  const navigateToVerify = (token) => { setVerificationToken(token); setPage('verify-email'); };
  const navigateToForgotPassword = () => setPage('forgot-password');
  const handleVerified = () => setPage('login');

  const getSidebarProps = () => {
    switch (user?.role) {
      case 'SYSTEM_ADMIN':
        return { items: adminNavItems, active: activeAdminPage, setter: setActiveAdminPage };
      case 'PROPERTY_MANAGER':
        return { items: managerNavItems, active: activeManagerPage, setter: setActiveManagerPage };
      case 'TENANT':
        return { items: tenantNavItems, active: activeTenantPage, setter: setActiveTenantPage };
      case 'SERVICE_PROVIDER':
        return { items: providerNavItems, active: activeProviderPage, setter: setActiveProviderPage };
      default:
        return undefined;
    }
  };

  const renderDashboard = () => {
    if (!user) return null;
    switch (user.role) {
      case 'TENANT':
        return <TenantDashboard currentUser={`${user.name} ${user.surname}`} activePage={activeTenantPage} />;
      case 'PROPERTY_MANAGER':
        return <PropertyManagerDashboard activePage={activeManagerPage} />;
      case 'SERVICE_PROVIDER':
        return <ServiceProviderDashboard activePage={activeProviderPage} />;
      case 'SYSTEM_ADMIN':
        return <SystemAdminDashboard activePage={activeAdminPage} />;
      default:
        return <TenantDashboard currentUser={`${user.name} ${user.surname}`} activePage={activeTenantPage} />;
    }
  };

  if (page === 'loading') return null;

  if (page === 'login') {
    return <LoginPage onLogin={handleLogin} onRegisterNavigate={navigateToRegister} onForgotPassword={navigateToForgotPassword} />;
  }

  if (page === 'register') {
    return <RegisterPage onRegisterSuccess={navigateToLogin} onVerifyNavigate={navigateToVerify} />;
  }

  if (page === 'verify-email') {
    return <VerifyEmailPage token={verificationToken} onVerified={handleVerified} />;
  }

  if (page === 'forgot-password') {
    return <ForgotPasswordPage onBack={() => setPage('login')} />;
  }

  const sidebar = getSidebarProps();
  const aiReviewCount = getTickets().filter(t => t.conflictDetected || t.manualReviewRequired).length;
  const sidebarBadges = user?.role === 'PROPERTY_MANAGER' ? { 'AI Review': aiReviewCount } : {};

  return (
    <>
      <Navbar
        user={user}
        onLogout={handleLogout}
        sidebarItems={sidebar?.items}
        activeSidebarItem={sidebar?.active}
        onSidebarItemClick={sidebar?.setter}
        sidebarBadges={sidebarBadges}
      />
      <div className="layout">
        <div className="main" style={{ width: '100%' }}>
          {renderDashboard()}
        </div>
      </div>
    </>
  );
}

export default App;

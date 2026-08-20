import React, { useState } from 'react';
import { FaSun, FaMoon } from 'react-icons/fa';

const roleLabels = {
  TENANT: 'Tenant',
  PROPERTY_MANAGER: 'Property Manager',
  SERVICE_PROVIDER: 'Service Provider',
  SYSTEM_ADMIN: 'System Admin',
};

const Navbar = ({ user, onLogout, sidebarItems, activeSidebarItem, onSidebarItemClick, sidebarBadges, theme, onToggleTheme }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleItemClick = (item) => {
    setMenuOpen(false);
    if (onSidebarItemClick) onSidebarItemClick(item);
  };

  return (
    <header className="header">
      <div className="header-brand">
        <img src="/SPMT.svg" alt="SPMT" className="header-logo" />
        <div>
          <div className="header-title">SPMT - GROUP 20</div>
          <div className="header-subtitle">Smart Property Maintenance Tracker</div>
        </div>
      </div>
      <div className="user-info">
        <span className="user-role">{roleLabels[user?.role] || user?.role}</span>
        <span className="header-badge">{user?.name} {user?.surname}</span>
        <button
          className="theme-toggle-btn"
          onClick={onToggleTheme}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <FaSun /> : <FaMoon />}
        </button>
        <button className="nav-menu-btn" onClick={() => setMenuOpen(true)}>⋮</button>
      </div>
      {menuOpen && <div className="nav-menu-overlay" onClick={() => setMenuOpen(false)} />}
      <div className={`nav-menu ${menuOpen ? 'nav-menu-open' : ''}`}>
        <button className="nav-menu-close" onClick={() => setMenuOpen(false)}>×</button>
        <div className="nav-menu-items">
          {sidebarItems?.map(item => (
            <button
              key={item}
              className={`sidebar-item-btn ${activeSidebarItem === item ? 'active' : ''}`}
              onClick={() => handleItemClick(item)}
            >
              {item}
              {sidebarBadges?.[item] > 0 && (
                <span className="sidebar-badge">{sidebarBadges[item]}</span>
              )}
            </button>
          ))}
          {sidebarItems?.length > 0 && <div className="sidebar-divider" />}
          <button className="btn btn-danger btn-full" onClick={() => { setMenuOpen(false); onLogout(); }}>
            Logout
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;

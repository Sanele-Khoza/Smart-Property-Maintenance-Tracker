import React, { useState, useMemo } from 'react';
import { FaShieldAlt, FaUserTag, FaCheck, FaTimes, FaSearch, FaChevronDown, FaChevronRight, FaInfoCircle } from 'react-icons/fa';
import { getUsers, updateUser } from '../../data/authStore';

const ROLES = ['TENANT', 'PROPERTY_MANAGER', 'SERVICE_PROVIDER', 'TECHNICIAN', 'SYSTEM_ADMIN'];
const ROLE_LABELS = { TENANT: 'Tenant', PROPERTY_MANAGER: 'Property Manager', SERVICE_PROVIDER: 'Service Provider', TECHNICIAN: 'Technician', SYSTEM_ADMIN: 'System Admin' };
const ROLE_COLORS = { TENANT: '#8e44ad', PROPERTY_MANAGER: '#2980b9', SERVICE_PROVIDER: '#d35400', TECHNICIAN: '#16a085', SYSTEM_ADMIN: '#c0392b' };

const PERMISSIONS = [
  { id: 'tickets.create', label: 'Create Ticket' },
  { id: 'tickets.view.own', label: 'View Own Tickets' },
  { id: 'tickets.view.all', label: 'View All Tickets' },
  { id: 'tickets.update.status', label: 'Update Ticket Status' },
  { id: 'tickets.override.category', label: 'Override AI Category' },
  { id: 'tickets.assign', label: 'Assign Tickets' },
  { id: 'tickets.escalate', label: 'Escalate Tickets' },
  { id: 'tickets.reopen', label: 'Reopen Tickets' },
  { id: 'tickets.delete', label: 'Delete Tickets' },
  { id: 'properties.view.own', label: 'View Own Properties' },
  { id: 'properties.view.all', label: 'View All Properties' },
  { id: 'properties.manage', label: 'Manage Properties' },
  { id: 'users.view', label: 'View Users' },
  { id: 'users.manage', label: 'Manage Users (CRUD)' },
  { id: 'users.change.role', label: 'Change User Roles' },
  { id: 'users.approve', label: 'Approve Property Managers' },
  { id: 'categories.view', label: 'View Category Taxonomy' },
  { id: 'categories.manage', label: 'Manage Categories' },
  { id: 'categories.ai.thresholds', label: 'Edit AI Thresholds' },
  { id: 'reports.view', label: 'View Reports' },
  { id: 'reports.export', label: 'Export Reports (PDF)' },
  { id: 'analytics.view', label: 'View Analytics' },
  { id: 'activity.view', label: 'View Activity Feed' },
  { id: 'notifications.view', label: 'View Notifications' },
  { id: 'notifications.retry', label: 'Retry / Dismiss Notifications' },
  { id: 'settings.view', label: 'View System Settings' },
  { id: 'settings.manage', label: 'Edit System Settings' },
  { id: 'backup.view', label: 'View Backup Snapshots' },
  { id: 'backup.trigger', label: 'Trigger Manual Snapshot' },
  { id: 'backup.restore', label: 'Restore from Snapshot' },
  { id: 'backup.pitr', label: 'PITR Restore' },
  { id: 'audit.view', label: 'View Audit Trail' },
  { id: 'messages.templates', label: 'View Notification Templates' },
];

const RBAC_MATRIX = {
  TENANT: [
    'tickets.create', 'tickets.view.own', 'tickets.update.status',
    'properties.view.own',
  ],
  PROPERTY_MANAGER: [
    'tickets.create', 'tickets.view.own', 'tickets.view.all', 'tickets.update.status',
    'tickets.assign', 'tickets.escalate', 'tickets.reopen',
    'properties.view.own', 'properties.view.all', 'properties.manage',
    'users.view',
    'reports.view',
    'activity.view',
    'audit.view',
  ],
  SERVICE_PROVIDER: [
    'tickets.view.own', 'tickets.update.status',
    'properties.view.own',
  ],
  TECHNICIAN: [
    'tickets.view.own', 'tickets.view.all', 'tickets.update.status',
    'tickets.override.category', 'tickets.escalate',
    'properties.view.own', 'properties.view.all',
    'categories.view',
    'reports.view',
    'activity.view',
  ],
  SYSTEM_ADMIN: [
    'tickets.create', 'tickets.view.own', 'tickets.view.all', 'tickets.update.status',
    'tickets.override.category', 'tickets.assign', 'tickets.escalate', 'tickets.reopen', 'tickets.delete',
    'properties.view.own', 'properties.view.all', 'properties.manage',
    'users.view', 'users.manage', 'users.change.role', 'users.approve',
    'categories.view', 'categories.manage', 'categories.ai.thresholds',
    'reports.view', 'reports.export',
    'analytics.view',
    'activity.view',
    'notifications.view', 'notifications.retry',
    'settings.view', 'settings.manage',
    'backup.view', 'backup.trigger', 'backup.restore', 'backup.pitr',
    'audit.view',
    'messages.templates',
  ],
};

const GROUPS = [
  { label: 'Tickets', permIds: ['tickets.create', 'tickets.view.own', 'tickets.view.all', 'tickets.update.status', 'tickets.override.category', 'tickets.assign', 'tickets.escalate', 'tickets.reopen', 'tickets.delete'] },
  { label: 'Properties', permIds: ['properties.view.own', 'properties.view.all', 'properties.manage'] },
  { label: 'Users', permIds: ['users.view', 'users.manage', 'users.change.role', 'users.approve'] },
  { label: 'Categories', permIds: ['categories.view', 'categories.manage', 'categories.ai.thresholds'] },
  { label: 'Reports & Analytics', permIds: ['reports.view', 'reports.export', 'analytics.view', 'activity.view'] },
  { label: 'Notifications', permIds: ['notifications.view', 'notifications.retry', 'messages.templates'] },
  { label: 'Settings', permIds: ['settings.view', 'settings.manage'] },
  { label: 'Backup', permIds: ['backup.view', 'backup.trigger', 'backup.restore', 'backup.pitr'] },
  { label: 'Audit', permIds: ['audit.view'] },
];

const Roles = () => {
  const [users, setUsers] = useState(() => getUsers());
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState('SYSTEM_ADMIN');
  const [expandedPerms, setExpandedPerms] = useState({});
  const [changingRoles, setChangingRoles] = useState({});
  const [message, setMessage] = useState(null);

  const refreshUsers = () => setUsers([...getUsers()]);

  const handleRoleChange = (userId, newRole) => {
    setChangingRoles(p => ({ ...p, [userId]: newRole }));
  };

  const confirmRoleChange = (userId) => {
    const newRole = changingRoles[userId];
    if (!newRole) return;
    const result = updateUser(userId, { role: newRole });
    if (result.success) {
      setMessage({ type: 'success', text: `${result.data.name} ${result.data.surname} role updated to ${ROLE_LABELS[newRole]}.` });
      setChangingRoles(p => { const n = { ...p }; delete n[userId]; return n; });
      refreshUsers();
    } else {
      setMessage({ type: 'error', text: result.error });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const selectedPermIds = RBAC_MATRIX[selectedRole] || [];

  const filteredUsers = useMemo(() =>
    users.filter(u =>
      !search || u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.surname.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.role.toLowerCase().includes(search.toLowerCase())
    ), [users, search]);

  return (
    <div>
      <div className="card">
        <div className="card-title">
          <span><FaShieldAlt /> Role-Based Access Control (RBAC) Matrix <span className="req-ref">NFR-SEC04</span></span>
          <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-dim)' }}>5 roles · {PERMISSIONS.length} permissions</span>
        </div>
      </div>

      {message && (
        <div className="card" style={{
          padding: '8px 14px', marginBottom: 8, fontSize: 12,
          backgroundColor: message.type === 'success' ? 'rgba(45,183,145,0.08)' : 'rgba(192,57,43,0.08)',
          borderColor: message.type === 'success' ? 'rgba(45,183,145,0.3)' : 'rgba(192,57,43,0.3)',
        }}>
          {message.text}
        </div>
      )}

      <div className="card" style={{ overflowX: 'auto' }}>
        <div style={{ fontSize: 13, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <FaInfoCircle style={{ color: 'var(--amber)' }} />
          Permissions matrix — rows are resource-level permissions, columns are roles. <FaCheck style={{ color: 'var(--teal)', fontSize: 10 }} /> = granted.
        </div>
        <table className="data-table" style={{ fontSize: 11, minWidth: 700 }}>
          <thead>
            <tr>
              <th style={{ position: 'sticky', left: 0, zIndex: 2, backgroundColor: 'var(--card-bg)' }}>Permission</th>
              {ROLES.map(r => (
                <th key={r} style={{
                  textAlign: 'center', minWidth: 100,
                  borderBottom: `2px solid ${ROLE_COLORS[r]}40`,
                  color: ROLE_COLORS[r],
                }}>{ROLE_LABELS[r]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GROUPS.map(group => {
              const groupPerms = PERMISSIONS.filter(p => group.permIds.includes(p.id));
              return (
                <React.Fragment key={group.label}>
                  <tr>
                    <td colSpan={6} style={{
                      fontWeight: 600, fontSize: 11, padding: '6px 10px',
                      backgroundColor: 'rgba(255,255,255,0.03)', textTransform: 'uppercase',
                      letterSpacing: 0.5, color: 'var(--text-dim)',
                    }}>{group.label}</td>
                  </tr>
                  {groupPerms.map(perm => (
                    <tr key={perm.id}>
                      <td style={{ padding: '5px 10px' }}>{perm.label}</td>
                      {ROLES.map(r => {
                        const has = RBAC_MATRIX[r]?.includes(perm.id);
                        return (
                          <td key={r} style={{ textAlign: 'center', padding: '5px' }}>
                            {has
                              ? <FaCheck style={{ color: 'var(--teal)', fontSize: 11 }} />
                              : <FaTimes style={{ color: 'var(--danger)', fontSize: 10, opacity: 0.5 }} />
                            }
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <div className="card" style={{ flex: 1 }}>
          <div className="card-title">
            <span><FaUserTag /> User Role Assignment</span>
            <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-dim)' }}>{filteredUsers.length} users</span>
          </div>
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <FaSearch style={{ color: 'var(--text-dim)', fontSize: 12 }} />
              <input className="form-input" style={{ flex: 1, fontSize: 12, padding: '6px 10px' }} placeholder="Search users by name, email, or role..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <table className="data-table" style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Current Role</th>
                <th style={{ width: 180 }}>Change Role</th>
                <th style={{ width: 60 }}>Save</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 20 }}>No users found.</td></tr>
              )}
              {filteredUsers.map(u => {
                const selectedNew = changingRoles[u.id] !== undefined ? changingRoles[u.id] : '';
                const hasChange = selectedNew && selectedNew !== u.role;
                return (
                  <tr key={u.id}>
                    <td style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        backgroundColor: `${ROLE_COLORS[u.role]}20`, color: ROLE_COLORS[u.role], fontSize: 10, fontWeight: 700,
                      }}>{u.name[0]}{u.surname[0]}</div>
                      <span>{u.name} {u.surname}</span>
                      {u.status !== 'Active' && (
                        <span style={{
                          fontSize: 9, padding: '1px 5px', borderRadius: 3,
                          backgroundColor: u.status === 'Pending' ? 'rgba(243,156,18,0.15)' : 'rgba(192,57,43,0.15)',
                          color: u.status === 'Pending' ? 'var(--amber)' : 'var(--danger)',
                        }}>{u.status}</span>
                      )}
                    </td>
                    <td style={{ color: 'var(--text-dim)', fontSize: 11 }}>{u.email}</td>
                    <td>
                      <span style={{
                        padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600,
                        backgroundColor: `${ROLE_COLORS[u.role]}20`, color: ROLE_COLORS[u.role],
                      }}>{ROLE_LABELS[u.role]}</span>
                    </td>
                    <td>
                      <select className="form-input" style={{ fontSize: 11, padding: '4px 6px' }}
                        value={selectedNew} onChange={e => handleRoleChange(u.id, e.target.value)}>
                        <option value="">— Keep current —</option>
                        {ROLES.filter(r => r !== u.role).map(r => (
                          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <button className="table-action-btn"
                        style={!hasChange ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                        disabled={!hasChange}
                        onClick={() => confirmRoleChange(u.id)}>Save</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="card" style={{ flex: '0 0 280px', maxHeight: 400, overflowY: 'auto' }}>
          <div className="card-title" style={{ fontSize: 13 }}>
            <span><FaShieldAlt /> {ROLE_LABELS[selectedRole]} Permissions</span>
          </div>
          <div style={{ marginBottom: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {ROLES.map(r => (
              <button key={r} onClick={() => setSelectedRole(r)}
                style={{
                  padding: '3px 8px', fontSize: 10, borderRadius: 3, border: 'none',
                  backgroundColor: selectedRole === r ? ROLE_COLORS[r] : `${ROLE_COLORS[r]}20`,
                  color: selectedRole === r ? '#fff' : ROLE_COLORS[r],
                  cursor: 'pointer', fontWeight: 600,
                }}
              >{ROLE_LABELS[r]}</button>
            ))}
          </div>
          <div style={{ fontSize: 11 }}>
            <div style={{ color: 'var(--text-dim)', marginBottom: 6 }}>{selectedPermIds.length} of {PERMISSIONS.length} permissions granted</div>
            <div style={{
              height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.06)', marginBottom: 10, overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', borderRadius: 2, backgroundColor: ROLE_COLORS[selectedRole],
                width: `${(selectedPermIds.length / PERMISSIONS.length) * 100}%`, transition: 'width 0.3s',
              }} />
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {GROUPS.map(group => {
                const groupPerms = PERMISSIONS.filter(p => group.permIds.includes(p.id));
                const granted = groupPerms.filter(p => selectedPermIds.includes(p.id));
                if (granted.length === 0) return null;
                const isExpanded = expandedPerms[`${selectedRole}-${group.label}`] !== false;
                return (
                  <li key={group.label} style={{ marginBottom: 4 }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', padding: '3px 0',
                    }} onClick={() => setExpandedPerms(p => ({ ...p, [`${selectedRole}-${group.label}`]: !isExpanded }))}>
                      {isExpanded ? <FaChevronDown style={{ fontSize: 8 }} /> : <FaChevronRight style={{ fontSize: 8 }} />}
                      <span style={{ fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.3, color: 'var(--text-dim)' }}>
                        {group.label} ({granted.length}/{groupPerms.length})
                      </span>
                    </div>
                    {isExpanded && (
                      <ul style={{ listStyle: 'none', padding: '0 0 4px 14px', margin: 0 }}>
                        {groupPerms.map(perm => {
                          const has = granted.includes(perm);
                          return (
                            <li key={perm.id} style={{
                              padding: '2px 0', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11,
                              color: has ? 'var(--text-color)' : 'var(--text-dim)',
                            }}>
                              {has
                                ? <FaCheck style={{ color: 'var(--teal)', fontSize: 9 }} />
                                : <FaTimes style={{ color: 'var(--danger)', fontSize: 8, opacity: 0.4 }} />
                              }
                              {perm.label}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Roles;

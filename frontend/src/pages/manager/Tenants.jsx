import React, { useState, useMemo, useEffect } from 'react';
import { FaUsers, FaExclamationTriangle, FaBuilding, FaDoorOpen, FaTicketAlt, FaUserCheck, FaUserSlash, FaSearch, FaEnvelope, FaPhone, FaCheckCircle, FaTimesCircle, FaUserPlus, FaCheck } from 'react-icons/fa';
import { getUnits, getProperties, getTickets } from '../../data/store';
import { getUsers, approveManager, refreshUsers } from '../../data/authStore';
import { getSession } from '../../data/authStore';
import Alert from '../../components/common/Alert';

const Tenants = () => {
  const session = getSession();
  const pmName = session ? `${session.name} ${session.surname}` : '';
  const [allProperties] = useState(getProperties);
  const [properties] = useState(() => allProperties.filter(p => p.managerName === pmName));
  const propIds = new Set(properties.map(p => p.propertyId));
  const [units] = useState(() => getUnits().filter(u => propIds.has(u.propertyId)));
  const [tickets] = useState(getTickets);
  const [allUsers, setAllUsers] = useState(() => getUsers());
  const [alert, setAlert] = useState({ msg: '', type: '' });
  const [search, setSearch] = useState('');
  const [expandedTenant, setExpandedTenant] = useState(null);

  useEffect(() => {
    let cancelled = false;
    refreshUsers().then(() => { if (!cancelled) setAllUsers(getUsers()); });
    return () => { cancelled = true; };
  }, []);

  const showAlert = (msg, type) => { setAlert({ msg, type }); setTimeout(() => setAlert({ msg: '', type: '' }), 5000); };
  const refresh = () => window.location.reload();

  const pendingApprovals = allUsers.filter(u =>
    (u.role === 'TENANT' || u.role === 'SERVICE_PROVIDER') &&
    String(u.status).toUpperCase() === 'PENDING'
  );

  const tenantData = useMemo(() => {
    const map = {};
    units.filter(u => u.status === 'OCCUPIED' && u.tenantName).forEach(u => {
      if (!map[u.tenantName]) map[u.tenantName] = { unitCount: 0, units: [] };
      map[u.tenantName].unitCount++;
      map[u.tenantName].units.push(u);
    });

    tickets.filter(t => t.propertyName && properties.some(p => p.name === t.propertyName)).forEach(t => {
      if (!t.createdBy) return;
      if (!map[t.createdBy]) map[t.createdBy] = { unitCount: 0, units: [] };
    });

    allUsers.filter(u => u.role === 'TENANT').forEach(u => {
      const name = `${u.name} ${u.surname}`;
      if (!map[name]) return;
      map[name].email = u.email;
      map[name].phone = u.phone;
      map[name].authId = u.id;
      map[name].authStatus = u.status;
    });

    return Object.entries(map).map(([name, d]) => {
      const tenantTickets = tickets.filter(t => t.createdBy === name);
      const hasUnit = d.unitCount > 0;
      const hasProperty = tenantTickets.some(t => properties.some(p => p.name === t.propertyName));
      if (!hasUnit && !hasProperty) return null;
      return {
        name, email: d.email || '—', phone: d.phone || '—', authId: d.authId || null, authStatus: d.authStatus || null,
        units: d.units, unitCount: d.unitCount, hasUnit, hasAuthRecord: !!d.authId,
        canSubmitTicket: hasUnit, isOrphan: d.authId && !hasUnit,
        ticketCount: tenantTickets.length, tickets: tenantTickets,
      };
    }).filter(Boolean);
  }, [units, tickets, allUsers, properties]);

  const filtered = search ? tenantData.filter(t => t.name.toLowerCase().includes(search.toLowerCase()) || t.email.toLowerCase().includes(search.toLowerCase())) : tenantData;

  const handleApprove = async (userId) => {
    const r = await approveManager(userId);
    if (r.success) { showAlert(`Account approved.`, 'success'); refresh(); }
    else showAlert(r.error, 'error');
  };

  return (
    <div>
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

      <div className="card">
        <div className="card-title"><span><FaUsers /> My Tenants</span></div>
        <Alert msg={alert.msg} type={alert.type} />
        <div className="stat-grid">
          <div className="stat-card"><div className="stat-value"><FaUsers /> {tenantData.length}</div><div className="stat-label">Total Tenants</div></div>
          <div className="stat-card"><div className="stat-value"><FaCheckCircle style={{ color: 'var(--teal)' }} /> {tenantData.filter(t => t.canSubmitTicket).length}</div><div className="stat-label">Can Submit Tickets</div></div>
          <div className="stat-card"><div className="stat-value"><FaUserSlash style={{ color: 'var(--amber)' }} /> {tenantData.filter(t => t.isOrphan).length}</div><div className="stat-label">Orphan (No Unit)</div></div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <span><FaUsers /> Tenant Directory</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <FaSearch style={{ color: 'var(--text-dim)' }} />
            <input className="form-input" style={{ width: 200 }} placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead><tr><th>Name / Contact</th><th>Unit</th><th>Property</th><th>Tickets</th><th>Eligibility</th><th>Status</th></tr></thead>
            <tbody>
              {filtered.length === 0 ? <tr><td colSpan="6" style={{ textAlign: 'center', padding: 24, color: 'var(--text-dim)' }}>No tenants found.</td></tr> : (
                filtered.map(tenant => (
                  <React.Fragment key={tenant.name}>
                    <tr style={tenant.isOrphan ? { backgroundColor: 'rgba(243,156,18,0.06)' } : {}}>
                      <td>
                        <div><strong>{tenant.name}</strong></div>
                        <div style={{ fontSize: 10, color: 'var(--text-dim)', display: 'flex', gap: 10, marginTop: 2 }}>
                          {tenant.email !== '—' && <span><FaEnvelope style={{ fontSize: 8, marginRight: 2 }} />{tenant.email}</span>}
                          {tenant.phone !== '—' && <span><FaPhone style={{ fontSize: 8, marginRight: 2 }} />{tenant.phone}</span>}
                        </div>
                      </td>
                      <td>{tenant.unitCount > 0 ? <span><FaDoorOpen /> {tenant.units.map(u => u.unitNumber).join(', ')}</span> : <span style={{ color: 'var(--danger)', fontStyle: 'italic', fontSize: 12 }}>No unit</span>}</td>
                      <td>{tenant.unitCount > 0 ? <span><FaBuilding /> {tenant.units[0].propertyName}</span> : <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>—</span>}</td>
                      <td><button className="btn btn-sm btn-secondary" onClick={() => setExpandedTenant(expandedTenant === tenant.name ? null : tenant.name)}><FaTicketAlt style={{ marginRight: 4 }} />{tenant.ticketCount}</button></td>
                      <td>{tenant.canSubmitTicket ? <span className="badge badge-completed"><FaCheckCircle /> Eligible</span> : <span className="badge badge-danger"><FaTimesCircle /> Blocked</span>}</td>
                      <td>{tenant.isOrphan ? <span className="badge badge-warning"><FaUserSlash /> Orphan</span> : <span className="badge badge-completed"><FaUserCheck /> Assigned</span>}</td>
                    </tr>
                    {expandedTenant === tenant.name && (
                      <tr className="expanded-row"><td colSpan="6" style={{ padding: '8px 16px', backgroundColor: 'var(--surface)' }}>
                        {tenant.hasAuthRecord && <div style={{ display: 'flex', gap: 16, fontSize: 11, marginBottom: 8, borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                          {tenant.email !== '—' && <span><FaEnvelope style={{ fontSize: 9, marginRight: 3 }} />{tenant.email}</span>}
                          {tenant.phone !== '—' && <span><FaPhone style={{ fontSize: 9, marginRight: 3 }} />{tenant.phone}</span>}
                          <span>Status: {tenant.authStatus || '—'}</span>
                        </div>}
                        {tenant.tickets.length === 0 ? <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>No tickets.</div> : (
                          <div><div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Ticket History ({tenant.tickets.length})</div>
                          <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                            <thead><tr style={{ borderBottom: '1px solid var(--border)' }}><th style={{ textAlign: 'left', padding: '4px 8px' }}>ID</th><th style={{ textAlign: 'left', padding: '4px 8px' }}>Title</th><th style={{ textAlign: 'left', padding: '4px 8px' }}>Status</th><th style={{ textAlign: 'left', padding: '4px 8px' }}>Priority</th><th style={{ textAlign: 'left', padding: '4px 8px' }}>Unit</th></tr></thead>
                            <tbody>{tenant.tickets.map(t => (<tr key={t.ticketId} style={{ borderBottom: '1px solid var(--border)' }}><td className="cell-mono" style={{ padding: '4px 8px' }}>{t.ticketId}</td><td style={{ padding: '4px 8px' }}>{t.title}</td><td style={{ padding: '4px 8px' }}><span className={`badge ${t.status === 'Closed' || t.status === 'Completed (Provider)' ? 'badge-completed' : t.status === 'Assigned' || t.status === 'In Progress' ? 'badge-info' : 'badge-warning'}`}>{t.status}</span></td><td style={{ padding: '4px 8px' }}><span className={`badge ${t.priority === 'URGENT' ? 'badge-danger' : t.priority === 'HIGH' ? 'badge-warning' : t.priority === 'MEDIUM' ? 'badge-info' : 'badge-completed'}`}>{t.priority}</span></td><td className="cell-mono" style={{ padding: '4px 8px' }}>{t.unitNumber}</td></tr>))}</tbody>
                          </table></div>
                        )}
                      </td></tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Tenants;

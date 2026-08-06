import React, { useState, useMemo } from 'react';
import { FaUsers, FaExclamationTriangle, FaBuilding, FaDoorOpen, FaTicketAlt, FaUserCheck, FaUserSlash, FaSearch, FaEnvelope, FaPhone, FaIdBadge, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import { getUnits, getProperties, getTickets } from '../../data/store';
import { getUsers } from '../../data/authStore';
import Alert from '../../components/common/Alert';

const Tenants = () => {
  const [units] = useState(getUnits);
  const [properties] = useState(getProperties);
  const [tickets] = useState(getTickets);
  const [users] = useState(() => getUsers().filter(u => u.role === 'TENANT'));
  const [alert, setAlert] = useState({ msg: '', type: '' });
  const [search, setSearch] = useState('');
  const [expandedTenant, setExpandedTenant] = useState(null);

  const showAlert = (msg, type) => {
    setAlert({ msg, type });
    setTimeout(() => setAlert({ msg: '', type: '' }), 5000);
  };

  const tenantData = useMemo(() => {
    const occupiedUnits = units.filter(u => u.status === 'OCCUPIED' && u.tenantName);

    const map = {};

    // From unit assignments
    occupiedUnits.forEach(u => {
      if (!map[u.tenantName]) {
        map[u.tenantName] = { unitCount: 0, units: [], unitIds: [] };
      }
      map[u.tenantName].unitCount++;
      map[u.tenantName].units.push(u);
      map[u.tenantName].unitIds.push(u.unitId);
    });

    // From authStore TENANT users
    users.forEach(u => {
      const name = `${u.name} ${u.surname}`;
      if (!map[name]) {
        map[name] = { unitCount: 0, units: [], unitIds: [] };
      }
      map[name].email = u.email;
      map[name].phone = u.phone;
      map[name].authId = u.id;
      map[name].authStatus = u.status;
    });

    // From ticket creators (orphans who aren't in units or authStore)
    const ticketCreators = [...new Set(tickets.filter(t => t.createdBy).map(t => t.createdBy))];
    ticketCreators.forEach(name => {
      if (!map[name]) {
        map[name] = { unitCount: 0, units: [], unitIds: [] };
      }
    });

    // Build final list
    return Object.entries(map).map(([name, d]) => {
      const tenantTickets = tickets.filter(t => t.createdBy === name);
      const hasUnit = d.unitCount > 0;
      const hasAuthRecord = !!d.authId;
      const canSubmitTicket = hasUnit;

      return {
        name,
        email: d.email || '—',
        phone: d.phone || '—',
        authId: d.authId || null,
        authStatus: d.authStatus || null,
        units: d.units,
        unitCount: d.unitCount,
        hasUnit,
        hasAuthRecord,
        canSubmitTicket,
        isOrphan: hasAuthRecord && !hasUnit,
        isGhost: !hasAuthRecord && !hasUnit,
        ticketCount: tenantTickets.length,
        tickets: tenantTickets,
      };
    });
  }, [units, tickets, users]);

  const filtered = useMemo(() => {
    if (!search) return tenantData;
    const q = search.toLowerCase();
    return tenantData.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.email.toLowerCase().includes(q) ||
      (t.phone && t.phone.includes(q))
    );
  }, [tenantData, search]);

  const stats = [
    { label: 'Total Tenants', value: tenantData.length, icon: FaUsers },
    { label: 'Can Submit Tickets', value: tenantData.filter(t => t.canSubmitTicket).length, icon: FaCheckCircle },
    { label: 'Orphan (No Unit)', value: tenantData.filter(t => t.isOrphan).length, icon: FaUserSlash },
    { label: 'Ghost (No Auth + No Unit)', value: tenantData.filter(t => t.isGhost).length, icon: FaExclamationTriangle },
  ];

  const toggleExpand = (name) => {
    setExpandedTenant(prev => prev === name ? null : name);
  };

  return (
    <div>
      <div className="card">
        <div className="card-title">
          <span><FaUsers /> Tenant Records <span className="req-ref">MOD-002</span></span>
        </div>
        <Alert msg={alert.msg} type={alert.type} />
        <div className="stat-grid">
          {stats.map((s, i) => (
            <div className="stat-card" key={i}>
              <div className="stat-value"><s.icon /> {s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <span><FaUsers /> All Tenants</span>
          <div className="filter-bar" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <FaSearch style={{ color: 'var(--text-dim)' }} />
            <input
              className="form-input"
              style={{ width: 220 }}
              placeholder="Search by name, email, phone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name / Contact</th>
                <th>Assigned Unit</th>
                <th>Property</th>
                <th>Tickets</th>
                <th>Eligibility <span style={{ fontWeight: 400, color: 'var(--text-dim)' }}>(REQ-012)</span></th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan="6" className="empty-text" style={{ textAlign: 'center', padding: 24 }}>No tenants match the current filter.</td></tr>
              ) : (
                filtered.map(tenant => {
                  const rowBg = tenant.isOrphan ? 'rgba(243,156,18,0.06)' : tenant.isGhost ? 'rgba(192,57,43,0.06)' : '';

                  return (
                    <React.Fragment key={tenant.name}>
                      <tr style={{ backgroundColor: rowBg }}>
                        <td>
                          <div><strong>{tenant.name}</strong></div>
                          <div style={{ fontSize: 10, color: 'var(--text-dim)', display: 'flex', gap: 10, marginTop: 2 }}>
                            {tenant.email !== '—' && <span><FaEnvelope style={{ fontSize: 8, marginRight: 2 }} />{tenant.email}</span>}
                            {tenant.phone !== '—' && <span><FaPhone style={{ fontSize: 8, marginRight: 2 }} />{tenant.phone}</span>}
                          </div>
                        </td>
                        <td>
                          {tenant.unitCount > 0 ? (
                            <span><FaDoorOpen style={{ marginRight: 4 }} /> {tenant.units.map(u => u.unitNumber).join(', ')}</span>
                          ) : (
                            <span style={{ color: 'var(--danger)', fontStyle: 'italic', fontSize: 12 }}>No unit assigned</span>
                          )}
                        </td>
                        <td>
                          {tenant.unitCount > 0 ? (
                            <span><FaBuilding style={{ marginRight: 4 }} /> {tenant.units[0].propertyName || '—'}</span>
                          ) : (
                            <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>—</span>
                          )}
                        </td>
                        <td>
                          <button
                            className="btn btn-sm btn-secondary"
                            style={{ fontSize: 12, cursor: 'pointer' }}
                            onClick={() => toggleExpand(tenant.name)}
                            title="View tickets"
                          >
                            <FaTicketAlt style={{ marginRight: 4 }} />{tenant.ticketCount}
                          </button>
                          {tenant.ticketCount > 0 && !tenant.canSubmitTicket && (
                            <FaExclamationTriangle style={{ color: 'var(--amber)', marginLeft: 6, fontSize: 11, cursor: 'help' }}
                              title="Has historical tickets but no unit — orphaned data?" />
                          )}
                        </td>
                        <td>
                          {tenant.canSubmitTicket ? (
                            <span className="badge badge-completed"><FaCheckCircle style={{ marginRight: 3 }} /> Eligible</span>
                          ) : (
                            <span className="badge badge-danger"><FaTimesCircle style={{ marginRight: 3 }} /> Blocked</span>
                          )}
                          {!tenant.canSubmitTicket && (
                            <div style={{ fontSize: 9, color: 'var(--danger)', marginTop: 2, maxWidth: 140, lineHeight: 1.3 }}>
                              No unit assignment — ticket submission disabled (BR-001)
                            </div>
                          )}
                        </td>
                        <td>
                          {tenant.isOrphan ? (
                            <span className="badge badge-warning"><FaUserSlash /> Orphan</span>
                          ) : tenant.isGhost ? (
                            <span style={{
                              padding: '2px 6px', borderRadius: 3, fontSize: 10, fontWeight: 600,
                              backgroundColor: 'rgba(192,57,43,0.1)', color: 'var(--danger)',
                            }}><FaExclamationTriangle style={{ fontSize: 9, marginRight: 2 }} />Ghost</span>
                          ) : (
                            <span className="badge badge-completed"><FaUserCheck /> Assigned</span>
                          )}
                        </td>
                      </tr>
                      {expandedTenant === tenant.name && (
                        <tr className="expanded-row">
                          <td colSpan="6" style={{ padding: '8px 16px', backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                            {/* Contact Info Bar */}
                            {tenant.hasAuthRecord && (
                              <div style={{
                                display: 'flex', gap: 16, fontSize: 11, marginBottom: 8, padding: '4px 0',
                                borderBottom: '1px solid var(--border)',
                              }}>
                                <div><span style={{ color: 'var(--text-dim)' }}><FaIdBadge style={{ marginRight: 4, fontSize: 9 }} />Auth ID:</span> {tenant.authId}</div>
                                {tenant.email !== '—' && <div><span style={{ color: 'var(--text-dim)' }}><FaEnvelope style={{ marginRight: 4, fontSize: 9 }} />Email:</span> {tenant.email}</div>}
                                {tenant.phone !== '—' && <div><span style={{ color: 'var(--text-dim)' }}><FaPhone style={{ marginRight: 4, fontSize: 9 }} />Phone:</span> {tenant.phone}</div>}
                                <div><span style={{ color: 'var(--text-dim)' }}>Status:</span> {tenant.authStatus || '—'}</div>
                              </div>
                            )}

                            {!tenant.hasAuthRecord && !tenant.isGhost && (
                              <div style={{ fontSize: 10, color: 'var(--amber)', marginBottom: 8, fontStyle: 'italic' }}>
                                No authStore record for this tenant name — created via ticket only.
                              </div>
                            )}

                            {/* Tickets */}
                            {tenant.tickets.length === 0 ? (
                              <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>No tickets found for this tenant.</div>
                            ) : (
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Ticket History ({tenant.tickets.length})</div>
                                <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                                  <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                      <th style={{ textAlign: 'left', padding: '4px 8px' }}>ID</th>
                                      <th style={{ textAlign: 'left', padding: '4px 8px' }}>Title</th>
                                      <th style={{ textAlign: 'left', padding: '4px 8px' }}>Status</th>
                                      <th style={{ textAlign: 'left', padding: '4px 8px' }}>Priority</th>
                                      <th style={{ textAlign: 'left', padding: '4px 8px' }}>Category</th>
                                      <th style={{ textAlign: 'left', padding: '4px 8px' }}>Unit</th>
                                      <th style={{ textAlign: 'left', padding: '4px 8px' }}>Assigned To</th>
                                      <th style={{ textAlign: 'left', padding: '4px 8px' }}>Created</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {tenant.tickets.map(t => (
                                      <tr key={t.ticketId} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td className="cell-mono" style={{ padding: '4px 8px' }}>{t.ticketId}</td>
                                        <td style={{ padding: '4px 8px' }}>{t.title}</td>
                                        <td style={{ padding: '4px 8px' }}>
                                          <span className={`badge ${
                                            t.status === 'Closed' || t.status === 'Completed' || t.status === 'Tenant Confirmed' ? 'badge-completed' :
                                            t.status === 'Assigned' || t.status === 'In Progress' ? 'badge-info' :
                                            t.status === 'Escalated' || t.status === 'Reopened' ? 'badge-warning' :
                                            'badge-danger'
                                          }`}>{t.status}</span>
                                        </td>
                                        <td style={{ padding: '4px 8px' }}>
                                          <span className={`badge ${
                                            t.priority === 'URGENT' ? 'badge-danger' :
                                            t.priority === 'HIGH' ? 'badge-warning' :
                                            t.priority === 'MEDIUM' ? 'badge-info' : 'badge-completed'
                                          }`}>{t.priority}</span>
                                        </td>
                                        <td style={{ padding: '4px 8px' }}>{t.category || '—'}</td>
                                        <td className="cell-mono" style={{ padding: '4px 8px' }}>{t.unitNumber}</td>
                                        <td style={{ padding: '4px 8px' }}>{t.assignedTo || '—'}</td>
                                        <td className="cell-mono" style={{ padding: '4px 8px', fontSize: 10 }}>{t.createdAt}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Tenants;

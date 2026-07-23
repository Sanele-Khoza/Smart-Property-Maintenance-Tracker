import React, { useState } from 'react';
import { FaBuilding, FaPlus, FaEdit, FaTrash, FaToggleOn, FaToggleOff, FaExclamationTriangle, FaSearch, FaTimes, FaCheck, FaBan, FaHome, FaStore, FaBuilding as FaOffice, FaCircle, FaExclamationCircle, FaEye } from 'react-icons/fa';
import { getProperties, addProperty, updateProperty, updatePropertyStatus, deleteProperty, getUnits } from '../../data/store';
import { getUsers } from '../../data/authStore';
import Alert from '../../components/common/Alert';

const TYPE_CONFIG = {
  RESIDENTIAL: { label: 'Residential', icon: FaHome },
  COMMERCIAL:  { label: 'Commercial',  icon: FaStore },
  MIXED:       { label: 'Mixed',       icon: FaOffice },
};

const TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  ...Object.entries(TYPE_CONFIG).map(([v, c]) => ({ value: v, label: c.label })),
];

const EMPTY_PROPERTY_FORM = { name: '', address: '', propertyType: 'RESIDENTIAL', managerName: '' };

const Properties = () => {
  const [properties, setProperties] = useState(getProperties);
  const [units] = useState(getUnits);
  const [allUsers] = useState(getUsers);
  const [alert, setAlert] = useState({ msg: '', type: '' });
  const [typeFilter, setTypeFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_PROPERTY_FORM);
  const [createError, setCreateError] = useState('');
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_PROPERTY_FORM);
  const [editError, setEditError] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);
  const [expandedRows, setExpandedRows] = useState({});

  const refresh = () => {
    setProperties(getProperties());
  };

  const showAlert = (msg, type) => {
    setAlert({ msg, type });
    setTimeout(() => setAlert({ msg: '', type: '' }), 5000);
  };

  const unitCount = (propertyId) => units.filter(u => u.propertyId === propertyId).length;
  const occupiedCount = (propertyId) => units.filter(u => u.propertyId === propertyId && u.status === 'OCCUPIED').length;
  const vacantCount = (propertyId) => units.filter(u => u.propertyId === propertyId && u.status === 'VACANT').length;
  const totalUnitCount = units.length;

  const managerStatus = (managerName) => {
    const user = allUsers.find(u => `${u.name} ${u.surname}` === managerName || u.name === managerName);
    if (!user) return 'unknown';
    if (user.status === 'Deactivated') return 'deactivated';
    if (user.status === 'Suspended') return 'suspended';
    return 'active';
  };

  const typeIcon = (t) => {
    const cfg = TYPE_CONFIG[t];
    if (!cfg) return <FaBuilding />;
    const Icon = cfg.icon;
    return <Icon />;
  };

  const stats = [
    { label: 'Total Properties', value: properties.length, icon: FaBuilding },
    { label: 'Residential', value: properties.filter(p => p.propertyType === 'RESIDENTIAL').length, icon: FaHome },
    { label: 'Commercial',  value: properties.filter(p => p.propertyType === 'COMMERCIAL').length,  icon: FaStore },
    { label: 'Mixed',       value: properties.filter(p => p.propertyType === 'MIXED').length,       icon: FaOffice },
    { label: 'Active',      value: properties.filter(p => p.status === 'ACTIVE').length,            icon: FaCheck },
    { label: 'Inactive',    value: properties.filter(p => p.status === 'INACTIVE').length,          icon: FaBan },
  ];

  const filtered = typeFilter ? properties.filter(p => p.propertyType === typeFilter) : properties;

  const openCreate = () => {
    setCreateForm(EMPTY_PROPERTY_FORM);
    setCreateError('');
    setShowCreate(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!createForm.name.trim() || !createForm.address.trim()) {
      setCreateError('Name and address are required.');
      return;
    }
    const r = await addProperty(createForm.name, createForm.address, createForm.propertyType, createForm.managerName);
    if (r.success) {
      showAlert(`Property "${r.data.name}" created. (REQ-009)`, 'success');
      setShowCreate(false);
      refresh();
    } else {
      setCreateError(r.error);
    }
  };

  const openEdit = (p) => {
    setEditTarget(p);
    setEditForm({
      name: p.name || '',
      address: p.address || '',
      propertyType: p.propertyType || 'RESIDENTIAL',
      managerName: p.managerName || '',
    });
    setEditError('');
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!editForm.name.trim() || !editForm.address.trim()) {
      setEditError('Name and address are required.');
      return;
    }
    const r = await updateProperty(editTarget.propertyId, {
      name: editForm.name,
      address: editForm.address,
      propertyType: editForm.propertyType,
      managerName: editForm.managerName,
    });
    if (r.success) {
      showAlert('Property updated.', 'success');
      setEditTarget(null);
      refresh();
    } else {
      setEditError(r.error);
    }
  };

  const promptDeactivate = (p) => {
    const occ = occupiedCount(p.propertyId);
    if (occ > 0) {
      setConfirmAction({
        type: 'deactivate_blocked',
        property: p,
        message: `Cannot deactivate "${p.name}" — ${occ} unit(s) are currently occupied. Vacate all units before deactivating.`,
      });
      return;
    }
    setConfirmAction({
      type: 'deactivate',
      property: p,
      message: `Deactivate "${p.name}"? Units will remain but the property will be hidden from active management screens.`,
    });
  };

  const promptReactivate = (p) => {
    setConfirmAction({
      type: 'reactivate',
      property: p,
      message: `Reactivate "${p.name}"? It will reappear on active management screens.`,
    });
  };

  const toggleExpand = (id) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const promptDelete = (p) => {
    const uc = unitCount(p.propertyId);
    if (uc > 0) {
      setConfirmAction({
        type: 'delete_blocked',
        property: p,
        message: `Cannot delete "${p.name}" — it has ${uc} unit(s). Remove all units first (ON DELETE RESTRICT).`,
      });
      return;
    }
    setConfirmAction({
      type: 'delete',
      property: p,
      message: `Permanently delete "${p.name}"? This cannot be undone.`,
    });
  };

  const executeConfirm = async () => {
    const a = confirmAction;
    if (!a) return;

    if (a.type === 'deactivate') {
      const r = await updatePropertyStatus(a.property.propertyId, 'INACTIVE');
      if (r.success) { showAlert(`"${a.property.name}" deactivated.`, 'success'); refresh(); }
      else { showAlert(r.error, 'error'); }
    } else if (a.type === 'reactivate') {
      const r = await updatePropertyStatus(a.property.propertyId, 'ACTIVE');
      if (r.success) { showAlert(`"${a.property.name}" reactivated.`, 'success'); refresh(); }
      else { showAlert(r.error, 'error'); }
    } else if (a.type === 'delete') {
      const r = await deleteProperty(a.property.propertyId);
      if (r.success) { showAlert(`"${a.property.name}" deleted.`, 'success'); refresh(); }
      else { showAlert(r.error, 'error'); }
    }
    setConfirmAction(null);
  };

  return (
    <div>
      <div className="card">
        <div className="card-title">
          <span><FaBuilding /> Properties <span className="req-ref">MOD-002 / REQ-009</span></span>
          <button className="btn btn-teal" onClick={openCreate}><FaPlus /> Add Property</button>
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
          <span><FaBuilding /> All Properties</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <FaSearch style={{ color: 'var(--text-dim)' }} />
            <select className="form-select" style={{ width: 'auto', minWidth: 140 }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Address</th>
                <th>Type</th>
                <th>Manager</th>
                <th>Units</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan="9" className="empty-text" style={{ textAlign: 'center', padding: 24 }}>No properties match the current filter.</td></tr>
              ) : (
                filtered.map(p => {
                  const uc = unitCount(p.propertyId);
                  const occ = occupiedCount(p.propertyId);
                  const hasUnits = uc > 0;
                  const canDelete = !hasUnits;
                  const mgrStat = managerStatus(p.managerName);
                  const occRatio = uc > 0 ? occ / uc : 0;
                  const occDot = occ === 0 ? 'var(--text-dim)' : occ === uc ? 'var(--teal)' : 'var(--amber)';

                  const isExpanded = expandedRows[p.propertyId];
                  const occLabel = uc === 0 ? '—' : occ === 0 ? 'Vacant' : occ === uc ? 'Full' : 'Partial';

                  return (
                  <React.Fragment key={p.propertyId}>
                  <tr>
                    <td className="cell-mono">{p.propertyId}</td>
                    <td>{p.name}</td>
                    <td className="cell-mono" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.address}>{p.address}</td>
                    <td>{typeIcon(p.propertyType)} {TYPE_CONFIG[p.propertyType]?.label || p.propertyType}</td>
                    <td>
                      {p.managerName}
                      {mgrStat === 'deactivated' && <FaExclamationCircle style={{ color: 'var(--danger)', marginLeft: 6 }} title="Manager account is deactivated" />}
                      {mgrStat === 'suspended' && <FaExclamationCircle style={{ color: 'var(--amber)', marginLeft: 6 }} title="Manager account is suspended" />}
                    </td>
                    <td className="cell-mono">
                      <FaCircle style={{ color: occDot, fontSize: 8, marginRight: 4 }} />
                      {uc}
                      <span className="detail-label" style={{ fontSize: 8, marginLeft: 4 }}>
                        {occLabel === '—' ? '(—)' : `(${occ} occ.${vacantCount(p.propertyId) > 0 ? `, ${vacantCount(p.propertyId)} vac.` : ''})`}
                      </span>
                      {occLabel !== '—' && (
                        <span style={{
                          display: 'inline-block',
                          fontSize: 7,
                          marginLeft: 4,
                          padding: '1px 4px',
                          borderRadius: 3,
                          backgroundColor: occLabel === 'Full' ? 'var(--teal)' : occLabel === 'Vacant' ? 'var(--text-dim)' : 'var(--amber)',
                          color: '#fff',
                          verticalAlign: 'middle',
                          lineHeight: '14px',
                        }}>
                          {occLabel}
                        </span>
                      )}
                    </td>
                    <td><span className={p.status === 'ACTIVE' ? 'badge badge-completed' : 'badge badge-danger'}>{p.status}</span></td>
                    <td className="cell-mono" style={{ fontSize: 10 }}>{p.createdAt || '—'}</td>
                    <td>
                      <div className="action-cell">
                        <button className="btn btn-secondary btn-sm" onClick={() => toggleExpand(p.propertyId)} title={isExpanded ? 'Hide details' : 'View details'}><FaEye /></button>
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(p)} title="Edit"><FaEdit /></button>
                        {p.status === 'ACTIVE' ? (
                          <button className="btn btn-danger btn-sm" onClick={() => promptDeactivate(p)} title="Deactivate"><FaToggleOff /></button>
                        ) : (
                          <button className="btn btn-teal btn-sm" onClick={() => promptReactivate(p)} title="Reactivate"><FaToggleOn /></button>
                        )}
                        {canDelete ? (
                          <button className="btn btn-danger btn-sm" onClick={() => promptDelete(p)} title="Delete"><FaTrash /></button>
                        ) : (
                          <button className="btn btn-danger btn-sm" style={{ opacity: 0.35, cursor: 'not-allowed' }} title={`Cannot delete: ${uc} unit(s) exist (ON DELETE RESTRICT)`} disabled><FaTrash /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="expanded-row">
                      <td colSpan="9" style={{ padding: '8px 16px', backgroundColor: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', gap: 32, fontSize: 12, flexWrap: 'wrap' }}>
                          <div><strong>ID:</strong> {p.propertyId}</div>
                          <div><strong>Name:</strong> {p.name}</div>
                          <div><strong>Address:</strong> {p.address}</div>
                          <div><strong>Type:</strong> {TYPE_CONFIG[p.propertyType]?.label || p.propertyType}</div>
                          <div><strong>Manager:</strong> {p.managerName}</div>
                          <div><strong>Status:</strong> {p.status}</div>
                          <div><strong>Created:</strong> {p.createdAt || '—'}</div>
                          <div><strong>Units:</strong> {uc} ({occ} occupied, {vacantCount(p.propertyId)} vacant)</div>
                        </div>
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

      {showCreate && (
        <div className="modal" onClick={() => setShowCreate(false)}>
          <div className="edit-modal" onClick={e => e.stopPropagation()}>
            <div className="edit-modal-header">
              <span><FaPlus /> Add Property <span className="req-ref">REQ-009</span></span>
              <button className="modal-close-btn" onClick={() => setShowCreate(false)}><FaTimes /></button>
            </div>
            <form onSubmit={handleCreate}>
              {createError && <Alert msg={createError} type="error" />}
              <div className="form-group">
                <label className="form-label">Property Name</label>
                <input className="form-input" name="name" value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Address</label>
                <input className="form-input" name="address" value={createForm.address} onChange={e => setCreateForm({ ...createForm, address: e.target.value })} required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Property Type</label>
                  <select className="form-select" value={createForm.propertyType} onChange={e => setCreateForm({ ...createForm, propertyType: e.target.value })}>
                    {Object.entries(TYPE_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Manager</label>
                  <input className="form-input" name="managerName" value={createForm.managerName} onChange={e => setCreateForm({ ...createForm, managerName: e.target.value })} />
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-teal"><FaPlus /> Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editTarget && (
        <div className="modal" onClick={() => setEditTarget(null)}>
          <div className="edit-modal" onClick={e => e.stopPropagation()}>
            <div className="edit-modal-header">
              <span><FaEdit /> Edit Property — {editTarget.name}</span>
              <button className="modal-close-btn" onClick={() => setEditTarget(null)}><FaTimes /></button>
            </div>
            <form onSubmit={handleEdit}>
              {editError && <Alert msg={editError} type="error" />}
              <div className="form-group">
                <label className="form-label">Property Name</label>
                <input className="form-input" name="name" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Address</label>
                <input className="form-input" name="address" value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })} required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Property Type</label>
                  <select className="form-select" value={editForm.propertyType} onChange={e => setEditForm({ ...editForm, propertyType: e.target.value })}>
                    {Object.entries(TYPE_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Manager</label>
                  <input className="form-input" name="managerName" value={editForm.managerName} onChange={e => setEditForm({ ...editForm, managerName: e.target.value })} />
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setEditTarget(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary"><FaCheck /> Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmAction && (
        <div className="modal" onClick={() => setConfirmAction(null)}>
          <div className="edit-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="edit-modal-header">
              <span><FaExclamationTriangle /> Confirm Action</span>
              <button className="modal-close-btn" onClick={() => setConfirmAction(null)}><FaTimes /></button>
            </div>
            <div style={{ padding: 20 }}>
              <p style={{ marginBottom: 16, lineHeight: 1.6, color: 'var(--text)' }}>{confirmAction.message}</p>
              {confirmAction.type === 'deactivate_blocked' && (
                <div className="alert alert-error" style={{ marginBottom: 16 }}>
                  <FaExclamationTriangle /> Action blocked — occupied units must be vacated first (ON DELETE RESTRICT).
                </div>
              )}
              {confirmAction.type === 'delete_blocked' && (
                <div className="alert alert-error" style={{ marginBottom: 16 }}>
                  <FaExclamationTriangle /> Action blocked — existing units reference this property (ON DELETE RESTRICT).
                </div>
              )}
              <div className="form-actions">
                <button className="btn btn-secondary" onClick={() => setConfirmAction(null)}>Cancel</button>
                {confirmAction.type !== 'deactivate_blocked' && confirmAction.type !== 'delete_blocked' && (
                  <button className={confirmAction.type === 'delete' ? 'btn btn-danger' : 'btn btn-primary'} onClick={executeConfirm}>
                    Confirm
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Properties;

import React, { useState } from 'react';
import { FaBuilding, FaPlus, FaEdit, FaTrash, FaToggleOn, FaToggleOff, FaExclamationTriangle, FaSearch, FaTimes, FaCheck, FaBan, FaHome, FaStore, FaEye, FaCircle, FaExclamationCircle } from 'react-icons/fa';
import { getProperties, addProperty, updateProperty, updatePropertyStatus, deleteProperty, getUnits } from '../../data/store';
import { getSession } from '../../data/authStore';
import Alert from '../../components/common/Alert';

const TYPE_CONFIG = {
  RESIDENTIAL: { label: 'Residential', icon: FaHome },
  COMMERCIAL:  { label: 'Commercial',  icon: FaStore },
  MIXED:       { label: 'Mixed',       icon: FaBuilding },
};

const TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  ...Object.entries(TYPE_CONFIG).map(([v, c]) => ({ value: v, label: c.label })),
];

const EMPTY_FORM = { name: '', address: '', propertyType: 'RESIDENTIAL', managerName: '' };

const Properties = () => {
  const session = getSession();
  const pmName = session ? `${session.name} ${session.surname}` : '';
  const [allProperties] = useState(getProperties);
  const [units] = useState(getUnits);
  const [properties, setProperties] = useState(() => allProperties.filter(p => p.managerName === pmName));
  const [alert, setAlert] = useState({ msg: '', type: '' });
  const [typeFilter, setTypeFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_FORM);
  const [createError, setCreateError] = useState('');
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [editError, setEditError] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);
  const [expandedRows, setExpandedRows] = useState({});

  const refresh = () => {
    const all = getProperties();
    setProperties(all.filter(p => p.managerName === pmName));
  };

  const showAlert = (msg, type) => { setAlert({ msg, type }); setTimeout(() => setAlert({ msg: '', type: '' }), 5000); };
  const unitCount = (pid) => units.filter(u => u.propertyId === pid).length;
  const occupiedCount = (pid) => units.filter(u => u.propertyId === pid && u.status === 'OCCUPIED').length;
  const vacantCount = (pid) => units.filter(u => u.propertyId === pid && u.status === 'VACANT').length;

  const filtered = typeFilter ? properties.filter(p => p.propertyType === typeFilter) : properties;
  const stats = [
    { label: 'My Properties', value: properties.length, icon: FaBuilding },
    { label: 'Residential', value: properties.filter(p => p.propertyType === 'RESIDENTIAL').length, icon: FaHome },
    { label: 'Commercial', value: properties.filter(p => p.propertyType === 'COMMERCIAL').length, icon: FaStore },
    { label: 'Mixed', value: properties.filter(p => p.propertyType === 'MIXED').length, icon: FaBuilding },
    { label: 'Active', value: properties.filter(p => p.status === 'ACTIVE').length, icon: FaCheck },
    { label: 'Inactive', value: properties.filter(p => p.status === 'INACTIVE').length, icon: FaBan },
  ];

  const openCreate = () => { setCreateForm({ ...EMPTY_FORM, managerName: pmName }); setCreateError(''); setShowCreate(true); };
  const handleCreate = (e) => {
    e.preventDefault();
    if (!createForm.name.trim() || !createForm.address.trim()) { setCreateError('Name and address are required.'); return; }
    const r = addProperty(createForm.name, createForm.address, createForm.propertyType, createForm.managerName);
    if (r.success) { showAlert(`"${r.data.name}" created.`, 'success'); setShowCreate(false); refresh(); }
    else { setCreateError(r.error); }
  };

  const openEdit = (p) => { setEditTarget(p); setEditForm({ name: p.name || '', address: p.address || '', propertyType: p.propertyType || 'RESIDENTIAL', managerName: p.managerName || '' }); setEditError(''); };
  const handleEdit = (e) => {
    e.preventDefault();
    if (!editForm.name.trim() || !editForm.address.trim()) { setEditError('Name and address are required.'); return; }
    const r = updateProperty(editTarget.propertyId, editForm);
    if (r.success) { showAlert('Property updated.', 'success'); setEditTarget(null); refresh(); }
    else { setEditError(r.error); }
  };

  const promptDeactivate = (p) => {
    const occ = occupiedCount(p.propertyId);
    if (occ > 0) { setConfirmAction({ type: 'deactivate_blocked', property: p, message: `Cannot deactivate "${p.name}" — ${occ} unit(s) occupied.` }); return; }
    setConfirmAction({ type: 'deactivate', property: p, message: `Deactivate "${p.name}"?` });
  };
  const promptReactivate = (p) => { setConfirmAction({ type: 'reactivate', property: p, message: `Reactivate "${p.name}"?` }); };
  const promptDelete = (p) => {
    const uc = unitCount(p.propertyId);
    if (uc > 0) { setConfirmAction({ type: 'delete_blocked', property: p, message: `Cannot delete "${p.name}" — ${uc} unit(s) exist.` }); return; }
    setConfirmAction({ type: 'delete', property: p, message: `Permanently delete "${p.name}"?` });
  };
  const executeConfirm = () => {
    const a = confirmAction; if (!a) return;
    if (a.type === 'deactivate') { updatePropertyStatus(a.property.propertyId, 'INACTIVE'); showAlert(`"${a.property.name}" deactivated.`, 'success'); refresh(); }
    else if (a.type === 'reactivate') { updatePropertyStatus(a.property.propertyId, 'ACTIVE'); showAlert(`"${a.property.name}" reactivated.`, 'success'); refresh(); }
    else if (a.type === 'delete') { deleteProperty(a.property.propertyId); showAlert(`"${a.property.name}" deleted.`, 'success'); refresh(); }
    setConfirmAction(null);
  };

  return (
    <div>
      <div className="card">
        <div className="card-title">
          <span><FaBuilding /> My Properties <span className="req-ref">MOD-002 / REQ-009</span></span>
          <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-dim)' }}>Manager: {pmName}</span>
          <button className="btn btn-teal" onClick={openCreate}><FaPlus /> Add Property</button>
        </div>
        <Alert msg={alert.msg} type={alert.type} />
        <div className="stat-grid">{stats.map((s, i) => (<div className="stat-card" key={i}><div className="stat-value"><s.icon /> {s.value}</div><div className="stat-label">{s.label}</div></div>))}</div>
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
            <thead><tr><th>ID</th><th>Name</th><th>Address</th><th>Type</th><th>Units</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan="7" className="empty-text" style={{ textAlign: 'center', padding: 24 }}>No properties found.</td></tr>
              ) : (
                filtered.map(p => {
                  const uc = unitCount(p.propertyId);
                  const occ = occupiedCount(p.propertyId);
                  const canDelete = uc === 0;
                  const isExpanded = expandedRows[p.propertyId];
                  return (
                    <React.Fragment key={p.propertyId}>
                      <tr>
                        <td className="cell-mono">{p.propertyId}</td>
                        <td>{p.name}</td>
                        <td className="cell-mono" style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.address}>{p.address}</td>
                        <td>{TYPE_CONFIG[p.propertyType]?.label || p.propertyType}</td>
                        <td className="cell-mono">
                          <FaCircle style={{ color: occ === 0 ? 'var(--text-dim)' : occ === uc ? 'var(--teal)' : 'var(--amber)', fontSize: 8, marginRight: 4 }} />
                          {uc} ({occ} occ.)
                        </td>
                        <td><span className={p.status === 'ACTIVE' ? 'badge badge-completed' : 'badge badge-danger'}>{p.status}</span></td>
                        <td>
                          <div className="action-cell">
                            <button className="btn btn-secondary btn-sm" onClick={() => setExpandedRows(p => ({ ...p, [p.propertyId]: !p[p.propertyId] }))}><FaEye /></button>
                            <button className="btn btn-secondary btn-sm" onClick={() => openEdit(p)}><FaEdit /></button>
                            {p.status === 'ACTIVE' ? <button className="btn btn-danger btn-sm" onClick={() => promptDeactivate(p)}><FaToggleOff /></button> : <button className="btn btn-teal btn-sm" onClick={() => promptReactivate(p)}><FaToggleOn /></button>}
                            {canDelete ? <button className="btn btn-danger btn-sm" onClick={() => promptDelete(p)}><FaTrash /></button> : <button className="btn btn-danger btn-sm" style={{ opacity: 0.35 }} disabled><FaTrash /></button>}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="expanded-row"><td colSpan="7" style={{ padding: '8px 16px', backgroundColor: 'var(--surface)' }}>
                          <div style={{ display: 'flex', gap: 24, fontSize: 12, flexWrap: 'wrap' }}>
                            <div><strong>ID:</strong> {p.propertyId}</div>
                            <div><strong>Name:</strong> {p.name}</div>
                            <div><strong>Address:</strong> {p.address}</div>
                            <div><strong>Type:</strong> {TYPE_CONFIG[p.propertyType]?.label || p.propertyType}</div>
                            <div><strong>Status:</strong> {p.status}</div>
                            <div><strong>Units:</strong> {uc} ({occ} occupied, {vacantCount(p.propertyId)} vacant)</div>
                          </div>
                        </td></tr>
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
            <div className="edit-modal-header"><span><FaPlus /> Add Property</span><button className="modal-close-btn" onClick={() => setShowCreate(false)}><FaTimes /></button></div>
            <form onSubmit={handleCreate}>
              {createError && <Alert msg={createError} type="error" />}
              <div className="form-group"><label className="form-label">Name</label><input className="form-input" value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })} required /></div>
              <div className="form-group"><label className="form-label">Address</label><input className="form-input" value={createForm.address} onChange={e => setCreateForm({ ...createForm, address: e.target.value })} required /></div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Type</label><select className="form-select" value={createForm.propertyType} onChange={e => setCreateForm({ ...createForm, propertyType: e.target.value })}>{Object.entries(TYPE_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}</select></div>
                <div className="form-group"><label className="form-label">Manager</label><input className="form-input" value={createForm.managerName} disabled /></div>
              </div>
              <div className="form-actions"><button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button><button type="submit" className="btn btn-teal"><FaPlus /> Create</button></div>
            </form>
          </div>
        </div>
      )}

      {editTarget && (
        <div className="modal" onClick={() => setEditTarget(null)}>
          <div className="edit-modal" onClick={e => e.stopPropagation()}>
            <div className="edit-modal-header"><span><FaEdit /> Edit {editTarget.name}</span><button className="modal-close-btn" onClick={() => setEditTarget(null)}><FaTimes /></button></div>
            <form onSubmit={handleEdit}>
              {editError && <Alert msg={editError} type="error" />}
              <div className="form-group"><label className="form-label">Name</label><input className="form-input" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} required /></div>
              <div className="form-group"><label className="form-label">Address</label><input className="form-input" value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })} required /></div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Type</label><select className="form-select" value={editForm.propertyType} onChange={e => setEditForm({ ...editForm, propertyType: e.target.value })}>{Object.entries(TYPE_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}</select></div>
              </div>
              <div className="form-actions"><button type="button" className="btn btn-secondary" onClick={() => setEditTarget(null)}>Cancel</button><button type="submit" className="btn btn-primary"><FaCheck /> Save</button></div>
            </form>
          </div>
        </div>
      )}

      {confirmAction && (
        <div className="modal" onClick={() => setConfirmAction(null)}>
          <div className="edit-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="edit-modal-header"><span><FaExclamationTriangle /> Confirm</span><button className="modal-close-btn" onClick={() => setConfirmAction(null)}><FaTimes /></button></div>
            <div style={{ padding: 20 }}>
              <p style={{ marginBottom: 16 }}>{confirmAction.message}</p>
              <div className="form-actions">
                <button className="btn btn-secondary" onClick={() => setConfirmAction(null)}>Cancel</button>
                {!confirmAction.type.includes('blocked') && <button className={confirmAction.type === 'delete' ? 'btn btn-danger' : 'btn btn-primary'} onClick={executeConfirm}>Confirm</button>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Properties;

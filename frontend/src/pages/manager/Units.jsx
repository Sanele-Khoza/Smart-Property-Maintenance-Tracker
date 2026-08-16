import React, { useState } from 'react';
import { FaDoorOpen, FaPlus, FaEdit, FaTrash, FaUserCheck, FaUserSlash, FaSearch, FaTimes, FaCheck, FaBuilding, FaExclamationTriangle, FaTicketAlt, FaSortAmountUp, FaSortAmountDown } from 'react-icons/fa';
import { getUnits, addUnit, assignTenantToUnit, vacateUnit, updateUnit, deleteUnit, getProperties, getTickets } from '../../data/store';
import { getSession } from '../../data/authStore';
import Alert from '../../components/common/Alert';

const Units = () => {
  const session = getSession();
  const pmName = session ? `${session.name} ${session.surname}` : '';
  const [allUnits] = useState(getUnits);
  const [allProperties] = useState(getProperties);
  const [allTickets] = useState(getTickets());
  const [properties] = useState(() => allProperties.filter(p => p.managerName === pmName));
  const [units, setUnits] = useState(() => allUnits.filter(u => properties.some(p => p.propertyId === u.propertyId)));
  const propIds = new Set(properties.map(p => p.propertyId));
  const [alert, setAlert] = useState({ msg: '', type: '' });
  const [propertyFilter, setPropertyFilter] = useState('');
  const [floorFilter, setFloorFilter] = useState('');
  const [sortByFloor, setSortByFloor] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ propertyId: '', unitNumber: '', floor: '' });
  const [createError, setCreateError] = useState('');
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({ unitNumber: '', floor: '' });
  const [editError, setEditError] = useState('');
  const [assignTarget, setAssignTarget] = useState(null);
  const [assignName, setAssignName] = useState('');
  const [assignError, setAssignError] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);

  const ticketCountByUnit = {};
  allTickets.forEach(t => { ticketCountByUnit[t.unitId] = (ticketCountByUnit[t.unitId] || 0) + 1; });

  const refresh = () => {
    const all = getUnits();
    setUnits(all.filter(u => properties.some(p => p.propertyId === u.propertyId)));
  };
  const showAlert = (msg, type) => { setAlert({ msg, type }); setTimeout(() => setAlert({ msg: '', type: '' }), 5000); };

  const floors = [...new Set(units.filter(u => u.floor != null).map(u => u.floor))].sort((a, b) => a - b);
  let filtered = propertyFilter ? units.filter(u => u.propertyId === propertyFilter) : units;
  if (floorFilter !== '') filtered = filtered.filter(u => u.floor?.toString() === floorFilter);
  if (sortByFloor) filtered = [...filtered].sort((a, b) => { const fa = a.floor ?? -1; const fb = b.floor ?? -1; return sortByFloor === 'asc' ? fa - fb : fb - fa; });

  const statValues = [
    { label: 'Total Units', value: units.length, icon: FaDoorOpen },
    { label: 'Occupied', value: units.filter(u => u.status === 'OCCUPIED').length, icon: FaUserCheck },
    { label: 'Vacant', value: units.filter(u => u.status === 'VACANT').length, icon: FaUserSlash },
    { label: 'Properties', value: properties.length, icon: FaBuilding },
  ];

  const openCreate = () => { setCreateForm({ propertyId: properties[0]?.propertyId || '', unitNumber: '', floor: '' }); setCreateError(''); setShowCreate(true); };
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!createForm.propertyId || !createForm.unitNumber.trim()) { setCreateError('Property and unit number required.'); return; }
    const r = await addUnit(createForm.propertyId, createForm.unitNumber, createForm.floor || null);
    if (r.success) { showAlert(`Unit ${r.data.unitNumber} created.`, 'success'); setShowCreate(false); refresh(); } else setCreateError(r.error);
  };
  const openEdit = (u) => { setEditTarget(u); setEditForm({ unitNumber: u.unitNumber || '', floor: u.floor?.toString() || '' }); setEditError(''); };
  const handleEdit = async (e) => {
    e.preventDefault();
    if (!editForm.unitNumber.trim()) { setEditError('Unit number required.'); return; }
    const r = await updateUnit(editTarget.unitId, editForm);
    if (r.success) { showAlert('Unit updated.', 'success'); setEditTarget(null); refresh(); } else setEditError(r.error);
  };
  const openAssign = (u) => { setAssignTarget(u); setAssignName(''); setAssignError(''); };
  const handleAssign = async (e) => {
    e.preventDefault();
    if (!assignName.trim()) { setAssignError('Tenant name required.'); return; }
    const r = await assignTenantToUnit(assignTarget.unitId, assignName.trim());
    if (r.success) { showAlert(`${assignName.trim()} assigned.`, 'success'); setAssignTarget(null); refresh(); } else setAssignError(r.error + (r.statusCode === 409 ? ' (409 Conflict)' : ''));
  };
  const promptVacate = (u) => { setConfirmAction({ type: 'vacate', unit: u, message: `Vacate ${u.unitNumber}? ${u.tenantName} will be removed.` }); };
  const promptDeleteUnit = (u) => {
    const tc = ticketCountByUnit[u.unitId] || 0;
    setConfirmAction({ type: 'delete_unit', unit: u, message: `Delete ${u.unitNumber}?${tc > 0 ? ` ${tc} ticket(s) will also be removed.` : ''}` });
  };
  const executeConfirm = async () => {
    const a = confirmAction; if (!a) return;
    if (a.type === 'vacate') { await vacateUnit(a.unit.unitId); showAlert(`Unit ${a.unit.unitNumber} vacated.`, 'success'); refresh(); }
    else if (a.type === 'delete_unit') { const r = await deleteUnit(a.unit.unitId); if (r.success) { showAlert(`Unit ${a.unit.unitNumber} deleted.`, 'success'); } else { showAlert(r.error, 'error'); } refresh(); }
    setConfirmAction(null);
  };

  return (
    <div>
      <div className="card">
        <div className="card-title"><span><FaDoorOpen /> My Units <span className="req-ref">REQ-010–011</span></span><button className="btn btn-teal" onClick={openCreate}><FaPlus /> Add Unit</button></div>
        <Alert msg={alert.msg} type={alert.type} />
        <div className="stat-grid">{statValues.map((s, i) => (<div className="stat-card" key={i}><div className="stat-value"><s.icon /> {s.value}</div><div className="stat-label">{s.label}</div></div>))}</div>
      </div>
      <div className="card">
        <div className="card-title">
          <span><FaDoorOpen /> All Units</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <FaSearch style={{ color: 'var(--text-dim)' }} />
            <select className="form-select" style={{ width: 'auto', minWidth: 160 }} value={propertyFilter} onChange={e => setPropertyFilter(e.target.value)}>
              <option value="">All Properties</option>
              {properties.map(p => <option key={p.propertyId} value={p.propertyId}>{p.name}</option>)}
            </select>
            <select className="form-select" style={{ width: 'auto', minWidth: 100 }} value={floorFilter} onChange={e => setFloorFilter(e.target.value)}>
              <option value="">All Floors</option>
              {floors.map(f => <option key={f} value={f.toString()}>Floor {f}</option>)}
            </select>
            <button className="btn btn-secondary btn-sm" onClick={() => setSortByFloor(sortByFloor === 'asc' ? 'desc' : 'asc')} style={sortByFloor ? { borderColor: 'var(--teal)', color: 'var(--teal)' } : {}}>
              {sortByFloor === 'asc' ? <FaSortAmountUp /> : sortByFloor === 'desc' ? <FaSortAmountDown /> : <FaSortAmountUp />}
            </button>
            {sortByFloor && <button className="btn btn-secondary btn-sm" onClick={() => setSortByFloor(null)}><FaTimes /></button>}
          </div>
        </div>
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead><tr><th>Unit #</th><th>Floor</th><th>Property</th><th>Status</th><th>Tenant</th><th>Tickets</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.length === 0 ? <tr><td colSpan="7" className="empty-text" style={{ textAlign: 'center', padding: 24 }}>No units found.</td></tr> : (
                filtered.map(u => {
                  const tc = ticketCountByUnit[u.unitId] || 0;
                  const isOccupied = u.status === 'OCCUPIED';
                  return (
                    <tr key={u.unitId}>
                      <td className="cell-mono">{u.unitNumber}</td>
                      <td>{u.floor != null ? `Floor ${u.floor}` : '—'}</td>
                      <td><FaBuilding style={{ marginRight: 4, fontSize: 10, color: 'var(--text-dim)' }} />{u.propertyName}</td>
                      <td><span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, backgroundColor: isOccupied ? 'rgba(45,183,145,0.15)' : 'rgba(160,160,160,0.15)', color: isOccupied ? 'var(--teal)' : 'var(--text-dim)' }}>{isOccupied ? 'Occupied' : 'Vacant'}</span></td>
                      <td>{u.tenantName || <span style={{ color: 'var(--text-dim)' }}>—</span>}</td>
                      <td>{tc > 0 ? <span style={{ color: tc >= 3 ? 'var(--amber)' : 'var(--text-dim)', fontWeight: tc >= 3 ? 700 : 400 }}><FaTicketAlt style={{ fontSize: 10, marginRight: 3 }} />{tc}</span> : <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>—</span>}</td>
                      <td>
                        <div className="action-cell">
                          <button className="btn btn-secondary btn-sm" onClick={() => openEdit(u)}><FaEdit /></button>
                          {isOccupied ? <button className="btn btn-danger btn-sm" onClick={() => promptVacate(u)}><FaUserSlash /></button> : <button className="btn btn-teal btn-sm" onClick={() => openAssign(u)}><FaUserCheck /></button>}
                          {isOccupied ? <button className="btn btn-danger btn-sm" style={{ opacity: 0.35 }} disabled><FaTrash /></button> : <button className="btn btn-danger btn-sm" onClick={() => promptDeleteUnit(u)}><FaTrash /></button>}
                        </div>
                      </td>
                    </tr>
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
            <div className="edit-modal-header"><span><FaPlus /> Add Unit</span><button className="modal-close-btn" onClick={() => setShowCreate(false)}><FaTimes /></button></div>
            <form onSubmit={handleCreate}>
              {createError && <Alert msg={createError} type="error" />}
              <div className="form-group"><label>Property</label><select className="form-select" value={createForm.propertyId} onChange={e => setCreateForm({ ...createForm, propertyId: e.target.value })} required>{properties.map(p => <option key={p.propertyId} value={p.propertyId}>{p.name}</option>)}</select></div>
              <div className="form-row"><div className="form-group"><label>Unit Number</label><input className="form-input" value={createForm.unitNumber} onChange={e => setCreateForm({ ...createForm, unitNumber: e.target.value })} required /></div><div className="form-group"><label>Floor</label><input className="form-input" type="number" min="0" value={createForm.floor} onChange={e => setCreateForm({ ...createForm, floor: e.target.value })} /></div></div>
              <div className="form-actions"><button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button><button type="submit" className="btn btn-teal"><FaPlus /> Create</button></div>
            </form>
          </div>
        </div>
      )}

      {editTarget && (
        <div className="modal" onClick={() => setEditTarget(null)}>
          <div className="edit-modal" onClick={e => e.stopPropagation()}>
            <div className="edit-modal-header"><span><FaEdit /> Edit {editTarget.unitNumber}</span><button className="modal-close-btn" onClick={() => setEditTarget(null)}><FaTimes /></button></div>
            <form onSubmit={handleEdit}>{editError && <Alert msg={editError} type="error" />}
              <div className="form-row"><div className="form-group"><label>Unit Number</label><input className="form-input" value={editForm.unitNumber} onChange={e => setEditForm({ ...editForm, unitNumber: e.target.value })} required /></div><div className="form-group"><label>Floor</label><input className="form-input" type="number" min="0" value={editForm.floor} onChange={e => setEditForm({ ...editForm, floor: e.target.value })} /></div></div>
              <div className="form-actions"><button type="button" className="btn btn-secondary" onClick={() => setEditTarget(null)}>Cancel</button><button type="submit" className="btn btn-primary"><FaCheck /> Save</button></div>
            </form>
          </div>
        </div>
      )}

      {assignTarget && (
        <div className="modal" onClick={() => setAssignTarget(null)}>
          <div className="edit-modal" onClick={e => e.stopPropagation()}>
            <div className="edit-modal-header"><span><FaUserCheck /> Assign Tenant — Unit {assignTarget.unitNumber}</span><button className="modal-close-btn" onClick={() => setAssignTarget(null)}><FaTimes /></button></div>
            <form onSubmit={handleAssign}>
              {assignError && <Alert msg={assignError} type="error" />}
              <p style={{ color: 'var(--text-dim)', fontSize: 12, marginBottom: 12 }}>{assignTarget.propertyName} | Floor {assignTarget.floor != null ? assignTarget.floor : '—'}</p>
              <div className="form-group"><label>Tenant Name</label><input className="form-input" value={assignName} onChange={e => setAssignName(e.target.value)} required placeholder="Full name" autoFocus /></div>
              <p style={{ color: 'var(--amber)', fontSize: 11, marginTop: 8 }}><FaExclamationTriangle style={{ marginRight: 4 }} />BR-001: One tenant per unit enforced.</p>
              <div className="form-actions"><button type="button" className="btn btn-secondary" onClick={() => setAssignTarget(null)}>Cancel</button><button type="submit" className="btn btn-teal"><FaUserCheck /> Assign</button></div>
            </form>
          </div>
        </div>
      )}

      {confirmAction && (
        <div className="modal" onClick={() => setConfirmAction(null)}>
          <div className="edit-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="edit-modal-header"><span><FaExclamationTriangle /> Confirm</span><button className="modal-close-btn" onClick={() => setConfirmAction(null)}><FaTimes /></button></div>
            <div style={{ padding: 20 }}><p>{confirmAction.message}</p><div className="form-actions"><button className="btn btn-secondary" onClick={() => setConfirmAction(null)}>Cancel</button><button className={confirmAction.type === 'delete_unit' ? 'btn btn-danger' : 'btn btn-primary'} onClick={executeConfirm}>Confirm</button></div></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Units;
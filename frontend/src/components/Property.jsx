import React, { useState, useMemo, useEffect } from 'react';
import { FaBuilding, FaBox } from 'react-icons/fa';
import Alert from './common/Alert';
import EmptyState from './common/EmptyState';
import { addProperty, addUnit, getProperties, getUnits, assignTenantToUnit } from '../data/store';
import { getUsers, refreshUsers } from '../data/authStore';

const Property = ({ refreshData, pmName }) => {
  const [allProperties, setAllProperties] = useState(getProperties());
  const [allUnits, setAllUnits] = useState(getUnits());
  const [allUsers, setAllUsers] = useState(() => getUsers());
  const properties = useMemo(() => pmName ? allProperties.filter(p => p.managerName === pmName) : allProperties, [allProperties, pmName]);
  const propIds = useMemo(() => new Set(properties.map(p => p.propertyId)), [properties]);
  const units = useMemo(() => pmName ? allUnits.filter(u => propIds.has(u.propertyId)) : allUnits, [allUnits, propIds, pmName]);

  useEffect(() => {
    let cancelled = false;
    refreshUsers().then(() => { if (!cancelled) setAllUsers(getUsers()); });
    const onUsersUpdated = () => { if (!cancelled) setAllUsers(getUsers()); };
    window.addEventListener('spmt:users-updated', onUsersUpdated);
    return () => { cancelled = true; window.removeEventListener('spmt:users-updated', onUsersUpdated); };
  }, []);

  // Tenants with a real account but no unit assigned anywhere in the system —
  // the pool a PM can pick from when assigning a vacant unit.
  const orphanedTenants = useMemo(() => {
    const occupiedNames = new Set(
      allUnits.filter(u => u.status === 'OCCUPIED' && u.tenantName).map(u => u.tenantName)
    );
    return allUsers
      .filter(u => u.role === 'TENANT')
      .map(u => ({ id: u.id, name: `${u.name} ${u.surname}` }))
      .filter(t => !occupiedNames.has(t.name));
  }, [allUsers, allUnits]);

  // Form state objects: Controlled component state for user input
  // Implements two-way data binding pattern with onChange handlers
  const [propForm, setPropForm] = useState({ name: '', address: '', propertyType: 'RESIDENTIAL', managerName: pmName || '' });
  const [unitForm, setUnitForm] = useState({ propertyId: '', unitNumber: '', floor: '' });
  const [tenantAssign, setTenantAssign] = useState({ unitId: '', tenantName: '' });
  const [useManualEntry, setUseManualEntry] = useState(false);

  // Message/feedback state: Implements user feedback mechanism via Alert component
  // Each operation has dedicated message state for displaying success/error feedback
  const [propMsg, setPropMsg] = useState({ text: '', type: '' });
  const [unitMsg, setUnitMsg] = useState({ text: '', type: '' });
  const [assignMsg, setAssignMsg] = useState({ text: '', type: '' });

  /**
   * Input sanitization function: Filter hazardous characters from user input
   * Implements whitelist approach: allows only alphanumeric, spaces, hyphens, underscores
   * Uses regex substitution to remove disallowed characters before form submission
   */
  const sanitizeText = (value) => value.replace(/[^A-Za-z0-9 _-]/g, '');

  /**
   * Refresh handler: Trigger data synchronization from store
   * Fetches fresh state from data layer and notifies parent component
   * Implements callback function pattern for parent re-render coordination
   */
  const refresh = () => {
    setAllProperties(getProperties());
    setAllUnits(getUnits());
    if (refreshData) refreshData();
  };

  /**
   * Event handler: Submit property creation form
   * Invokes business logic layer (addProperty mutation)
   * Handles Result type (success/error) with pattern matching
   * On success: Clear form, show feedback, sync state. On error: Display error message.
   */
  const handleAddProperty = async () => {
    const result = await addProperty(propForm.name, propForm.address, propForm.propertyType, propForm.managerName || pmName || '');
    if (result.error) {
      setPropMsg({ text: result.error, type: 'error' });
    } else {
      setPropMsg({ text: `Property "${result.data.name}" added!`, type: 'success' });
      setPropForm({ name: '', address: '', propertyType: 'RESIDENTIAL', managerName: pmName || '' });
      refresh();
    }
  };

  /**
   * Event handler: Submit unit creation form
   * Orchestrates: Validate -> Create -> Display feedback -> Clear -> Refresh
   * Implements atomic transaction pattern: all-or-nothing operation
   */
  const handleAddUnit = async () => {
    const result = await addUnit(unitForm.propertyId, unitForm.unitNumber, unitForm.floor);
    if (result.error) {
      setUnitMsg({ text: result.error, type: 'error' });
    } else {
      setUnitMsg({ text: `Unit ${result.data.unitNumber} added!`, type: 'success' });
      setUnitForm({ propertyId: '', unitNumber: '', floor: '' });
      refresh();
    }
  };

  /**
   * Event handler: Submit tenant assignment form
   * Updates unit occupancy state through data layer mutation
   * Implements cascading state update: form → store → local state
   */
  const handleAssignTenant = async () => {
    const result = await assignTenantToUnit(tenantAssign.unitId, tenantAssign.tenantName);
    if (result.error) {
      setAssignMsg({ text: result.error, type: 'error' });
    } else {
      setAssignMsg({ text: `Tenant assigned successfully!`, type: 'success' });
      setTenantAssign({ unitId: '', tenantName: '' });
      setUseManualEntry(false);
      refresh();
    }
  };

  return (
    <div className="main-cols">
      <div>
        <div className="card">
          <div className="card-title">Add Property <span className="req-ref">REQ-009</span></div>
          <Alert msg={propMsg.text} type={propMsg.type} />
          <div className="form-group">
            <label className="form-label">Property Name</label>
            <input className="form-input" placeholder="e.g. Sandton Heights" value={propForm.name}
              onChange={e => setPropForm(f => ({ ...f, name: sanitizeText(e.target.value) }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Address</label>
            <input className="form-input" placeholder="Full address" value={propForm.address}
              onChange={e => setPropForm(f => ({ ...f, address: sanitizeText(e.target.value) }))} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Type</label>
              <select className="form-select" value={propForm.propertyType}
                onChange={e => setPropForm(f => ({ ...f, propertyType: e.target.value }))}>
                <option value="RESIDENTIAL">Residential</option>
                <option value="COMMERCIAL">Commercial</option>
                <option value="MIXED">Mixed Use</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Manager Name</label>
              <input className="form-input" placeholder="Manager name" value={propForm.managerName}
                onChange={e => setPropForm(f => ({ ...f, managerName: sanitizeText(e.target.value) }))} />
            </div>
          </div>
          <button className="btn btn-primary" onClick={handleAddProperty}>＋ Register Property</button>
        </div>

        <div className="card">
          <div className="card-title">Add Unit <span className="req-ref">REQ-010</span></div>
          <Alert msg={unitMsg.text} type={unitMsg.type} />
          <div className="form-group">
            <label className="form-label">Select Property</label>
            <select className="form-select" value={unitForm.propertyId}
              onChange={e => setUnitForm(f => ({ ...f, propertyId: e.target.value }))}>
              <option value="">— Select property —</option>
              {properties.map(p => <option key={p.propertyId} value={p.propertyId}>{p.name}</option>)}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Unit Number</label>
              <input className="form-input" placeholder="e.g. 101" value={unitForm.unitNumber}
                onChange={e => setUnitForm(f => ({ ...f, unitNumber: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Floor</label>
              <input className="form-input" placeholder="Floor number" value={unitForm.floor}
                onChange={e => setUnitForm(f => ({ ...f, floor: e.target.value }))} />
            </div>
          </div>
          <button className="btn btn-secondary" onClick={handleAddUnit} disabled={properties.length === 0}>＋ Add Unit</button>
        </div>

        <div className="card">
          <div className="card-title">Assign Tenant to Unit</div>
          <Alert msg={assignMsg.text} type={assignMsg.type} />
          <div className="form-group">
            <label className="form-label">Select Unit</label>
            <select className="form-select" value={tenantAssign.unitId}
              onChange={e => setTenantAssign(f => ({ ...f, unitId: e.target.value }))}>
              <option value="">— Select unit —</option>
              {units.filter(u => u.status === 'VACANT').map(u => (
                <option key={u.unitId} value={u.unitId}>{u.propertyName} - Unit {u.unitNumber}</option>
              ))}
            </select>
          </div>

          {!useManualEntry ? (
            <div className="form-group">
              <label className="form-label">Tenant</label>
              {orphanedTenants.length === 0 ? (
                <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '4px 0' }}>
                  No unassigned tenants found in the system.
                </p>
              ) : (
                <select className="form-select" value={tenantAssign.tenantName}
                  onChange={e => setTenantAssign(f => ({ ...f, tenantName: e.target.value }))}>
                  <option value="">— Select tenant —</option>
                  {orphanedTenants.map(t => (
                    <option key={t.id} value={t.name}>{t.name}</option>
                  ))}
                </select>
              )}
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ marginTop: 8, fontSize: 10 }}
                onClick={() => { setUseManualEntry(true); setTenantAssign(f => ({ ...f, tenantName: '' })); }}
              >
                Tenant not listed? Enter name manually
              </button>
            </div>
          ) : (
            <div className="form-group">
              <label className="form-label">Tenant Name</label>
              <input className="form-input" placeholder="Tenant full name" value={tenantAssign.tenantName}
                onChange={e => setTenantAssign(f => ({ ...f, tenantName: e.target.value }))} />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ marginTop: 8, fontSize: 10 }}
                onClick={() => { setUseManualEntry(false); setTenantAssign(f => ({ ...f, tenantName: '' })); }}
              >
                ← Choose from list instead
              </button>
            </div>
          )}

          <button className="btn btn-teal" onClick={handleAssignTenant} disabled={!tenantAssign.unitId || !tenantAssign.tenantName}>Assign Tenant</button>
        </div>
      </div>

      <div>
        <div className="card">
          <div className="card-title">Properties ({properties.length})</div>
          {properties.length === 0 ? <EmptyState icon={<FaBuilding />} text="No properties" /> : (
            <div className="scroll-list data-list">
              {properties.map(p => (
                <div className="data-item" key={p.propertyId}>
                  <div>
                    <div className="data-item-name">{p.name}</div>
                    <div className="data-item-meta">{p.address}</div>
                  </div>
                  <div>
                    <div className="data-item-meta">Manager: {p.managerName}</div>
                    <div className="data-item-meta">Units: {units.filter(u => u.propertyId === p.propertyId).length}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="divider" />
          <div className="section-title">All Units ({units.length})</div>
          {units.length === 0 ? <EmptyState icon={<FaBox />} text="No units" /> : (
            <div className="scroll-list data-list">
              {units.map(u => (
                <div className="data-item" key={u.unitId}>
                  <div>
                    <div className="data-item-name">Unit {u.unitNumber}</div>
                    <div className="data-item-meta">{u.propertyName} | Floor {u.floor || 'N/A'}</div>
                  </div>
                  <div>
                    <span className={`badge ${u.status === 'OCCUPIED' ? 'badge-assigned' : 'badge-open'}`}>
                      {u.status}
                    </span>
                    {u.tenantName && <div className="data-item-meta">{u.tenantName}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Property;
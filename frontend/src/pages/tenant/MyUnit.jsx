import React, { useState } from 'react';
import { FaDoorOpen, FaLayerGroup, FaCheckCircle, FaExclamationTriangle, FaBuilding } from 'react-icons/fa';
import { getSession } from '../../data/authStore';
import { getUnits } from '../../data/store';

const MyUnit = () => {
  const session = getSession();
  const currentUser = session ? `${session.name} ${session.surname}` : '';
  const [units] = useState(getUnits());

  const myUnits = units.filter(u => u.tenantName === currentUser && u.status === 'OCCUPIED');
  const primary = myUnits[0] || null;
  const hasMultiple = myUnits.length > 1;

  return (
    <>
      <div className="welcome-banner"><h2><FaDoorOpen /> My Unit</h2><p>View your residential unit details. <span className="req-ref">MOD-002 / REQ-011</span></p></div>
      {hasMultiple && (
        <div className="alert alert-warning" style={{ marginBottom: 12 }}>
          <FaExclamationTriangle /> BR-001 flag: You are assigned to {myUnits.length} units ({myUnits.map(u => u.unitNumber).join(', ')}). A tenant should occupy exactly one unit. Contact your property manager.
        </div>
      )}
      {!primary ? (
        <div className="card"><div className="empty-state"><div className="empty-text">No unit assigned to your account.</div></div></div>
      ) : (
        <div className="card">
          <div className="card-title">{primary.propertyName} — Unit {primary.unitNumber}</div>
          <table className="table">
            <tbody>
              <tr><td style={{ fontWeight: 600, width: 180 }}><FaDoorOpen /> Unit Number</td><td>{primary.unitNumber}</td></tr>
              <tr><td style={{ fontWeight: 600 }}><FaLayerGroup /> Floor</td><td>{primary.floor !== null && primary.floor !== undefined ? primary.floor : '—'}</td></tr>
              <tr><td style={{ fontWeight: 600 }}><FaBuilding /> Property</td><td>{primary.propertyName}</td></tr>
              <tr><td style={{ fontWeight: 600 }}>Status</td><td><span className="badge badge-completed"><FaCheckCircle /> {primary.status}</span></td></tr>
            </tbody>
          </table>
        </div>
      )}
      {hasMultiple && primary && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="card-title">All Assigned Units <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>({myUnits.length} total — potential data issue)</span></div>
          {myUnits.map(u => (
            <div key={u.unitId} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <strong>{u.propertyName}</strong> — Unit {u.unitNumber} (Floor {u.floor !== null ? u.floor : '—'})
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default MyUnit;
import React, { useState, useMemo } from 'react';
import { FaBuilding, FaMapMarkerAlt, FaTag, FaUserTie, FaEnvelope, FaPhone } from 'react-icons/fa';
import { getSession } from '../../data/authStore';
import { getProperties, getUnits } from '../../data/store';

const MyProperty = () => {
  const session = getSession();
  const currentUser = session ? `${session.name} ${session.surname}` : '';
  const [properties] = useState(getProperties());
  const [units] = useState(getUnits());

  const myUnit = units.find(u => u.tenantName === currentUser && u.status === 'OCCUPIED');
  const myProperty = useMemo(() => {
    if (!myUnit) return null;
    return properties.find(p => p.propertyId === myUnit.propertyId) || null;
  }, [myUnit, properties]);

  if (!myUnit || !myProperty) {
    return (
      <>
        <div className="welcome-banner"><h2><FaBuilding /> My Property</h2><p>View your property details. <span className="req-ref">MOD-002</span></p></div>
        <div className="card"><div className="empty-state"><div className="empty-text">No property assigned to your account.</div></div></div>
      </>
    );
  }

  return (
    <>
      <div className="welcome-banner"><h2><FaBuilding /> {myProperty.name}</h2><p>Your property information. <span className="req-ref">MOD-002</span></p></div>
      <div className="card">
        <div className="card-title">Property Details</div>
        <table className="table">
          <tbody>
            <tr><td style={{ fontWeight: 600, width: 180 }}><FaBuilding /> Property Name</td><td>{myProperty.name}</td></tr>
            <tr><td style={{ fontWeight: 600 }}><FaMapMarkerAlt /> Address</td><td>{myProperty.address || '—'}</td></tr>
            <tr><td style={{ fontWeight: 600 }}><FaTag /> Type</td><td>{myProperty.propertyType || '—'}</td></tr>
            <tr><td style={{ fontWeight: 600 }}><FaUserTie /> Manager</td><td>{myProperty.managerName || 'Not assigned'}</td></tr>
            <tr><td style={{ fontWeight: 600 }}><FaEnvelope /> Manager Email</td><td>—</td></tr>
            <tr><td style={{ fontWeight: 600 }}><FaPhone /> Manager Phone</td><td>—</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Status</td><td><span className={`badge ${myProperty.status === 'ACTIVE' ? 'badge-completed' : 'badge-danger'}`}>{myProperty.status || 'ACTIVE'}</span></td></tr>
          </tbody>
        </table>
      </div>
    </>
  );
};

export default MyProperty;
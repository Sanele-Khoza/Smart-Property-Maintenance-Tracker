import React from 'react';
import { FaFileContract, FaExclamationTriangle } from 'react-icons/fa';

const LeaseAgreement = () => {
  return (
    <>
      <div className="welcome-banner"><h2><FaFileContract /> Lease Agreement</h2></div>
      <div className="card">
        <div className="card-title">Lease Document Viewer</div>
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-dim)' }}>
          <FaFileContract style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }} />
          <p style={{ fontSize: 14, marginBottom: 12 }}>
            Lease agreements are managed externally and are not stored within the SPMT system.
          </p>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'rgba(243,156,18,0.1)', borderRadius: 6, fontSize: 12, color: 'var(--amber)' }}>
            <FaExclamationTriangle /> Per <strong>SRS §1.4</strong>, lease or contract management is explicitly excluded from the SPMT system scope.
          </div>
          <p style={{ marginTop: 16, fontSize: 12, color: 'var(--text-mid)' }}>
            Please contact your property manager for lease-related inquiries, renewals, or document copies.
          </p>
        </div>
      </div>
    </>
  );
};

export default LeaseAgreement;
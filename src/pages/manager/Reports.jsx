import React, { useState, useMemo } from 'react';
import { FaFileAlt, FaChartBar, FaChartLine, FaChartPie, FaDownload, FaSearch, FaFilter, FaBuilding, FaWrench, FaClock, FaBrain, FaTimes } from 'react-icons/fa';
import { getTickets, getProperties, getTechnicians } from '../../data/store';
import { getSession } from '../../data/authStore';

const TABS = ['Ticket Volume', 'Resolution Time', 'SLA Compliance', 'Provider Performance', 'AI Performance'];

const Reports = () => {
  const session = getSession();
  const pmName = session ? `${session.name} ${session.surname}` : '';
  const [allProperties] = useState(getProperties);
  const properties = useMemo(() => allProperties.filter(p => p.managerName === pmName), [allProperties, pmName]);
  const propNames = useMemo(() => new Set(properties.map(p => p.name)), [properties]);
  const [allTickets] = useState(getTickets);
  const [providers] = useState(() => getTechnicians().filter(t => t.availabilityStatus !== 'SUSPENDED'));
  const tickets = useMemo(() => allTickets.filter(t => propNames.has(t.propertyName)), [allTickets, propNames]);
  const [activeTab, setActiveTab] = useState('Ticket Volume');

  const now = Date.now();
  const dayMs = 86400000;

  const getSlaStatus = (t) => {
    if (!t.slaResolutionBefore) return null;
    const remaining = t.slaResolutionBefore - now;
    if (remaining <= 0) return 'breached';
    const total = t.slaResolutionBefore - (t.slaResponseBefore || (t.slaResolutionBefore - 24 * 3600000));
    if (total <= 0) return 'ontrack';
    if (((total - remaining) / total) * 100 >= 75) return 'warning';
    return 'ontrack';
  };

  const TabContent = () => {
    switch (activeTab) {
      case 'Ticket Volume': return (
        <div className="card">
          <div className="card-title"><FaChartLine /> Ticket Volume</div>
          <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>Total tickets: {tickets.length} | Open: {tickets.filter(t => t.status === 'Open').length} | Closed: {tickets.filter(t => t.status === 'Closed' || t.status === 'Completed (Provider)').length}</p>
          <table className="data-table" style={{ fontSize: 11 }}>
            <thead><tr><th>Property</th><th>Total</th><th>Open</th><th>In Progress</th><th>Closed</th><th>Escalated</th></tr></thead>
            <tbody>{properties.map(p => {
              const pt = tickets.filter(t => t.propertyName === p.name);
              return (<tr key={p.propertyId}><td>{p.name}</td><td className="cell-mono">{pt.length}</td><td className="cell-mono">{pt.filter(t => t.status === 'Open').length}</td><td className="cell-mono">{pt.filter(t => t.status === 'In Progress').length}</td><td className="cell-mono">{pt.filter(t => t.status === 'Closed' || t.status === 'Completed (Provider)').length}</td><td className="cell-mono">{pt.filter(t => t.status === 'Escalated').length}</td></tr>);
            })}</tbody>
          </table>
        </div>
      );
      case 'Resolution Time': return (
        <div className="card">
          <div className="card-title"><FaClock /> Avg Resolution Time</div>
          {(() => {
            const closed = tickets.filter(t => t.status === 'Closed' || t.status === 'Completed (Provider)');
            const avgByPriority = {};
            closed.forEach(t => {
              if (!avgByPriority[t.priority]) avgByPriority[t.priority] = { total: 0, count: 0 };
              const created = new Date(t.createdAt).getTime();
              const updated = new Date(t.updatedAt || t.createdAt).getTime();
              avgByPriority[t.priority].total += (updated - created) / 3600000;
              avgByPriority[t.priority].count++;
            });
            return (
              <table className="data-table" style={{ fontSize: 11 }}>
                <thead><tr><th>Priority</th><th>Avg Hours</th><th>Resolved</th></tr></thead>
                <tbody>{['URGENT', 'HIGH', 'MEDIUM', 'LOW'].map(p => {
                  const d = avgByPriority[p];
                  return (<tr key={p}><td><span className={`badge ${p === 'URGENT' ? 'badge-danger' : p === 'HIGH' ? 'badge-warning' : p === 'MEDIUM' ? 'badge-info' : 'badge-completed'}`}>{p}</span></td><td className="cell-mono">{d ? (d.total / d.count).toFixed(1) : '—'}</td><td className="cell-mono">{d ? d.count : 0}</td></tr>);
                })}</tbody>
              </table>
            );
          })()}
        </div>
      );
      case 'SLA Compliance': return (
        <div className="card">
          <div className="card-title"><FaClock /> SLA Compliance by Priority</div>
          {(() => {
            const withSla = tickets.filter(t => t.slaResolutionBefore);
            const pct = (n, d) => d > 0 ? Math.round((n / d) * 100) : 0;
            const stats = {};
            ['URGENT', 'HIGH', 'MEDIUM', 'LOW'].forEach(p => {
              const pt = withSla.filter(t => t.priority === p);
              const breached = pt.filter(t => getSlaStatus(t) === 'breached').length;
              const warning = pt.filter(t => getSlaStatus(t) === 'warning').length;
              stats[p] = { total: pt.length, breached, warning, compliant: pt.length - breached - warning };
            });
            return (
              <table className="data-table" style={{ fontSize: 11 }}>
                <thead><tr><th>Priority</th><th>Total</th><th>Compliant</th><th>%</th><th>Warning</th><th>Breached</th></tr></thead>
                <tbody>{Object.entries(stats).map(([p, s]) => (
                  <tr key={p}><td><span className={`badge ${p === 'URGENT' ? 'badge-danger' : p === 'HIGH' ? 'badge-warning' : p === 'MEDIUM' ? 'badge-info' : 'badge-completed'}`}>{p}</span></td>
                    <td className="cell-mono">{s.total}</td>
                    <td className="cell-mono" style={{ color: 'var(--teal)' }}>{s.compliant}</td>
                    <td className="cell-mono">{pct(s.compliant, s.total)}%</td>
                    <td className="cell-mono" style={{ color: s.warning > 0 ? 'var(--amber)' : 'var(--text-dim)' }}>{s.warning}</td>
                    <td className="cell-mono" style={{ color: s.breached > 0 ? 'var(--danger)' : 'var(--text-dim)' }}>{s.breached}</td>
                  </tr>
                ))}</tbody>
              </table>
            );
          })()}
        </div>
      );
      case 'Provider Performance': return (
        <div className="card">
          <div className="card-title"><FaWrench /> Provider Performance</div>
          <table className="data-table" style={{ fontSize: 11 }}>
            <thead><tr><th>Provider</th><th>Assigned</th><th>In Progress</th><th>Completed</th><th>Rating</th><th>Workload</th></tr></thead>
            <tbody>{providers.map(pr => {
              const assigned = tickets.filter(t => t.assignedTo === pr.name);
              return (<tr key={pr.id}><td><strong>{pr.name}</strong></td><td className="cell-mono">{assigned.length}</td><td className="cell-mono">{assigned.filter(t => t.status === 'In Progress').length}</td><td className="cell-mono">{assigned.filter(t => t.status === 'Completed (Provider)' || t.status === 'Closed').length}</td><td className="cell-mono"><span style={{ color: pr.rating >= 4 ? 'var(--teal)' : pr.rating >= 2 ? 'var(--amber)' : 'var(--danger)' }}>{pr.rating.toFixed(1)}</span></td><td className="cell-mono">{pr.currentWorkload}</td></tr>);
            })}</tbody>
          </table>
        </div>
      );
      case 'AI Performance': return (
        <div className="card">
          <div className="card-title"><FaBrain /> AI Performance</div>
          {(() => {
            const categories = [...new Set(tickets.filter(t => t.category).map(t => t.category))];
            return (
              <table className="data-table" style={{ fontSize: 11 }}>
                <thead><tr><th>Category</th><th>Total</th><th>AI Correct</th><th>Override</th><th>Conflict</th><th>Manual Review</th></tr></thead>
                <tbody>{categories.map(c => {
                  const ct = tickets.filter(t => t.category === c);
                  const override = ct.filter(t => t.aiOriginalCategory && t.aiOriginalCategory !== t.category).length;
                  const conflict = ct.filter(t => t.conflictDetected).length;
                  const review = ct.filter(t => t.manualReviewRequired).length;
                  return (<tr key={c}><td>{c}</td><td className="cell-mono">{ct.length}</td><td className="cell-mono" style={{ color: 'var(--teal)' }}>{ct.length - override - conflict - review}</td><td className="cell-mono" style={{ color: override > 0 ? 'var(--amber)' : 'var(--text-dim)' }}>{override}</td><td className="cell-mono" style={{ color: conflict > 0 ? 'var(--danger)' : 'var(--text-dim)' }}>{conflict}</td><td className="cell-mono" style={{ color: review > 0 ? 'var(--amber)' : 'var(--text-dim)' }}>{review}</td></tr>);
                })}</tbody>
              </table>
            );
          })()}
        </div>
      );
      default: return null;
    }
  };

  return (
    <div>
      <div className="card">
        <div className="card-title"><span><FaFileAlt /> Reports <span className="req-ref">MOD-010 / REQ-051-056</span></span></div>
      </div>
      <div className="card" style={{ padding: '0 0 12px' }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', borderBottom: '1px solid var(--border)', paddingBottom: 8, marginBottom: 12 }}>
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: '6px 14px', fontSize: 12, border: 'none', borderRadius: '4px 4px 0 0', cursor: 'pointer',
              backgroundColor: activeTab === tab ? 'rgba(45,183,145,0.1)' : 'transparent',
              color: activeTab === tab ? 'var(--teal)' : 'var(--text-dim)', fontWeight: activeTab === tab ? 600 : 400,
              borderBottom: activeTab === tab ? '2px solid var(--teal)' : '2px solid transparent',
            }}>{tab}</button>
          ))}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>
          Data scoped to properties managed by <strong>{pmName}</strong>: {properties.length} properties, {tickets.length} tickets
        </div>
        {TabContent()}
      </div>
    </div>
  );
};

export default Reports;

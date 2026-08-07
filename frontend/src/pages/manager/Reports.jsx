import React, { useState, useMemo, useEffect } from 'react';
import { FaFileAlt, FaChartLine, FaClock, FaDownload, FaSync, FaBuilding, FaWrench, FaBrain } from 'react-icons/fa';
import { getProperties, getTechnicians, refreshTickets } from '../../data/store';
import { getSlaStatus } from '../../data/slaEngine';
import { getSession } from '../../data/authStore';
import useTickets from '../../hooks/useTickets';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell,
} from 'recharts';

const TABS = ['Ticket Volume', 'Resolution Time', 'SLA Compliance', 'Provider Performance', 'AI Performance'];

const COLORS = {
  teal: '#2db791',
  blue: '#3278dc',
  amber: '#f0b432',
  red: '#dc3c3c',
  gray: '#8a9bb5',
  purple: '#8250c8',
};

const shortName = (name) => (name || '').split(' ')[0];

const CHART_TIP_STYLE = {
  background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6,
  fontSize: 11, padding: '6px 10px', color: 'var(--text)',
};

const IS_CLOSED = (t) => t.status === 'Closed' || t.status === 'Completed' || t.status === 'Tenant Confirmed';

const Reports = () => {
  const session = getSession();
  const pmName = session ? `${session.name} ${session.surname}` : '';
  const [allProperties] = useState(getProperties);
  const properties = useMemo(() => allProperties.filter(p => p.managerName === pmName), [allProperties, pmName]);
  const propNames = useMemo(() => new Set(properties.map(p => p.name)), [properties]);
  const [allTickets, refresh] = useTickets();
  const [providers] = useState(() => getTechnicians().filter(t => t.availabilityStatus !== 'SUSPENDED'));
  const tickets = useMemo(() => allTickets.filter(t => propNames.has(t.propertyName)), [allTickets, propNames]);
  const [activeTab, setActiveTab] = useState('Ticket Volume');
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(() => new Date());

  const getSlaStatusForReport = (t) => {
    const s = getSlaStatus(t);
    if (!s) return null;
    return s.state === 'breached' ? 'breached' : s.state === 'warning' ? 'warning' : 'ontrack';
  };

  useEffect(() => {
    setLastSync(new Date());
  }, [tickets.length, activeTab]);

  const handleSync = async () => {
    setSyncing(true);
    await refreshTickets();
    refresh();
    setLastSync(new Date());
    setSyncing(false);
  };

  const closedTickets = tickets.filter(IS_CLOSED);

  const tabCharts = {
    'Ticket Volume': (() => {
      const data = properties.map(p => {
        const pt = tickets.filter(t => t.propertyName === p.name);
        return {
          name: shortName(p.name),
          New: pt.filter(t => t.status === 'New').length,
          'In Progress': pt.filter(t => t.status === 'In Progress').length,
          Closed: pt.filter(IS_CLOSED).length,
          Escalated: pt.filter(t => t.status === 'Escalated').length,
        };
      });
      const last30 = Array.from({ length: 30 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (29 - i));
        const key = d.toLocaleDateString();
        return {
          name: `${d.getDate()}/${d.getMonth() + 1}`,
          Opened: tickets.filter(t => new Date(t.createdAt).toLocaleDateString() === key).length,
        };
      });
      return (
        <>
          <div className="card-title"><FaChartLine /> Ticket Volume</div>
          <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>
            Total tickets: {tickets.length} | Open: {tickets.filter(t => t.status === 'New').length} |
            In Progress: {tickets.filter(t => t.status === 'In Progress').length} | Closed: {closedTickets.length}
          </p>
          <div className="chart-block">
            <div className="chart-block-title">Tickets by Property</div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#5a8aaa' }} interval={0} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#5a8aaa' }} />
                <Tooltip contentStyle={CHART_TIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="New" stackId="a" fill={COLORS.gray} />
                <Bar dataKey="In Progress" stackId="a" fill={COLORS.teal} />
                <Bar dataKey="Closed" stackId="a" fill={COLORS.blue} />
                <Bar dataKey="Escalated" stackId="a" fill={COLORS.red} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-block">
            <div className="chart-block-title">Tickets Opened — Last 30 Days</div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={last30} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLORS.teal} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={COLORS.teal} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#5a8aaa' }} interval={4} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#5a8aaa' }} />
                <Tooltip contentStyle={CHART_TIP_STYLE} />
                <Area type="monotone" dataKey="Opened" stroke={COLORS.teal} fill="url(#volGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <table className="data-table" style={{ fontSize: 11 }}>
            <thead><tr><th>Property</th><th>Total</th><th>Open</th><th>In Progress</th><th>Closed</th><th>Escalated</th></tr></thead>
            <tbody>{properties.map(p => {
              const pt = tickets.filter(t => t.propertyName === p.name);
              return (<tr key={p.propertyId}><td>{p.name}</td><td className="cell-mono">{pt.length}</td><td className="cell-mono">{pt.filter(t => t.status === 'New').length}</td><td className="cell-mono">{pt.filter(t => t.status === 'In Progress').length}</td><td className="cell-mono">{pt.filter(IS_CLOSED).length}</td><td className="cell-mono">{pt.filter(t => t.status === 'Escalated').length}</td></tr>);
            })}</tbody>
          </table>
        </>
      );
    })(),

    'Resolution Time': (() => {
      const avgByPriority = {};
      closedTickets.forEach(t => {
        if (!avgByPriority[t.priority]) avgByPriority[t.priority] = { total: 0, count: 0 };
        const created = new Date(t.createdAt).getTime();
        const updated = new Date(t.updatedAt || t.createdAt).getTime();
        avgByPriority[t.priority].total += Math.max(updated - created, 0) / 3600000;
        avgByPriority[t.priority].count++;
      });
      const data = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'].map(p => {
        const d = avgByPriority[p];
        return { name: p, hours: d ? +(d.total / d.count).toFixed(1) : 0, Resolved: d ? d.count : 0 };
      });
      return (
        <>
          <div className="card-title"><FaClock /> Avg Resolution Time</div>
          <div className="chart-block">
            <div className="chart-block-title">Avg Hours to Resolve by Priority</div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#5a8aaa' }} interval={0} />
                <YAxis tick={{ fontSize: 10, fill: '#5a8aaa' }} />
                <Tooltip contentStyle={CHART_TIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="hours" name="Avg hours" fill={COLORS.teal} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <table className="data-table" style={{ fontSize: 11 }}>
            <thead><tr><th>Priority</th><th>Avg Hours</th><th>Resolved</th></tr></thead>
            <tbody>{['URGENT', 'HIGH', 'MEDIUM', 'LOW'].map(p => {
              const d = avgByPriority[p];
              return (<tr key={p}><td><span className={`badge ${p === 'URGENT' ? 'badge-danger' : p === 'HIGH' ? 'badge-warning' : p === 'MEDIUM' ? 'badge-info' : 'badge-completed'}`}>{p}</span></td><td className="cell-mono">{d ? (d.total / d.count).toFixed(1) : '—'}</td><td className="cell-mono">{d ? d.count : 0}</td></tr>);
            })}</tbody>
          </table>
        </>
      );
    })(),

    'SLA Compliance': (() => {
      const withSla = tickets.filter(t => t.slaResolutionBefore);
      const stats = {};
      let totals = { compliant: 0, warning: 0, breached: 0 };
      ['URGENT', 'HIGH', 'MEDIUM', 'LOW'].forEach(p => {
        const pt = withSla.filter(t => t.priority === p);
        const breached = pt.filter(t => getSlaStatusForReport(t) === 'breached').length;
        const warning = pt.filter(t => getSlaStatusForReport(t) === 'warning').length;
        const compliant = pt.length - breached - warning;
        stats[p] = { total: pt.length, breached, warning, compliant };
        totals.compliant += compliant;
        totals.warning += warning;
        totals.breached += breached;
      });
      const pct = (n, d) => d > 0 ? Math.round((n / d) * 100) : 0;
      const data = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'].map(p => ({
        name: p,
        Compliant: stats[p].compliant,
        Warning: stats[p].warning,
        Breached: stats[p].breached,
      }));
      const pieData = [
        { name: 'Compliant', value: totals.compliant, color: COLORS.teal },
        { name: 'Warning', value: totals.warning, color: COLORS.amber },
        { name: 'Breached', value: totals.breached, color: COLORS.red },
      ].filter(d => d.value > 0);
      return (
        <>
          <div className="card-title"><FaClock /> SLA Compliance by Priority</div>
          <div className="chart-block">
            <div className="chart-block-title">Compliance Status by Priority</div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#5a8aaa' }} interval={0} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#5a8aaa' }} />
                <Tooltip contentStyle={CHART_TIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Compliant" stackId="s" fill={COLORS.teal} />
                <Bar dataKey="Warning" stackId="s" fill={COLORS.amber} />
                <Bar dataKey="Breached" stackId="s" fill={COLORS.red} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {pieData.length > 0 && (
            <div className="chart-block">
              <div className="chart-block-title">Overall SLA Compliance</div>
              <ResponsiveContainer width="100%" height={230}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3} label={({ name, value }) => `${name}: ${value}`}>
                    {pieData.map(entry => <Cell key={entry.name} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={CHART_TIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
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
        </>
      );
    })(),

    'Provider Performance': (() => {
      const data = providers.map(pr => {
        const assigned = tickets.filter(t => t.assignedTo === pr.name || t.assignedToId === pr.id);
        return {
          name: shortName(pr.name),
          Assigned: assigned.length,
          Completed: assigned.filter(IS_CLOSED).length,
        };
      });
      return (
        <>
          <div className="card-title"><FaWrench /> Provider Performance</div>
          <div className="chart-block">
            <div className="chart-block-title">Assigned vs Completed by Provider</div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#5a8aaa' }} interval={0} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#5a8aaa' }} />
                <Tooltip contentStyle={CHART_TIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Assigned" fill={COLORS.blue} radius={[3, 3, 0, 0]} />
                <Bar dataKey="Completed" fill={COLORS.teal} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <table className="data-table" style={{ fontSize: 11 }}>
            <thead><tr><th>Provider</th><th>Assigned</th><th>In Progress</th><th>Completed</th><th>Rating</th><th>Workload</th></tr></thead>
            <tbody>{providers.map(pr => {
              const assigned = tickets.filter(t => t.assignedTo === pr.name || t.assignedToId === pr.id);
              return (<tr key={pr.id}><td><strong>{pr.name}</strong></td><td className="cell-mono">{assigned.length}</td><td className="cell-mono">{assigned.filter(t => t.status === 'In Progress').length}</td><td className="cell-mono">{assigned.filter(IS_CLOSED).length}</td><td className="cell-mono"><span style={{ color: pr.rating >= 4 ? 'var(--teal)' : pr.rating >= 2 ? 'var(--amber)' : 'var(--danger)' }}>{pr.rating.toFixed(1)}</span></td><td className="cell-mono">{pr.currentWorkload}</td></tr>);
            })}</tbody>
          </table>
        </>
      );
    })(),

    'AI Performance': (() => {
      const categories = [...new Set(tickets.filter(t => t.category).map(t => t.category))];
      const data = categories.map(c => {
        const ct = tickets.filter(t => t.category === c);
        const override = ct.filter(t => t.aiOriginalCategory && t.aiOriginalCategory !== t.category).length;
        const conflict = ct.filter(t => t.conflictDetected).length;
        const review = ct.filter(t => t.manualReviewRequired).length;
        return {
          name: c,
          'AI Correct': Math.max(ct.length - override - conflict - review, 0),
          Override: override,
          Conflict: conflict,
          Review: review,
        };
      });
      const totals = data.reduce((acc, d) => ({
        'AI Correct': acc['AI Correct'] + d['AI Correct'],
        Override: acc.Override + d.Override,
        Conflict: acc.Conflict + d.Conflict,
        Review: acc.Review + d.Review,
      }), { 'AI Correct': 0, Override: 0, Conflict: 0, Review: 0 });
      const pieData = [
        { name: 'AI Correct', value: totals['AI Correct'], color: COLORS.teal },
        { name: 'Override', value: totals.Override, color: COLORS.amber },
        { name: 'Conflict', value: totals.Conflict, color: COLORS.red },
        { name: 'Manual Review', value: totals.Review, color: COLORS.purple },
      ].filter(d => d.value > 0);
      return (
        <>
          <div className="card-title"><FaBrain /> AI Performance</div>
          {pieData.length > 0 && (
            <div className="chart-block">
              <div className="chart-block-title">AI Classification Outcomes</div>
              <ResponsiveContainer width="100%" height={230}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} paddingAngle={3} label={({ name, value }) => `${name}: ${value}`}>
                    {pieData.map(entry => <Cell key={entry.name} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={CHART_TIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          {data.length > 0 && (
            <div className="chart-block">
              <div className="chart-block-title">Outcomes by Category</div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#5a8aaa' }} interval={0} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#5a8aaa' }} />
                  <Tooltip contentStyle={CHART_TIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="AI Correct" stackId="a" fill={COLORS.teal} />
                  <Bar dataKey="Override" stackId="a" fill={COLORS.amber} />
                  <Bar dataKey="Conflict" stackId="a" fill={COLORS.red} />
                  <Bar dataKey="Review" stackId="a" fill={COLORS.purple} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
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
        </>
      );
    })(),
  };

  return (
    <div>
      <div className="card">
        <div className="card-title">
          <span><FaFileAlt /> Reports <span className="req-ref">MOD-010 / REQ-051-056</span></span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: 'var(--text-dim)' }}>
            <span>Synced {lastSync.toLocaleTimeString()}</span>
            <button className="btn btn-secondary btn-sm" onClick={handleSync} disabled={syncing}>
              <FaSync style={{ marginRight: 4 }} />{syncing ? 'Syncing...' : 'Refresh'}
            </button>
          </div>
        </div>
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
        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span>Data scoped to properties managed by <strong>{pmName}</strong>: {properties.length} properties, {tickets.length} tickets</span>
          {tickets.length > 0 && <span style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: COLORS.teal, display: 'inline-block' }} /> Resolved: {closedTickets.length}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: COLORS.amber, display: 'inline-block' }} /> SLA Warning: {tickets.filter(t => getSlaStatusForReport(t) === 'warning').length}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: COLORS.red, display: 'inline-block' }} /> SLA Breached: {tickets.filter(t => getSlaStatusForReport(t) === 'breached').length}</span>
          </span>}
        </div>
        <div className="card" style={{ margin: 0 }}>
          {tabCharts[activeTab]}
        </div>
      </div>
    </div>
  );
};

export default Reports;

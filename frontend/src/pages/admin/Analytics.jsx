import React, { useEffect, useState, useCallback } from 'react';
import { FaChartBar, FaChartLine, FaChartPie, FaStar, FaBrain, FaClock, FaCheckDouble, FaSync, FaExclamationTriangle } from 'react-icons/fa';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { api } from '../../api/client';

const PRIORITY_COLORS = { EMERGENCY: '#dc3c3c', URGENT: '#dc3c3c', HIGH: '#f0b432', MEDIUM: '#3278dc', LOW: '#787882' };
const PIE_COLORS = ['#2db791', '#f0b432', '#3278dc', '#dc3c3c', '#8a9bb5', '#8250c8', '#e68c1e', '#787882'];

const Analytics = () => {
  const [state, setState] = useState({ loading: true, error: null });
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    setState({ loading: true, error: null });
    try {
      const res = await api('/analytics/dashboard');
      setData(res.data);
      setState({ loading: false, error: null });
    } catch (err) {
      setState({ loading: false, error: err.message || 'Failed to load analytics.' });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const dailyVolume = data?.ticketVolume || [];
  const slaCompliance = (data?.slaComplianceByPriority || []).map(row => ({
    ...row,
    fill: PRIORITY_COLORS[row.priority] || '#787882',
  }));
  const providerPerformance = data?.providerPerformance || [];
  const statusDist = (data?.statusDistribution || []).map((row, i) => ({
    ...row,
    fill: PIE_COLORS[i % PIE_COLORS.length],
  }));
  const aiConfidence = data?.aiConfidence || [];
  const priorityDist = (data?.priorityDistribution || []).map(row => ({
    ...row,
    fill: PRIORITY_COLORS[row.priority] || '#787882',
  }));
  const avgResolutionByPriority = (data?.avgResolutionByPriority || []).map(row => ({
    ...row,
    fill: PRIORITY_COLORS[row.priority] || '#787882',
  }));

  const empty = !state.loading && !state.error && (!data || !data.totalTickets);

  if (state.loading) {
    return (
      <div className="card">
        <div className="card-title"><span><FaChartBar /> Analytics Dashboard <span className="req-ref">SDD — Analytics & Monitoring</span></span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '40px 16px', color: '#5a8aaa' }}>
          <FaSync className="spin" /> Loading analytics…
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="card">
        <div className="card-title"><span><FaChartBar /> Analytics Dashboard <span className="req-ref">SDD — Analytics & Monitoring</span></span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '40px 16px', color: 'var(--danger)' }}>
          <FaExclamationTriangle /> {state.error}
          <button className="btn btn-primary" onClick={load}><FaSync /> Retry</button>
        </div>
      </div>
    );
  }

  if (empty) {
    return (
      <div className="card">
        <div className="card-title"><span><FaChartBar /> Analytics Dashboard <span className="req-ref">SDD — Analytics & Monitoring</span></span></div>
        <div style={{ padding: '40px 16px', color: '#5a8aaa', textAlign: 'center' }}>
          No ticket data yet — create some tickets and check back here.
          <div style={{ marginTop: 16 }}><button className="btn btn-primary" onClick={load}><FaSync /> Refresh</button></div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <div className="card-title">
          <span><FaChartBar /> Analytics Dashboard <span className="req-ref">SDD — Analytics & Monitoring</span></span>
          <button className="btn btn-secondary" onClick={load} style={{ marginLeft: 'auto' }}><FaSync /> Refresh</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16 }}>
        <div className="card">
          <div className="card-title"><span><FaChartLine /> Ticket Volume (14 days)</span></div>
          <div style={{ padding: '0 4px' }}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dailyVolume}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#5a8aaa' }} />
                <YAxis tick={{ fontSize: 10, fill: '#5a8aaa' }} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', fontSize: 12 }} />
                <Bar dataKey="created" name="Created" fill="#3278dc" radius={[2, 2, 0, 0]} />
                <Bar dataKey="resolved" name="Resolved" fill="#2db791" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-title"><span><FaClock /> Avg Resolution Time (hours)</span></div>
          <div style={{ padding: '0 4px' }}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={avgResolutionByPriority} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#5a8aaa' }} />
                <YAxis dataKey="priority" type="category" tick={{ fontSize: 11, fill: '#5a8aaa' }} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', fontSize: 12 }} formatter={(v) => `${v}h`} />
                <Bar dataKey="avgHours" name="Avg Hours" radius={[0, 2, 2, 0]}>
                  {avgResolutionByPriority.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-title"><span><FaCheckDouble /> SLA Compliance by Priority</span></div>
          <div style={{ padding: '0 4px' }}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={slaCompliance}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="priority" tick={{ fontSize: 11, fill: '#5a8aaa' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#5a8aaa' }} unit="%" />
                <Tooltip contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', fontSize: 12 }} formatter={(v) => `${v}%`} />
                <Bar dataKey="compliant" name="Compliance %" radius={[2, 2, 0, 0]}>
                  {slaCompliance.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-title"><span><FaChartPie /> Status Distribution</span></div>
          <div style={{ padding: '0 4px' }}>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {statusDist.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-title"><span><FaStar /> Provider Performance</span></div>
          <div style={{ padding: '0 4px' }}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={providerPerformance}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#5a8aaa' }} />
                <YAxis tick={{ fontSize: 10, fill: '#5a8aaa' }} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', fontSize: 12 }} />
                <Bar dataKey="jobs" name="Total Jobs" fill="#3278dc" radius={[2, 2, 0, 0]} />
                <Bar dataKey="resolved" name="Resolved" fill="#2db791" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-title"><span><FaChartBar /> Priority Distribution</span></div>
          <div style={{ padding: '0 4px' }}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={priorityDist}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="priority" tick={{ fontSize: 11, fill: '#5a8aaa' }} />
                <YAxis tick={{ fontSize: 10, fill: '#5a8aaa' }} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', fontSize: 12 }} />
                <Bar dataKey="count" name="Tickets" radius={[2, 2, 0, 0]}>
                  {priorityDist.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-title"><span><FaBrain /> AI Adapter Confidence & Calls</span></div>
          <div style={{ padding: '0 4px' }}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={aiConfidence}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="adapter" tick={{ fontSize: 11, fill: '#5a8aaa' }} />
                <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#5a8aaa' }} unit="%" />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#5a8aaa' }} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', fontSize: 12 }} />
                <Bar yAxisId="left" dataKey="avgConfidence" name="Avg Confidence %" fill="#2db791" radius={[2, 2, 0, 0]} />
                <Bar yAxisId="right" dataKey="calls" name="Calls" fill="#f0b432" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-title"><span><FaChartLine /> Ticket Activity Trend</span></div>
          <div style={{ padding: '0 4px' }}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={dailyVolume}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#5a8aaa' }} />
                <YAxis tick={{ fontSize: 10, fill: '#5a8aaa' }} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', fontSize: 12 }} />
                <Line type="monotone" dataKey="created" name="Created" stroke="#3278dc" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="resolved" name="Resolved" stroke="#2db791" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
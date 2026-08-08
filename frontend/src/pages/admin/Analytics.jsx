import React, { useMemo } from 'react';
import { FaChartBar, FaChartLine, FaChartPie, FaStar, FaBrain, FaClock, FaCheckDouble } from 'react-icons/fa';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';
import { getTickets, getSlaConfig, getTechnicians, getInferenceLogs } from '../../data/store';

const now = Date.now();
const day = 86400000;

const PRIORITY_COLORS = { URGENT: '#dc3c3c', HIGH: '#f0b432', MEDIUM: '#3278dc', LOW: '#787882' };
const STATUS_COLORS = ['#8a9bb5', '#f0b432', '#3278dc', '#2db791', '#8250c8', '#2db791', '#787882', '#e68c1e', '#dc3c3c'];
const PIE_COLORS = ['#2db791', '#f0b432', '#3278dc', '#dc3c3c', '#8a9bb5', '#8250c8', '#e68c1e', '#787882'];

const Analytics = () => {
  const tickets = useMemo(() => getTickets(), []);
  const slaConfig = useMemo(() => getSlaConfig(), []);
  const technicians = useMemo(() => getTechnicians(), []);
  const inferenceLogs = useMemo(() => getInferenceLogs(), []);

  // Ticket volume by day (last 14 days)
  const dailyVolume = useMemo(() => {
    const map = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now - i * day);
      const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      map[key] = { date: key, created: 0, resolved: 0 };
    }
    tickets.forEach(t => {
      const c = new Date(t.createdAt);
      const cKey = c.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (map[cKey]) map[cKey].created++;
      const u = new Date(t.updatedAt);
      const uKey = u.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (map[uKey] && ['Completed', 'Tenant Confirmed', 'Closed'].includes(t.status)) map[uKey].resolved++;
    });
    return Object.values(map);
  }, [tickets]);

  // SLA compliance by priority
  const slaCompliance = useMemo(() => {
    return slaConfig.map(sla => {
      const matching = tickets.filter(t => t.priority === sla.priority);
      const ok = matching.filter(t => {
        const dur = (new Date(t.updatedAt).getTime() - new Date(t.createdAt).getTime()) / 60000;
        return dur <= sla.resolutionMinutes;
      });
      return {
        priority: sla.priority,
        compliant: matching.length > 0 ? Math.round(ok.length / matching.length * 100) : 0,
        total: matching.length,
        fill: PRIORITY_COLORS[sla.priority] || '#787882',
      };
    });
  }, [tickets, slaConfig]);

  // Provider performance
  const providerPerformance = useMemo(() => {
    return technicians.map(tech => {
      const assigned = tickets.filter(t => t.assignedTo === tech.name);
      const resolved = assigned.filter(t => ['Completed', 'Tenant Confirmed', 'Closed'].includes(t.status));
      return {
        name: tech.name.split(' ')[0],
        jobs: assigned.length,
        resolved: resolved.length,
        rating: tech.rating,
        workload: tech.currentWorkload || 0,
      };
    }).sort((a, b) => b.jobs - a.jobs);
  }, [tickets, technicians]);

  // Status distribution for pie
  const statusDist = useMemo(() => {
    const map = {};
    tickets.forEach(t => { map[t.status] = (map[t.status] || 0) + 1; });
    return Object.entries(map).map(([name, value], i) => ({ name, value, fill: STATUS_COLORS[i % STATUS_COLORS.length] }));
  }, [tickets]);

  // AI confidence by adapter
  const aiConfidence = useMemo(() => {
    const adapters = {};
    inferenceLogs.forEach(log => {
      if (!adapters[log.adapter]) adapters[log.adapter] = { adapter: log.adapter, confidences: [], latencies: [], conflictCount: 0 };
      adapters[log.adapter].confidences.push(log.confidence);
      adapters[log.adapter].latencies.push(log.latencyMs);
      if (log.conflictDetected) adapters[log.adapter].conflictCount++;
    });
    return Object.values(adapters).map(a => ({
      adapter: a.adapter,
      avgConfidence: Math.round(a.confidences.reduce((s, v) => s + v, 0) / a.confidences.length * 100),
      avgLatency: Math.round(a.latencies.reduce((s, v) => s + v, 0) / a.latencies.length),
      conflicts: a.conflictCount,
      calls: a.confidences.length,
    }));
  }, [inferenceLogs]);

  // Priority distribution
  const priorityDist = useMemo(() => {
    const map = { URGENT: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    tickets.forEach(t => { if (map[t.priority] !== undefined) map[t.priority]++; });
    return Object.entries(map).map(([priority, count]) => ({ priority, count, fill: PRIORITY_COLORS[priority] }));
  }, [tickets]);

  const avgResolutionByPriority = useMemo(() => {
    const map = {};
    tickets.forEach(t => {
      if (!map[t.priority]) map[t.priority] = { sum: 0, count: 0 };
      const dur = (new Date(t.updatedAt).getTime() - new Date(t.createdAt).getTime()) / 60000;
      if (!isNaN(dur) && dur >= 0) { map[t.priority].sum += dur; map[t.priority].count++; }
    });
    return Object.entries(map).map(([priority, d]) => ({
      priority,
      avgHours: d.count > 0 ? Math.round(d.sum / d.count / 60 * 10) / 10 : 0,
      fill: PRIORITY_COLORS[priority],
    }));
  }, [tickets]);

  return (
    <div>
      <div className="card">
        <div className="card-title">
          <span><FaChartBar /> Analytics Dashboard <span className="req-ref">SDD — Analytics & Monitoring</span></span>
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
          <div className="card-title"><span><FaBrain /> AI Adapter Confidence & Latency</span></div>
          <div style={{ padding: '0 4px' }}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={aiConfidence}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="adapter" tick={{ fontSize: 11, fill: '#5a8aaa' }} />
                <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#5a8aaa' }} unit="%" />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#5a8aaa' }} unit="ms" />
                <Tooltip contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', fontSize: 12 }} />
                <Bar yAxisId="left" dataKey="avgConfidence" name="Avg Confidence %" fill="#2db791" radius={[2, 2, 0, 0]} />
                <Bar yAxisId="right" dataKey="avgLatency" name="Avg Latency (ms)" fill="#f0b432" radius={[2, 2, 0, 0]} />
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

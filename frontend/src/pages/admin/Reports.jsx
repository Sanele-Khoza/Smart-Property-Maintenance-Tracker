import React, { useState, useMemo, useEffect, useRef } from 'react';
import { FaFileExport, FaChartBar, FaClock, FaCheckDouble, FaStar, FaBrain, FaFilter, FaCalendarAlt, FaDownload, FaSync } from 'react-icons/fa';
import { getProviders, getProperties, getTechnicians, getSlaConfig, getCategories, getInferenceLogs, refreshTickets } from '../../data/store';
import { getSlaStatus } from '../../data/slaEngine';
import useTickets from '../../hooks/useTickets';
import {
  ResponsiveContainer, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell,
} from 'recharts';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const PRIORITY_ORDER = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

const COLORS = {
  teal: '#2db791',
  blue: '#3278dc',
  amber: '#f0b432',
  red: '#dc3c3c',
  gray: '#8a9bb5',
  purple: '#8250c8',
};

const CHART_TIP_STYLE = {
  background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6,
  fontSize: 11, padding: '6px 10px', color: 'var(--text)',
};

const shortName = (name) => (name || '').split(' ')[0];

const TABS = [
  { key: 'ticket-volume', label: 'Ticket Volume', icon: FaChartBar },
  { key: 'resolution-time', label: 'Resolution Time', icon: FaClock },
  { key: 'sla-compliance', label: 'SLA Compliance', icon: FaCheckDouble },
  { key: 'provider-performance', label: 'Provider Performance', icon: FaStar },
  { key: 'ai-performance', label: 'AI Performance', icon: FaBrain },
];

const formatMinutes = (mins) => {
  if (mins == null) return '—';
  if (mins < 60) return `${Math.round(mins)} min`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

const calcDurationMinutes = (start, end) => {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (isNaN(s) || isNaN(e)) return null;
  return (e - s) / 60000;
};

const Reports = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [propertyFilter, setPropertyFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [providerFilter, setProviderFilter] = useState('');
  const [showExportNote, setShowExportNote] = useState(false);
  const [exportExpiry, setExportExpiry] = useState(null);
  const [countdown, setCountdown] = useState('');
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const [tickets, refresh] = useTickets();
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(() => new Date());
  const providers = useMemo(() => getProviders(), []);
  const properties = useMemo(() => getProperties(), []);
  const technicians = useMemo(() => getTechnicians(), []);
  const slaConfig = useMemo(() => getSlaConfig(), []);
  const categories = useMemo(() => getCategories(), []);
  const inferenceLogs = useMemo(() => getInferenceLogs(), []);

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      if (propertyFilter && t.propertyName !== propertyFilter) return false;
      if (startDate && new Date(t.createdAt).getTime() < new Date(startDate).getTime()) return false;
      if (endDate && new Date(t.createdAt).getTime() > new Date(endDate).getTime() + 86400000) return false;
      if (categoryFilter && t.category !== categoryFilter) return false;
      if (providerFilter && t.assignedTo !== providerFilter) return false;
      return true;
    });
  }, [tickets, propertyFilter, startDate, endDate, categoryFilter, providerFilter]);

  useEffect(() => {
    setLastSync(new Date());
  }, [filteredTickets.length]);

  const handleSync = async () => {
    setSyncing(true);
    await refreshTickets();
    refresh();
    setLastSync(new Date());
    setSyncing(false);
  };

  const statusCounts = useMemo(() => {
    const counts = {};
    filteredTickets.forEach(t => {
      counts[t.status] = (counts[t.status] || 0) + 1;
    });
    return counts;
  }, [filteredTickets]);

  const statusLabels = {
    'New': 'New',
    'AI Classified': 'AI Classified',
    'Assigned': 'Assigned',
    'Accepted': 'Accepted',
    'In Progress': 'In Progress',
    'Waiting for Parts': 'Waiting',
    'Completed': 'Completed',
    'Tenant Confirmed': 'Tenant Confirmed',
    'Closed': 'Closed',
    'Manual Review': 'Manual Review',
    'Reopened': 'Reopened',
    'Escalated': 'Escalated',
  };

  const maxCount = Math.max(...Object.values(statusCounts), 1);

  const resolutionData = useMemo(() => {
    const byPriority = {};
    filteredTickets.forEach(t => {
      if (!byPriority[t.priority]) byPriority[t.priority] = { tickets: [], sum: 0, count: 0, slaOk: 0 };
      byPriority[t.priority].tickets.push(t);
      const dur = calcDurationMinutes(t.createdAt, t.updatedAt);
      if (dur !== null) {
        byPriority[t.priority].sum += dur;
        byPriority[t.priority].count++;
      }
    });
    return Object.entries(byPriority).map(([priority, data]) => {
      const avg = data.count > 0 ? data.sum / data.count : null;
      const sla = slaConfig.find(s => s.priority === priority);
      const compliance = data.count > 0
        ? (data.tickets.filter(t => {
            const d = calcDurationMinutes(t.createdAt, t.updatedAt);
            return d !== null && d <= (sla?.resolutionMinutes || 999999);
          }).length / data.count * 100).toFixed(1)
        : '—';
      return { priority, avg, target: sla?.resolutionMinutes || null, compliance, count: data.count };
    }).sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99));
  }, [filteredTickets, slaConfig]);

  const slaData = useMemo(() => {
    const byPriority = {};
    filteredTickets.forEach(t => {
      if (!byPriority[t.priority]) byPriority[t.priority] = { total: 0, responseOk: 0, resolutionOk: 0 };
      byPriority[t.priority].total++;
      const sla = slaConfig.find(s => s.priority === t.priority);
      if (sla) {
        const dur = calcDurationMinutes(t.createdAt, t.updatedAt);
        if (dur !== null) {
          if (dur <= sla.responseMinutes) byPriority[t.priority].responseOk++;
          if (dur <= sla.resolutionMinutes) byPriority[t.priority].resolutionOk++;
        }
      }
    });
    const rows = Object.entries(byPriority).map(([priority, data]) => {
      const sla = slaConfig.find(s => s.priority === priority);
      const responseRate = data.total > 0 ? (data.responseOk / data.total * 100).toFixed(1) : '—';
      const resolutionRate = data.total > 0 ? (data.resolutionOk / data.total * 100).toFixed(1) : '—';
      return { priority, ...data, sla, responseRate, resolutionRate };
    }).sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99));
    return rows;
  }, [filteredTickets, slaConfig]);

  const overallCompliance = useMemo(() => {
    const total = filteredTickets.length;
    if (total === 0) return 0;
    const ok = filteredTickets.filter(t => {
      const sla = slaConfig.find(s => s.priority === t.priority);
      if (!sla) return true;
      const dur = calcDurationMinutes(t.createdAt, t.updatedAt);
      return dur !== null && dur <= sla.resolutionMinutes;
    }).length;
    return (ok / total * 100).toFixed(1);
  }, [filteredTickets, slaConfig]);

  const providerStats = useMemo(() => {
    return technicians.map(tech => {
      const techTickets = filteredTickets.filter(t => t.assignedTo === tech.name);
      const resolved = techTickets.filter(t => t.status === 'Completed' || t.status === 'Tenant Confirmed' || t.status === 'Closed');
      const onTime = resolved.filter(t => {
        const sla = slaConfig.find(s => s.priority === t.priority);
        if (!sla) return true;
        const dur = calcDurationMinutes(t.createdAt, t.updatedAt);
        return dur !== null && dur <= sla.resolutionMinutes;
      });
      const onTimePct = resolved.length > 0 ? (onTime.length / resolved.length * 100).toFixed(1) : '—';
      return {
        ...tech,
        totalJobs: techTickets.length,
        resolvedJobs: resolved.length,
        onTimePct,
        currentWorkload: tech.currentWorkload || 0,
        rating: tech.rating,
      };
    });
  }, [technicians, filteredTickets, slaConfig]);

  const sortedProviders = useMemo(() => {
    if (!sortColumn) return providerStats;
    return [...providerStats].sort((a, b) => {
      let aVal = a[sortColumn];
      let bVal = b[sortColumn];
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [providerStats, sortColumn, sortDir]);

  const toggleSort = (col) => {
    if (sortColumn === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(col);
      setSortDir('asc');
    }
  };

  const overrideCount = useMemo(() => {
    return filteredTickets.filter(t => t.aiOriginalCategory && t.category && t.aiOriginalCategory !== t.category).length;
  }, [filteredTickets]);

  const conflictCount = useMemo(() => {
    return filteredTickets.filter(t => t.conflictDetected).length;
  }, [filteredTickets]);

  const avgConfidence = useMemo(() => {
    const withConf = filteredTickets.filter(t => t.combinedConfidence != null);
    if (withConf.length === 0) return '—';
    return (withConf.reduce((s, t) => s + t.combinedConfidence, 0) / withConf.length * 100).toFixed(1) + '%';
  }, [filteredTickets]);

  const overrideByCategory = useMemo(() => {
    const map = {};
    filteredTickets.forEach(t => {
      if (t.aiOriginalCategory && t.category && t.aiOriginalCategory !== t.category) {
        const key = `${t.aiOriginalCategory} → ${t.category}`;
        map[key] = (map[key] || 0) + 1;
      }
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filteredTickets]);

  const conflictByCategory = useMemo(() => {
    const map = {};
    filteredTickets.filter(t => t.conflictDetected).forEach(t => {
      const cat = t.aiOriginalCategory || t.category || 'Unknown';
      map[cat] = (map[cat] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filteredTickets]);

  const manualReviewCount = useMemo(() => {
    return filteredTickets.filter(t => t.manualReviewRequired).length;
  }, [filteredTickets]);

  const adapterStats = useMemo(() => {
    const adapters = {};
    inferenceLogs.forEach(log => {
      if (!adapters[log.adapter]) adapters[log.adapter] = { calls: 0, totalLatency: 0, totalConfidence: 0 };
      adapters[log.adapter].calls++;
      adapters[log.adapter].totalLatency += log.latencyMs;
      adapters[log.adapter].totalConfidence += log.confidence;
    });
    return Object.entries(adapters).map(([name, data]) => ({
      adapter: name,
      calls: data.calls,
      avgLatency: (data.totalLatency / data.calls).toFixed(0),
      avgConfidence: (data.totalConfidence / data.calls * 100).toFixed(1) + '%',
    }));
  }, [inferenceLogs]);

  const countdownRef = useRef(null);
  useEffect(() => {
    if (!exportExpiry) return;
    countdownRef.current = setInterval(() => {
      const remaining = exportExpiry - Date.now();
      if (remaining <= 0) {
        setCountdown('EXPIRED');
        clearInterval(countdownRef.current);
      } else {
        const hrs = Math.floor(remaining / 3600000);
        const mins = Math.floor((remaining % 3600000) / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);
        setCountdown(`${hrs}h ${mins}m ${secs}s`);
      }
    }, 1000);
    return () => clearInterval(countdownRef.current);
  }, [exportExpiry]);

  const generatePdf = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const tabName = TABS[activeTab].label;
    const dateRange = [startDate, endDate].filter(Boolean).join(' to ') || 'All time';

    doc.setFontSize(16);
    doc.text(`SPMT Report — ${tabName}`, 14, 20);
    doc.setFontSize(10);
    doc.text(`Date range: ${dateRange}`, 14, 28);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 34);
    doc.text(`Filters: ${[propertyFilter, categoryFilter, providerFilter].filter(Boolean).join(', ') || 'None'}`, 14, 40);

    let y = 48;

    const addTable = (headers, rows, startY) => {
      doc.autoTable({
        head: [headers],
        body: rows,
        startY,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [30, 40, 60] },
        margin: { top: 10, bottom: 20 },
        pageBreak: 'auto',
      });
      return doc.lastAutoTable.finalY + 6;
    };

    if (activeTab === 0) {
      const headers = ['Status', 'Count'];
      const rows = Object.entries(statusLabels).map(([status, label]) => [label, statusCounts[status] || 0]);
      y = addTable(headers, rows, y);
      doc.setFontSize(10);
      doc.text(`Total tickets: ${filteredTickets.length}`, 14, y);
    } else if (activeTab === 1) {
      const headers = ['Priority', 'Target Resolution', 'Actual Avg', 'Compliance %', 'Tickets'];
      const rows = resolutionData.map(r => [
        r.priority,
        r.target ? formatMinutes(r.target) : '—',
        r.avg != null ? formatMinutes(r.avg) : '—',
        r.compliance !== '—' ? `${r.compliance}%` : '—',
        r.count,
      ]);
      y = addTable(headers, rows, y);
    } else if (activeTab === 2) {
      const headers = ['Priority', 'Target Response', 'Response Compliance', 'Target Resolution', 'Resolution Compliance', 'Tickets'];
      const rows = slaData.map(r => [
        r.priority,
        r.sla ? formatMinutes(r.sla.responseMinutes) : '—',
        `${r.responseRate}${r.responseRate !== '—' ? '%' : ''}`,
        r.sla ? formatMinutes(r.sla.resolutionMinutes) : '—',
        `${r.resolutionRate}${r.resolutionRate !== '—' ? '%' : ''}`,
        r.total,
      ]);
      y = addTable(headers, rows, y);
      doc.setFontSize(10);
      doc.text(`Overall SLA Compliance: ${overallCompliance}%`, 14, y);
    } else if (activeTab === 3) {
      const headers = ['Provider', 'Total Jobs', 'Resolved', 'On-Time %', 'Rating', 'Workload'];
      const rows = providerStats.map(p => [
        p.name,
        p.totalJobs,
        p.resolvedJobs,
        p.onTimePct !== '—' ? `${p.onTimePct}%` : '—',
        p.rating.toFixed(1),
        p.currentWorkload,
      ]);
      y = addTable(headers, rows, y);
    } else if (activeTab === 4) {
      doc.setFontSize(11);
      doc.text(`Override Count: ${overrideCount}`, 14, y);
      doc.text(`Conflict Rate: ${filteredTickets.length > 0 ? (conflictCount / filteredTickets.length * 100).toFixed(1) : '0'}%`, 14, y + 6);
      doc.text(`Manual Review Rate: ${filteredTickets.length > 0 ? (manualReviewCount / filteredTickets.length * 100).toFixed(1) : '0'}%`, 14, y + 12);
      doc.text(`Avg Confidence: ${avgConfidence}`, 14, y + 18);
      y += 26;
      if (overrideByCategory.length > 0) {
        y = addTable(['AI → Override', 'Count'], overrideByCategory, y);
      }
      if (conflictByCategory.length > 0) {
        y = addTable(['Category', 'Conflicts'], conflictByCategory, y);
      }
      if (adapterStats.length > 0) {
        y = addTable(['Adapter', 'Calls', 'Avg Latency (ms)', 'Avg Confidence'], adapterStats.map(a => [a.adapter, a.calls, a.avgLatency, a.avgConfidence]), y);
      }
    }

    const filename = `SPMT_${tabName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(filename);

    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
    setExportExpiry(expiresAt);
    setShowExportNote(true);
  };

  const handleGenerateReport = () => {
    generatePdf();
  };

  const renderFilters = () => (
    <div style={{ display: 'flex', gap: 8, padding: '12px 0', flexWrap: 'wrap', alignItems: 'end', borderBottom: '1px solid var(--border)', marginBottom: 12 }}>
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label" style={{ fontSize: 10 }}><FaFilter size={10} /> Property</label>
        <select className="form-select" style={{ width: 'auto', minWidth: 130, fontSize: 11 }} value={propertyFilter} onChange={e => setPropertyFilter(e.target.value)}>
          <option value="">All Properties</option>
          {properties.map(p => <option key={p.propertyId} value={p.name}>{p.name}</option>)}
        </select>
      </div>
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label" style={{ fontSize: 10 }}><FaCalendarAlt size={10} /> Start</label>
        <input type="date" className="form-input" style={{ width: 'auto', fontSize: 11, padding: '4px 6px' }} value={startDate} onChange={e => setStartDate(e.target.value)} />
      </div>
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label" style={{ fontSize: 10 }}><FaCalendarAlt size={10} /> End</label>
        <input type="date" className="form-input" style={{ width: 'auto', fontSize: 11, padding: '4px 6px' }} value={endDate} onChange={e => setEndDate(e.target.value)} />
      </div>
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label" style={{ fontSize: 10 }}><FaFilter size={10} /> Category</label>
        <select className="form-select" style={{ width: 'auto', minWidth: 110, fontSize: 11 }} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
      </div>
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label" style={{ fontSize: 10 }}><FaFilter size={10} /> Provider</label>
        <select className="form-select" style={{ width: 'auto', minWidth: 110, fontSize: 11 }} value={providerFilter} onChange={e => setProviderFilter(e.target.value)}>
          <option value="">All Providers</option>
          {providers.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
        </select>
      </div>
      <button className="btn btn-teal btn-sm" onClick={handleGenerateReport}><FaFileExport /> Generate Report</button>
    </div>
  );

  const renderTabNav = () => (
    <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--border)', marginBottom: 16 }}>
      {TABS.map((tab, i) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.key}
            onClick={() => setActiveTab(i)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 16px', fontSize: 12, fontWeight: activeTab === i ? 600 : 400,
              color: activeTab === i ? 'var(--teal)' : 'var(--text-dim)',
              border: 'none', borderBottom: activeTab === i ? '2px solid var(--teal)' : '2px solid transparent',
              backgroundColor: 'transparent', cursor: 'pointer', marginBottom: -2,
              transition: 'color 0.15s, border-color 0.15s', whiteSpace: 'nowrap',
            }}
          >
            <Icon /> {tab.label}
          </button>
        );
      })}
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 0: return renderTicketVolume();
      case 1: return renderResolutionTime();
      case 2: return renderSlaCompliance();
      case 3: return renderProviderPerformance();
      case 4: return renderAiPerformance();
      default: return null;
    }
  };

  const renderTicketVolume = () => {
    const statusBarData = Object.entries(statusCounts).map(([status, count]) => ({ name: statusLabels[status] || status, count }));
    const last30Volume = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString();
      last30Volume.push({
        name: `${d.getDate()}/${d.getMonth() + 1}`,
        Created: filteredTickets.filter(t => new Date(t.createdAt).toLocaleDateString() === key).length,
      });
    }
    return (
    <div>
      <div className="chart-block">
        <div className="chart-block-title">Tickets by Status</div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={statusBarData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#5a8aaa' }} interval={0} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#5a8aaa' }} />
            <Tooltip contentStyle={CHART_TIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            <Bar dataKey="count" name="Tickets" fill={COLORS.teal} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-block">
        <div className="chart-block-title">Tickets Opened — Last 30 Days</div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={last30Volume} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="adminVolGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.teal} stopOpacity={0.35} />
                <stop offset="100%" stopColor={COLORS.teal} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#5a8aaa' }} interval={4} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#5a8aaa' }} />
            <Tooltip contentStyle={CHART_TIP_STYLE} />
            <Area type="monotone" dataKey="Created" stroke={COLORS.teal} fill="url(#adminVolGrad)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <h4 style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-dim)' }}>Ticket Volume — Counts per Status</h4>
      <div style={{ display: 'flex', gap: 16, alignItems: 'end', minHeight: 160, padding: '12px 0', flexWrap: 'wrap' }}>
        {Object.entries(statusLabels).map(([status, label]) => {
          const count = statusCounts[status] || 0;
          const pct = maxCount > 0 ? (count / maxCount * 100) : 0;
          return (
            <div key={status} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 60 }}>
              <span style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{count}</span>
              <div
                style={{
                  width: 40, height: Math.max(pct * 1.2, 4), borderRadius: '4px 4px 0 0',
                  backgroundColor: pct > 75 ? 'var(--teal)' : pct > 50 ? 'var(--amber)' : 'var(--info)',
                  transition: 'height 0.3s', minHeight: 4,
                }}
              />
              <span style={{ fontSize: 10, marginTop: 6, color: 'var(--text-dim)', textAlign: 'center' }}>{label}</span>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', padding: '8px 0', borderTop: '1px solid var(--border)', marginTop: 8 }}>
        <FaChartBar /> Period-over-period comparison: Current period shows <strong>{filteredTickets.length}</strong> total tickets.
        <span style={{ marginLeft: 8, color: 'var(--teal)' }}>+12% vs previous period (mock data)</span>
      </div>
    </div>
    );
  };

  const renderResolutionTime = () => {
    const resChartData = resolutionData.map(r => ({
      name: r.priority,
      hours: r.avg != null ? +(r.avg / 60).toFixed(1) : 0,
      Resolved: r.count,
    }));
    return (
    <div>
      <h4 style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-dim)' }}>Average Resolution Time per Priority</h4>
      <div className="chart-block">
        <div className="chart-block-title">Avg Hours to Resolve by Priority</div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={resChartData} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#5a8aaa' }} interval={0} />
            <YAxis tick={{ fontSize: 10, fill: '#5a8aaa' }} />
            <Tooltip contentStyle={CHART_TIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            <Bar dataKey="hours" name="Avg hours" fill={COLORS.teal} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        {resolutionData.map(r => (
          <div key={r.priority} className="stat-card" style={{ flex: '1 0 auto', minWidth: 120 }}>
            <div className="stat-value" style={{ fontSize: 14, color: r.priority === 'URGENT' ? 'var(--danger)' : 'inherit' }}>
              {r.priority}: {r.avg != null ? formatMinutes(r.avg) : '—'}
            </div>
            <div className="stat-label">{r.priority} Avg Resolution</div>
          </div>
        ))}
      </div>
      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Priority</th>
              <th>Target Resolution</th>
              <th>Actual Avg</th>
              <th>Compliance %</th>
              <th>Tickets</th>
            </tr>
          </thead>
          <tbody>
            {resolutionData.length === 0 ? (
              <tr><td colSpan="5" className="empty-text" style={{ textAlign: 'center', padding: 24 }}>No data for current filters.</td></tr>
            ) : (
              resolutionData.map(r => (
                <tr key={r.priority}>
                  <td><strong>{r.priority}</strong></td>
                  <td className="cell-mono">{r.target ? formatMinutes(r.target) : '—'}</td>
                  <td className="cell-mono">{r.avg != null ? formatMinutes(r.avg) : '—'}</td>
                  <td>
                    <span style={{ color: r.compliance !== '—' && parseFloat(r.compliance) < 80 ? 'var(--danger)' : 'var(--teal)', fontWeight: 600 }}>
                      {r.compliance !== '—' ? `${r.compliance}%` : '—'}
                    </span>
                  </td>
                  <td className="cell-mono">{r.count}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
    );
  };

  const renderSlaCompliance = () => {
    const slaChartData = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'].map(p => {
      const pt = filteredTickets.filter(t => t.priority === p);
      const breached = pt.filter(t => getSlaStatus(t)?.state === 'breached').length;
      const warning = pt.filter(t => getSlaStatus(t)?.state === 'warning').length;
      return { name: p, Compliant: Math.max(pt.length - breached - warning, 0), Warning: warning, Breached: breached };
    });
    const slaTotals = slaChartData.reduce((acc, d) => ({
      compliant: acc.compliant + d.Compliant,
      warning: acc.warning + d.Warning,
      breached: acc.breached + d.Breached,
    }), { compliant: 0, warning: 0, breached: 0 });
    const slaPie = [
      { name: 'Compliant', value: slaTotals.compliant, color: COLORS.teal },
      { name: 'Warning', value: slaTotals.warning, color: COLORS.amber },
      { name: 'Breached', value: slaTotals.breached, color: COLORS.red },
    ].filter(d => d.value > 0);
    return (
    <div>
      <div className="chart-block">
        <div className="chart-block-title">Compliance Status by Priority</div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={slaChartData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
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
      {slaPie.length > 0 && (
        <div className="chart-block">
          <div className="chart-block-title">Overall SLA Compliance</div>
          <ResponsiveContainer width="100%" height={230}>
            <PieChart>
              <Pie data={slaPie} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3} label={({ name, value }) => `${name}: ${value}`}>
                {slaPie.map(entry => <Cell key={entry.name} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={CHART_TIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <div className="stat-card">
          <div className="stat-value" style={{ fontSize: 28, color: parseFloat(overallCompliance) >= 80 ? 'var(--teal)' : 'var(--amber)' }}>
            {overallCompliance}%
          </div>
          <div className="stat-label">Overall SLA Compliance Rate</div>
        </div>
      </div>
      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Priority</th>
              <th>Target Response</th>
              <th>Response Compliance</th>
              <th>Target Resolution</th>
              <th>Resolution Compliance</th>
              <th>Total Tickets</th>
            </tr>
          </thead>
          <tbody>
            {slaData.length === 0 ? (
              <tr><td colSpan="6" className="empty-text" style={{ textAlign: 'center', padding: 24 }}>No data for current filters.</td></tr>
            ) : (
              slaData.map(r => {
                const warnResponse = r.responseRate !== '—' && parseFloat(r.responseRate) < (r.sla?.warningPercent ?? 80);
                const warnResolution = r.resolutionRate !== '—' && parseFloat(r.resolutionRate) < (r.sla?.warningPercent ?? 80);
                const isWarning = warnResponse || warnResolution;
                return (
                  <tr key={r.priority} style={isWarning ? { backgroundColor: 'rgba(255, 191, 0, 0.08)' } : {}}>
                    <td><strong>{r.priority}</strong></td>
                    <td className="cell-mono">{r.sla ? formatMinutes(r.sla.responseMinutes) : '—'}</td>
                    <td>
                      <span style={{
                        color: warnResponse ? 'var(--amber)' : 'var(--teal)',
                        fontWeight: warnResponse ? 700 : 400,
                      }}>
                        {r.responseRate}{r.responseRate !== '—' ? '%' : ''}
                        {warnResponse && <FaClock style={{ marginLeft: 4 }} title="Below warning threshold" />}
                      </span>
                    </td>
                    <td className="cell-mono">{r.sla ? formatMinutes(r.sla.resolutionMinutes) : '—'}</td>
                    <td>
                      <span style={{
                        color: warnResolution ? 'var(--amber)' : 'var(--teal)',
                        fontWeight: warnResolution ? 700 : 400,
                      }}>
                        {r.resolutionRate}{r.resolutionRate !== '—' ? '%' : ''}
                        {warnResolution && <FaClock style={{ marginLeft: 4 }} title="Below warning threshold" />}
                      </span>
                    </td>
                    <td className="cell-mono">{r.total}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
    );
  };

  const renderProviderPerformance = () => {
    const provChartData = providerStats.map(p => ({
      name: shortName(p.name),
      Assigned: p.totalJobs,
      Completed: p.resolvedJobs,
    }));
    return (
    <div>
      <h4 style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-dim)' }}>Provider Performance Metrics <span className="req-ref">MOD-010 / REQ-051-056</span></h4>
      <div className="chart-block">
        <div className="chart-block-title">Assigned vs Completed by Provider</div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={provChartData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
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
      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              {[
                { key: 'name', label: 'Provider' },
                { key: 'totalJobs', label: 'Total Jobs' },
                { key: 'rating', label: 'Avg Rating' },
                { key: 'onTimePct', label: 'On-Time %' },
                { key: 'currentWorkload', label: 'Workload' },
              ].map(col => (
                <th
                  key={col.key}
                  onClick={() => toggleSort(col.key)}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  {col.label} {sortColumn === col.key ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedProviders.length === 0 ? (
              <tr><td colSpan="5" className="empty-text" style={{ textAlign: 'center', padding: 24 }}>No providers match the current filters.</td></tr>
            ) : (
              sortedProviders.map(p => {
                const lowRating = p.rating < 2.0;
                return (
                  <tr key={p.id} style={lowRating ? { backgroundColor: 'rgba(220, 53, 69, 0.06)' } : {}}>
                    <td>
                      <strong>{p.name}</strong>
                      {lowRating && (
                        <FaStar style={{ color: 'var(--danger)', marginLeft: 6, cursor: 'help' }} title="Rating below 2.0 — underperforming" />
                      )}
                    </td>
                    <td className="cell-mono">{p.totalJobs}</td>
                    <td>
                      <FaStar style={{ color: lowRating ? 'var(--danger)' : 'var(--amber)', marginRight: 4 }} />
                      {p.rating.toFixed(1)}
                    </td>
                    <td className="cell-mono">{p.onTimePct !== '—' ? `${p.onTimePct}%` : '—'}</td>
                    <td className="cell-mono">{p.currentWorkload}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
    );
  };

  const renderAiPerformance = () => {
    const aiPie = [
      { name: 'AI Correct', value: Math.max(filteredTickets.length - overrideCount - conflictCount - manualReviewCount, 0), color: COLORS.teal },
      { name: 'Override', value: overrideCount, color: COLORS.amber },
      { name: 'Conflict', value: conflictCount, color: COLORS.red },
      { name: 'Manual Review', value: manualReviewCount, color: COLORS.purple },
    ].filter(d => d.value > 0);
    const aiCats = [...new Set(filteredTickets.filter(t => t.category).map(t => t.category))];
    const aiByCat = aiCats.map(c => {
      const ct = filteredTickets.filter(t => t.category === c);
      const ov = ct.filter(t => t.aiOriginalCategory && t.aiOriginalCategory !== t.category).length;
      const cf = ct.filter(t => t.conflictDetected).length;
      const mv = ct.filter(t => t.manualReviewRequired).length;
      return { name: c, 'AI Correct': Math.max(ct.length - ov - cf - mv, 0), Override: ov, Conflict: cf, Review: mv };
    });
    return (
    <div>
      <h4 style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-dim)' }}>AI Performance Metrics <span className="req-ref">MOD-010 / REQ-051-056</span></h4>
      <div className="chart-block">
        <div className="chart-block-title">AI Classification Outcomes</div>
        {aiPie.length > 0 ? (
          <ResponsiveContainer width="100%" height={230}>
            <PieChart>
              <Pie data={aiPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} paddingAngle={3} label={({ name, value }) => `${name}: ${value}`}>
                {aiPie.map(entry => <Cell key={entry.name} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={CHART_TIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="empty-text" style={{ padding: 16 }}>No classification data for current filters.</div>
        )}
      </div>
      {aiByCat.length > 0 && (
        <div className="chart-block">
          <div className="chart-block-title">Outcomes by Category</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={aiByCat} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
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
      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <div className="stat-card">
          <div className="stat-value">{overrideCount}</div>
          <div className="stat-label">Category Overrides (BR-006)</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {filteredTickets.length > 0 ? `${(conflictCount / filteredTickets.length * 100).toFixed(1)}%` : '—'}
          </div>
          <div className="stat-label">Conflict Detection Rate (REQ-055)</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {filteredTickets.length > 0 ? `${(manualReviewCount / filteredTickets.length * 100).toFixed(1)}%` : '—'}
          </div>
          <div className="stat-label">Manual Review Rate</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{avgConfidence}</div>
          <div className="stat-label">Avg Combined Confidence</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ flex: '1 1 300px', minWidth: 260 }}>
          <h5 style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--text-dim)' }}>Overrides by Category Pair (REQ-055)</h5>
          <table className="admin-table">
            <thead>
              <tr>
                <th>AI → Override</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              {overrideByCategory.length === 0 ? (
                <tr><td colSpan="2" className="empty-text" style={{ textAlign: 'center', padding: 16, fontSize: 11 }}>No overrides.</td></tr>
              ) : (
                overrideByCategory.map(([pair, count]) => (
                  <tr key={pair}>
                    <td style={{ fontSize: 11 }}>{pair}</td>
                    <td className="cell-mono" style={{ color: 'var(--amber)', fontWeight: 600 }}>{count}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div style={{ flex: '1 1 300px', minWidth: 260 }}>
          <h5 style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--text-dim)' }}>Conflicts by Category</h5>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Conflicts</th>
              </tr>
            </thead>
            <tbody>
              {conflictByCategory.length === 0 ? (
                <tr><td colSpan="2" className="empty-text" style={{ textAlign: 'center', padding: 16, fontSize: 11 }}>No conflicts.</td></tr>
              ) : (
                conflictByCategory.map(([cat, count]) => (
                  <tr key={cat}>
                    <td style={{ fontSize: 11 }}>{cat}</td>
                    <td className="cell-mono" style={{ color: 'var(--danger)', fontWeight: 600 }}>{count}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <h5 style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--text-dim)' }}>Adapter Performance</h5>
      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Adapter</th>
              <th>Calls</th>
              <th>Avg Latency (ms)</th>
              <th>Avg Confidence</th>
            </tr>
          </thead>
          <tbody>
            {adapterStats.length === 0 ? (
              <tr><td colSpan="4" className="empty-text" style={{ textAlign: 'center', padding: 24 }}>No inference data available.</td></tr>
            ) : (
              adapterStats.map(a => (
                <tr key={a.adapter}>
                  <td><strong>{a.adapter}</strong></td>
                  <td className="cell-mono">{a.calls}</td>
                  <td className="cell-mono">{a.avgLatency}</td>
                  <td className="cell-mono">{a.avgConfidence}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
    );
  };

  return (
    <div>
      <div className="card">
        <div className="card-title">
          <span><FaFileExport /> Reports <span className="req-ref">MOD-010 / REQ-051-056</span></span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: 'var(--text-dim)' }}>
            <span>Synced {lastSync.toLocaleTimeString()}</span>
            <button className="btn btn-secondary btn-sm" onClick={handleSync} disabled={syncing}>
              <FaSync style={{ marginRight: 4 }} />{syncing ? 'Syncing...' : 'Refresh'}
            </button>
            <button className="btn btn-teal btn-sm" onClick={handleGenerateReport}>
              <FaDownload /> Generate PDF
            </button>
          </div>
        </div>
        {renderFilters()}
        {renderTabNav()}
        {renderTabContent()}
        {showExportNote && exportExpiry && (
          <div style={{
            marginTop: 16, padding: 12, borderRadius: 6,
            backgroundColor: countdown === 'EXPIRED' ? 'rgba(220, 60, 60, 0.08)' : 'rgba(0, 188, 212, 0.08)',
            border: countdown === 'EXPIRED' ? '1px solid rgba(220, 60, 60, 0.2)' : '1px solid rgba(0, 188, 212, 0.2)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            fontSize: 12,
          }}>
            <span>
              <FaDownload style={{ marginRight: 6 }} />
              <strong>PDF Generated</strong> —{' '}
              {countdown === 'EXPIRED' ? (
                <span style={{ color: 'var(--danger)' }}>Link expired (S3 pre-signed URL — REQ-056)</span>
              ) : (
                <span>S3 pre-signed download URL — expires in <strong style={{ fontFamily: 'monospace', color: 'var(--teal)' }}>{countdown}</strong> (REQ-056)</span>
              )}
            </span>
            <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="btn btn-secondary btn-sm" onClick={generatePdf} style={{ fontSize: 10 }}>
                <FaDownload /> Download Again
              </button>
              <span style={{ color: 'var(--text-dim)', fontFamily: 'monospace', fontSize: 11 }}>
                {countdown === 'EXPIRED' ? 'EXPIRED' : new Date(exportExpiry).toLocaleString()}
              </span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;

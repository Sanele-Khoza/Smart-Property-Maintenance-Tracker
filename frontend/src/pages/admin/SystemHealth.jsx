import React, { useMemo } from 'react';
import {
  FaServer, FaDatabase, FaBrain, FaExclamationTriangle, FaClock, FaCheckCircle,
  FaTimesCircle, FaExclamationCircle, FaHourglassHalf, FaAws, FaChartLine,
  FaChevronRight, FaRedo, FaPlug, FaMicrochip, FaCamera,
} from 'react-icons/fa';

const now = Date.now();
const day = 86400000;

const UPTIME_HISTORY = [
  { label: '24h ago', api: 99.98, db: 99.99, comprehend: 99.97, rekognition: 99.95 },
  { label: '12h ago', api: 99.99, db: 99.98, comprehend: 99.88, rekognition: 99.92 },
  { label: '6h ago', api: 99.97, db: 99.99, comprehend: 99.95, rekognition: 99.97 },
  { label: '3h ago', api: 99.99, db: 100.0, comprehend: 99.99, rekognition: 99.88 },
  { label: '1h ago', api: 100.0, db: 99.99, comprehend: 99.96, rekognition: 99.93 },
  { label: 'Now', api: 99.98, db: 99.99, comprehend: 99.94, rekognition: 99.91 },
];

const SystemHealth = () => {
  const slaPollSetting = useMemo(() => {
    try {
      const raw = localStorage.getItem('spmt_data');
      if (!raw) return { interval: 5 };
      const parsed = JSON.parse(raw);
      const setting = parsed.systemSettings?.find(s => s.key === 'SLA_POLL_INTERVAL_MINUTES');
      return { interval: setting ? parseInt(setting.value, 10) : 5 };
    } catch { return { interval: 5 }; }
  }, []);

  const dbPool = useMemo(() => {
    try {
      const raw = localStorage.getItem('spmt_data');
      if (!raw) return { min: 2, max: 10, active: 5, waiting: 1 };
      const parsed = JSON.parse(raw);
      const min = parseInt(parsed.systemSettings?.find(s => s.key === 'DB_POOL_MIN_CONNECTIONS')?.value || 2, 10);
      const max = parseInt(parsed.systemSettings?.find(s => s.key === 'DB_POOL_MAX_CONNECTIONS')?.value || 10, 10);
      const active = Math.floor(min + (max - min) * (0.35 + Math.random() * 0.25));
      const waiting = Math.floor(Math.random() * 2);
      return { min, max, active, waiting };
    } catch { return { min: 2, max: 10, active: 5, waiting: 1 }; }
  }, []);

  const aiMetrics = useMemo(() => {
    try {
      const raw = localStorage.getItem('spmt_data');
      if (!raw) return { comprehend: { status: 'up', avgLatencyMs: 280, totalCalls: 0, errorRatePct: 0 }, rekognition: { status: 'up', avgLatencyMs: 890, totalCalls: 0, errorRatePct: 0 }, fallbackActive: false };
      const parsed = JSON.parse(raw);
      const logs = parsed.aiInferenceLog || [];
      const comprehendLogs = logs.filter(l => l.adapter === 'Comprehend');
      const rekognitionLogs = logs.filter(l => l.adapter === 'Rekognition');

      const avgLatency = (logs) => logs.length > 0 ? (logs.reduce((s, l) => s + (l.latencyMs || 0), 0) / logs.length) : 0;
      const errorRate = (logs) => {
        if (logs.length === 0) return 0;
        // Simulate some errors for realism: count confidence < 0.30 as "failed"
        const failed = logs.filter(l => (l.confidence || 0) < 0.30).length;
        return (failed / logs.length) * 100;
      };

      // Determine service health based on recent log data and simulated availability
      const compHealth = comprehendLogs.length > 2 ? 'up' : 'degraded';
      const rekogHealth = rekognitionLogs.length > 1 ? 'up' : 'degraded';
      // Simulate Rekognition having a brief hiccup for realism
      const rekogActual = rekogHealth === 'up' && Math.random() > 0.85 ? 'degraded' : rekogHealth;

      return {
        comprehend: {
          status: compHealth,
          avgLatencyMs: Math.round(avgLatency(comprehendLogs)),
          totalCalls: comprehendLogs.length,
          errorRatePct: Math.round(errorRate(comprehendLogs) * 100) / 100,
        },
        rekognition: {
          status: rekogActual,
          avgLatencyMs: Math.round(avgLatency(rekognitionLogs)),
          totalCalls: rekognitionLogs.length,
          errorRatePct: Math.round(errorRate(rekognitionLogs) * 100) / 100,
        },
        fallbackActive: compHealth !== 'up' && rekogActual !== 'up',
      };
    } catch {
      return {
        comprehend: { status: 'up', avgLatencyMs: 280, totalCalls: 12, errorRatePct: 0 },
        rekognition: { status: 'up', avgLatencyMs: 890, totalCalls: 6, errorRatePct: 0 },
        fallbackActive: false,
      };
    }
  }, []);

  const errorMetrics = useMemo(() => {
    try {
      const raw = localStorage.getItem('spmt_data');
      if (!raw) return { totalEvents: 0, failedEvents: 0, errorRate: 0, hourlyFails: [0, 0, 0, 0, 0, 0] };
      const parsed = JSON.parse(raw);
      const secLogs = parsed.securityAuditLog || [];
      const fails = secLogs.filter(l => l.eventType === 'LOGIN_FAIL' || l.eventType === 'ACCOUNT_LOCKED').length;
      const total = secLogs.length || 1;
      const errorRate = (fails / total) * 100;

      const hourlyFails = [];
      for (let h = 5; h >= 0; h--) {
        const start = now - (h + 1) * 3600000;
        const end = now - h * 3600000;
        const count = secLogs.filter(l => {
          const t = new Date(l.timestamp).getTime();
          return (l.eventType === 'LOGIN_FAIL' || l.eventType === 'ACCOUNT_LOCKED') && t >= start && t < end;
        }).length;
        hourlyFails.push(count);
      }

      return {
        totalEvents: total,
        failedEvents: fails,
        errorRate: Math.round(errorRate * 100) / 100,
        hourlyFails,
      };
    } catch { return { totalEvents: 8, failedEvents: 2, errorRate: 25, hourlyFails: [0, 1, 0, 0, 1, 0] }; }
  }, []);

  const slaPoller = useMemo(() => {
    const interval = slaPollSetting.interval;
    const lastPoll = now - ((Math.random() * 0.8 + 0.1) * interval * 60000);
    const stalled = (now - lastPoll) > interval * 60000 * 1.5;
    const nextPoll = lastPoll + interval * 60000;
    return { interval, lastPoll, stalled, nextPoll };
  }, [slaPollSetting.interval]);

  const apiVersion = 'v2.1.0';
  const region = 'us-east-1';

  const getStatusIcon = (status) => {
    if (status === 'up') return <FaCheckCircle style={{ color: 'var(--teal)' }} />;
    if (status === 'degraded') return <FaExclamationCircle style={{ color: 'var(--amber)' }} />;
    return <FaTimesCircle style={{ color: 'var(--danger)' }} />;
  };

  const getStatusText = (status) => {
    if (status === 'up') return 'Operational';
    if (status === 'degraded') return 'Degraded';
    return 'Down';
  };

  const getStatusClass = (status) => {
    if (status === 'up') return { backgroundColor: 'rgba(45,183,145,0.15)', color: 'var(--teal)' };
    if (status === 'degraded') return { backgroundColor: 'rgba(243,156,18,0.15)', color: 'var(--amber)' };
    return { backgroundColor: 'rgba(192,57,43,0.15)', color: 'var(--danger)' };
  };

  const formatTimeAgo = (ts) => {
    const diff = now - ts;
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return `${Math.floor(diff / 3600000)}h ago`;
  };

  const formatTime = (ts) => new Date(ts).toLocaleTimeString();

  return (
    <div>
      <div className="card">
        <div className="card-title">
          <span><FaServer /> System Health Dashboard <span className="req-ref">NFR-R01 · NFR-R03</span></span>
          <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-dim)' }}>API v{apiVersion} · {region}</span>
        </div>
      </div>

      {/* AI Services + DB row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        {/* Infrastructure: API + DB */}
        <div className="card">
          <div className="card-title" style={{ fontSize: 13 }}><FaAws /> Infrastructure</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* API Server */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FaPlug style={{ color: 'var(--text-dim)', fontSize: 14 }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>API Server</div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>REST · Express · {apiVersion}</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={getStatusClass('up')} className="status-badge-sm">{getStatusIcon('up')} Operational</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>99.98% uptime</div>
              </div>
            </div>

            {/* Database */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FaDatabase style={{ color: 'var(--text-dim)', fontSize: 14 }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>Database (RDS SQL Server 2022)</div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>db.t3.medium · 20 GiB</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={getStatusClass('up')} className="status-badge-sm">{getStatusIcon('up')} Operational</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>99.99% uptime</div>
              </div>
            </div>
          </div>
        </div>

        {/* AI Services */}
        <div className="card">
          <div className="card-title" style={{ fontSize: 13 }}><FaBrain /> AI Services</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Comprehend */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FaMicrochip style={{ color: 'var(--text-dim)', fontSize: 14 }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>Comprehend (Text)</div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                    {aiMetrics.comprehend.totalCalls} calls · avg {aiMetrics.comprehend.avgLatencyMs}ms
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={getStatusClass(aiMetrics.comprehend.status)} className="status-badge-sm">
                  {getStatusIcon(aiMetrics.comprehend.status)} {getStatusText(aiMetrics.comprehend.status)}
                </div>
              </div>
            </div>

            {/* Rekognition */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FaCamera style={{ color: 'var(--text-dim)', fontSize: 14 }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>Rekognition (Image)</div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                    {aiMetrics.rekognition.totalCalls} calls · avg {aiMetrics.rekognition.avgLatencyMs}ms
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={getStatusClass(aiMetrics.rekognition.status)} className="status-badge-sm">
                  {getStatusIcon(aiMetrics.rekognition.status)} {getStatusText(aiMetrics.rekognition.status)}
                </div>
              </div>
            </div>

            {/* Fallback indicator */}
            <div style={{
              padding: '6px 10px', borderRadius: 4, fontSize: 10, marginTop: 2,
              backgroundColor: aiMetrics.fallbackActive ? 'rgba(192,57,43,0.08)' : 'rgba(45,183,145,0.05)',
              border: `1px solid ${aiMetrics.fallbackActive ? 'rgba(192,57,43,0.2)' : 'rgba(45,183,145,0.15)'}`,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {aiMetrics.fallbackActive
                ? <><FaExclamationTriangle style={{ color: 'var(--danger)', fontSize: 11 }} /> <strong>Fallback Active:</strong> Both AI services degraded — tickets routed to Manual Review (NFR-R03)</>
                : <><FaCheckCircle style={{ color: 'var(--teal)', fontSize: 11 }} /> <strong>Graceful Fallback</strong> — if both AI services fail, classification defers to Manual Review (NFR-R03)</>
              }
            </div>
          </div>
        </div>
      </div>

      {/* DB Pool + Error Rate + SLA Poller row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
        {/* DB Connection Pool */}
        <div className="card">
          <div className="card-title" style={{ fontSize: 12 }}>
            <span><FaDatabase style={{ fontSize: 12 }} /> DB Connection Pool</span>
            <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-dim)' }}>
              {dbPool.active} active · {dbPool.waiting} waiting
            </span>
          </div>
          <div style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-dim)', marginBottom: 3 }}>
              <span>Usage</span>
              <span>{dbPool.active}/{dbPool.max}</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 4,
                backgroundColor: dbPool.active / dbPool.max > 0.75 ? 'var(--amber)' : dbPool.active / dbPool.max > 0.9 ? 'var(--danger)' : 'var(--teal)',
                width: `${(dbPool.active / dbPool.max) * 100}%`,
                transition: 'width 0.5s',
              }} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-dim)' }}>
            <span>Pool config: {dbPool.min}–{dbPool.max}</span>
            <span>Idle: {dbPool.max - dbPool.active - dbPool.waiting}</span>
          </div>
          {dbPool.active / dbPool.max > 0.85 && (
            <div style={{ marginTop: 6, padding: '4px 8px', backgroundColor: 'rgba(243,156,18,0.1)', borderRadius: 3, fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
              <FaExclamationTriangle style={{ color: 'var(--amber)', fontSize: 10 }} />
              Pool utilization high — consider scaling up
            </div>
          )}
        </div>

        {/* Error Rate (CloudWatch-style) */}
        <div className="card">
          <div className="card-title" style={{ fontSize: 12 }}>
            <span><FaChartLine style={{ fontSize: 12 }} /> Error Rate</span>
            <span style={{
              fontSize: 11, fontWeight: 600,
              color: errorMetrics.errorRate > 15 ? 'var(--danger)' : errorMetrics.errorRate > 5 ? 'var(--amber)' : 'var(--teal)',
            }}>{errorMetrics.errorRate}%</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 40, marginBottom: 6 }}>
            {errorMetrics.hourlyFails.map((count, i) => {
              const maxVal = Math.max(...errorMetrics.hourlyFails, 1);
              return (
                <div key={i} style={{
                  flex: 1, height: `${(count / maxVal) * 100}%`, minHeight: count > 0 ? 8 : 2,
                  borderRadius: '2px 2px 0 0',
                  backgroundColor: count > 2 ? 'var(--danger)' : count > 0 ? 'var(--amber)' : 'rgba(255,255,255,0.08)',
                  transition: 'height 0.3s',
                }} title={`Hour ${5 - i}: ${count} failures`} />
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-dim)' }}>
            <span>-5h</span>
            <span>Now</span>
          </div>
          <div style={{ marginTop: 4, fontSize: 10, color: 'var(--text-dim)', display: 'flex', justifyContent: 'space-between' }}>
            <span>{errorMetrics.failedEvents} failed / {errorMetrics.totalEvents} total events</span>
            <span>{errorMetrics.errorRate > 10 ? '⚠️ Elevated' : '✓ Normal'}</span>
          </div>
        </div>

        {/* SLA Cron Poller */}
        <div className="card">
          <div className="card-title" style={{ fontSize: 12 }}>
            <span><FaClock style={{ fontSize: 12 }} /> SLA Cron Poller</span>
            <span style={{
              fontSize: 10, fontWeight: 400,
              display: 'flex', alignItems: 'center', gap: 4,
              color: slaPoller.stalled ? 'var(--danger)' : 'var(--teal)',
            }}>
              <FaRedo style={{ fontSize: 9 }} />
              {slaPoller.interval}m interval
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
              <span style={{ color: 'var(--text-dim)' }}>Last Poll</span>
              <span style={{ fontWeight: 600 }}>{formatTime(slaPoller.lastPoll)} ({formatTimeAgo(slaPoller.lastPoll)})</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
              <span style={{ color: 'var(--text-dim)' }}>Next Poll</span>
              <span style={{ fontWeight: 600 }}>{formatTime(slaPoller.nextPoll)}</span>
            </div>
            <div style={{ marginTop: 4 }}>
              <div style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden', position: 'relative' }}>
                <div style={{
                  height: '100%', borderRadius: 3,
                  backgroundColor: slaPoller.stalled ? 'var(--danger)' : 'var(--teal)',
                  width: `${Math.min(100, ((now - slaPoller.lastPoll) / (slaPoller.interval * 60000)) * 100)}%`,
                  transition: 'width 1s',
                }} />
              </div>
            </div>
            {slaPoller.stalled && (
              <div style={{
                padding: '4px 8px', marginTop: 4, borderRadius: 3, fontSize: 10,
                backgroundColor: 'rgba(192,57,43,0.1)',
                display: 'flex', alignItems: 'center', gap: 4, color: 'var(--danger)',
              }}>
                <FaExclamationTriangle style={{ fontSize: 10 }} />
                Poller stalled — last poll exceeded {slaPoller.interval * 1.5}m threshold
              </div>
            )}
            {!slaPoller.stalled && (
              <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>
                {now - slaPoller.lastPoll < 60000
                  ? 'Polling is current'
                  : `${slaPoller.interval}m poll cycle is healthy`
                }
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Uptime History */}
      <div className="card">
        <div className="card-title" style={{ fontSize: 13 }}><FaChartLine /> Uptime History (Last 24h)</div>
        <table className="data-table" style={{ fontSize: 11 }}>
          <thead>
            <tr>
              <th>Time</th>
              <th>API Server</th>
              <th>Database</th>
              <th>Comprehend</th>
              <th>Rekognition</th>
            </tr>
          </thead>
          <tbody>
            {UPTIME_HISTORY.map((row, i) => (
              <tr key={i}>
                <td style={{ color: 'var(--text-dim)' }}>{row.label}</td>
                <td style={{
                  color: row.api >= 99.99 ? 'var(--teal)' : row.api >= 99.90 ? 'var(--amber)' : 'var(--danger)',
                  fontWeight: 600,
                }}>{row.api}%</td>
                <td style={{
                  color: row.db >= 99.99 ? 'var(--teal)' : row.db >= 99.90 ? 'var(--amber)' : 'var(--danger)',
                  fontWeight: 600,
                }}>{row.db}%</td>
                <td style={{
                  color: row.comprehend >= 99.90 ? 'var(--teal)' : row.comprehend >= 99.50 ? 'var(--amber)' : 'var(--danger)',
                  fontWeight: 600,
                }}>{row.comprehend}%</td>
                <td style={{
                  color: row.rekognition >= 99.90 ? 'var(--teal)' : row.rekognition >= 99.50 ? 'var(--amber)' : 'var(--danger)',
                  fontWeight: 600,
                }}>{row.rekognition}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Services Summary Row */}
      <div className="card">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, fontSize: 11 }}>
          <div style={{ padding: '8px 10px', backgroundColor: 'rgba(45,183,145,0.05)', borderRadius: 4 }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Services</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--teal)', margin: '2px 0' }}>4/4</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>All operational</div>
          </div>
          <div style={{ padding: '8px 10px', backgroundColor: 'rgba(45,183,145,0.05)', borderRadius: 4 }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Infra Uptime (30d)</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--teal)', margin: '2px 0' }}>99.98%</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>API + DB average</div>
          </div>
          <div style={{ padding: '8px 10px', backgroundColor: 'rgba(243,156,18,0.05)', borderRadius: 4 }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>AI Avg Latency</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--amber)', margin: '2px 0' }}>
              {Math.round((aiMetrics.comprehend.avgLatencyMs + aiMetrics.rekognition.avgLatencyMs) / 2)}ms
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Comprehend + Rekognition</div>
          </div>
          <div style={{ padding: '8px 10px', backgroundColor: slaPoller.stalled ? 'rgba(192,57,43,0.05)' : 'rgba(45,183,145,0.05)', borderRadius: 4 }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>SLA Poller</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: slaPoller.stalled ? 'var(--danger)' : 'var(--teal)', margin: '2px 0' }}>
              {slaPoller.stalled ? 'STALLED' : formatTimeAgo(slaPoller.lastPoll)}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
              {slaPoller.stalled ? 'Manual review needed' : 'Running normally'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemHealth;

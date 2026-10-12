import React, { useState, useEffect, useCallback } from 'react';
import {
  FaServer, FaDatabase, FaBrain, FaExclamationTriangle, FaClock, FaCheckCircle,
  FaTimesCircle, FaExclamationCircle, FaRedo, FaPlug, FaMicrochip,
  FaShieldAlt,
} from 'react-icons/fa';
import { api } from '../../api/client';

const fmtUptime = (s) => {
  if (s === null || s === undefined) return '—';
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
};

const timeAgo = (iso) => {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return `${Math.max(0, Math.floor(diff / 1000))}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
};

const serviceActive = (lastAt) => {
  if (!lastAt) return false;
  return Date.now() - new Date(lastAt).getTime() < 7 * 86400000;
};

const SystemHealth = () => {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api('/system/health', { timeout: 30000 });
      setHealth(result.data || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const getStatusIcon = (status) => {
    if (status === 'up') return <FaCheckCircle style={{ color: 'var(--teal)' }} />;
    if (status === 'degraded' || status === 'idle') return <FaExclamationCircle style={{ color: 'var(--amber)' }} />;
    return <FaTimesCircle style={{ color: 'var(--danger)' }} />;
  };

  const getStatusText = (status) => {
    if (status === 'up') return 'Operational';
    if (status === 'degraded') return 'Degraded';
    if (status === 'idle') return 'Idle';
    return 'Down';
  };

  const getStatusClass = (status) => {
    if (status === 'up') return { backgroundColor: 'rgba(45,183,145,0.15)', color: 'var(--teal)' };
    if (status === 'degraded' || status === 'idle') return { backgroundColor: 'rgba(243,156,18,0.15)', color: 'var(--amber)' };
    return { backgroundColor: 'rgba(192,57,43,0.15)', color: 'var(--danger)' };
  };

  const apiStatus = health?.api?.status || 'down';
  const dbStatus = health?.db?.status || 'down';
  const pool = health?.db?.pool || { total: 0, idle: 0, waiting: 0 };
  const poolActive = Math.max(0, pool.total - pool.idle);
  const services = health?.ai?.services || [];
  const sla = health?.sla || null;
  const sec = health?.security || null;
  const servicesUp = [apiStatus, dbStatus].filter(s => s === 'up').length;

  return (
    <div>
      <div className="card">
        <div className="card-title">
          <span><FaServer /> System Health Dashboard <span className="req-ref">NFR-R01 · NFR-R03</span></span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-dim)' }}>
              {health ? `Updated ${timeAgo(health.timestamp)}` : ''}
            </span>
            <button className="btn btn-secondary btn-sm" onClick={load} disabled={loading}>
              <FaRedo /> {loading ? 'Checking…' : 'Refresh'}
            </button>
          </div>
        </div>
        {error && (
          <div style={{ padding: '8px 12px', borderRadius: 6, fontSize: 11, backgroundColor: 'rgba(220,60,60,0.08)', border: '1px solid rgba(220,60,60,0.2)' }}>
            Could not reach the health endpoint: {error}
          </div>
        )}
      </div>

      {/* AI Services + DB row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        {/* Infrastructure: API + DB (live) */}
        <div className="card">
          <div className="card-title" style={{ fontSize: 13 }}><FaServer /> Infrastructure</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FaPlug style={{ color: 'var(--text-dim)', fontSize: 14 }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>API Server</div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                    REST · Express{health?.api ? ` · up ${fmtUptime(health.api.uptimeSeconds)} · ${health.api.memoryMB} MB heap` : ''}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={getStatusClass(apiStatus)} className="status-badge-sm">{getStatusIcon(apiStatus)} {getStatusText(apiStatus)}</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FaDatabase style={{ color: 'var(--text-dim)', fontSize: 14 }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>Database ({health?.db?.version || 'PostgreSQL'})</div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                    {health?.db ? `${health.db.database} · ${health.db.size} · ${health.db.latencyMs}ms query` : 'unreachable'}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={getStatusClass(dbStatus)} className="status-badge-sm">{getStatusIcon(dbStatus)} {getStatusText(dbStatus)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* AI Services (live inference log) */}
        <div className="card">
          <div className="card-title" style={{ fontSize: 13 }}><FaBrain /> AI Services</div>
          {!health ? (
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{loading ? 'Loading…' : 'No data.'}</div>
          ) : services.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>No AI inferences recorded yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {services.map((s) => {
                const st = serviceActive(s.lastAt) ? 'up' : 'idle';
                return (
                  <div key={s.service} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <FaMicrochip style={{ color: 'var(--text-dim)', fontSize: 14 }} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{s.service}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                          {s.total} calls · {s.last24h} in 24h · avg conf {s.avgConfidence ?? '—'} · last {timeAgo(s.lastAt)}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={getStatusClass(st)} className="status-badge-sm">
                        {getStatusIcon(st)} {getStatusText(st)}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div style={{
                padding: '6px 10px', borderRadius: 4, fontSize: 10, marginTop: 2,
                backgroundColor: (health?.ai?.conflicts || 0) > 0 ? 'rgba(243,156,18,0.08)' : 'rgba(45,183,145,0.05)',
                border: `1px solid ${(health?.ai?.conflicts || 0) > 0 ? 'rgba(243,156,18,0.2)' : 'rgba(45,183,145,0.15)'}`,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                {(health?.ai?.conflicts || 0) > 0
                  ? <><FaExclamationTriangle style={{ color: 'var(--amber)', fontSize: 11 }} /> <strong>{health.ai.conflicts} conflicted</strong>&nbsp;classifications on record — review in AI Review (NFR-R03)</>
                  : <><FaCheckCircle style={{ color: 'var(--teal)', fontSize: 11 }} /> <strong>Graceful Fallback</strong> — if AI services fail, classification defers to Manual Review (NFR-R03)</>
                }
              </div>
            </div>
          )}
        </div>
      </div>

      {/* DB Pool + Security + SLA row (all live) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div className="card">
          <div className="card-title" style={{ fontSize: 12 }}>
            <span><FaDatabase style={{ fontSize: 12 }} /> DB Connection Pool</span>
            <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-dim)' }}>
              {poolActive} active · {pool.waiting} waiting
            </span>
          </div>
          <div style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-dim)', marginBottom: 3 }}>
              <span>Usage</span>
              <span>{pool.total} total connections</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 4,
                backgroundColor: 'var(--teal)',
                width: pool.total > 0 ? `${(poolActive / pool.total) * 100}%` : '0%',
                transition: 'width 0.5s',
              }} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-dim)' }}>
            <span>Idle: {pool.idle}</span>
            <span>Waiting: {pool.waiting}</span>
          </div>
        </div>

        <div className="card">
          <div className="card-title" style={{ fontSize: 12 }}>
            <span><FaShieldAlt style={{ fontSize: 12 }} /> Failed Logins (24h)</span>
            <span style={{
              fontSize: 11, fontWeight: 600,
              color: (sec?.failedLogins24h || 0) > 5 ? 'var(--danger)' : (sec?.failedLogins24h || 0) > 0 ? 'var(--amber)' : 'var(--teal)',
            }}>{sec ? sec.failedLogins24h : '—'}</span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <span>{sec ? `${sec.failedLogins24h} failed / ${sec.totalEvents24h} total security events` : 'No data.'}</span>
            <span>{(sec?.failedLogins24h || 0) > 5 ? '⚠️ Elevated' : '✓ Normal'}</span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 8 }}>
            Source: live security audit log, rolling 24-hour window.
          </div>
        </div>

        <div className="card">
          <div className="card-title" style={{ fontSize: 12 }}>
            <span><FaClock style={{ fontSize: 12 }} /> SLA Monitor</span>
            <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-dim)' }}>on-demand checks</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
              <span style={{ color: 'var(--text-dim)' }}>Breached open tickets</span>
              <span style={{ fontWeight: 700, color: (sla?.breachedOpen || 0) > 0 ? 'var(--danger)' : 'var(--teal)' }}>{sla ? sla.breachedOpen : '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
              <span style={{ color: 'var(--text-dim)' }}>Open tickets</span>
              <span style={{ fontWeight: 600 }}>{sla ? sla.openTickets : '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
              <span style={{ color: 'var(--text-dim)' }}>SLA rules configured</span>
              <span style={{ fontWeight: 600 }}>{sla ? sla.configCount : '—'}</span>
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>
              SLA is evaluated whenever tickets change — there is no background poller.
            </div>
          </div>
        </div>
      </div>

      {/* Summary Row */}
      <div className="card">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, fontSize: 11 }}>
          <div style={{ padding: '8px 10px', backgroundColor: 'rgba(45,183,145,0.05)', borderRadius: 4 }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Core Services</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: servicesUp === 2 ? 'var(--teal)' : 'var(--danger)', margin: '2px 0' }}>{servicesUp}/2</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>API + Database</div>
          </div>
          <div style={{ padding: '8px 10px', backgroundColor: 'rgba(45,183,145,0.05)', borderRadius: 4 }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>AI Inferences (24h)</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--teal)', margin: '2px 0' }}>{health?.ai ? health.ai.last24h : '—'}</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{health?.ai ? `${health.ai.total} total` : ''}</div>
          </div>
          <div style={{ padding: '8px 10px', backgroundColor: (sla?.breachedOpen || 0) > 0 ? 'rgba(192,57,43,0.05)' : 'rgba(45,183,145,0.05)', borderRadius: 4 }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>SLA Breaches Open</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: (sla?.breachedOpen || 0) > 0 ? 'var(--danger)' : 'var(--teal)', margin: '2px 0' }}>{sla ? sla.breachedOpen : '—'}</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Needs attention</div>
          </div>
          <div style={{ padding: '8px 10px', backgroundColor: 'rgba(45,183,145,0.05)', borderRadius: 4 }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>Database Size</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--teal)', margin: '2px 0' }}>{health?.db?.size || '—'}</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{health?.db ? `${health.db.latencyMs}ms query latency` : ''}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemHealth;

import React, { useState, useEffect, useMemo } from 'react';
import {
  FaStar, FaQuoteLeft, FaBuilding, FaBox, FaUser, FaWrench, FaCalendarAlt, FaSearch,
} from 'react-icons/fa';
import { api } from '../../api/client';

const RATING_COLORS = ['#c0392b', '#e67e22', '#f1c40f', '#2ecc71', '#27ae60'];

const Stars = ({ value, size = 16 }) => (
  <span style={{ color: 'var(--amber)', whiteSpace: 'nowrap' }}>
    {Array.from({ length: 5 }, (_, i) => (
      <FaStar key={i} style={{ fontSize: size, color: i < value ? 'var(--amber)' : 'var(--text-dim)', marginRight: 1 }} />
    ))}
  </span>
);

const RatingsList = ({ title = 'Ratings', subtitle = 'Individual ratings and comments.' }) => {
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [starFilter, setStarFilter] = useState(0);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api('/ratings')
      .then((result) => {
        if (cancelled) return;
        setRatings(Array.isArray(result.data) ? result.data : []);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'Failed to load ratings.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const stats = useMemo(() => {
    const total = ratings.length;
    const scored = ratings.filter(r => r.rating >= 1 && r.rating <= 5);
    const avg = scored.length
      ? scored.reduce((s, r) => s + r.rating, 0) / scored.length
      : null;
    const commented = ratings.filter(r => r.comment && String(r.comment).trim()).length;
    const distribution = [1, 2, 3, 4, 5].map(star => ratings.filter(r => r.rating === star).length);
    return { total, avg, commented, distribution };
  }, [ratings]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ratings.filter(r => {
      if (starFilter && r.rating !== starFilter) return false;
      if (!q) return true;
      return [r.tenant_name, r.provider_name, r.ticket_title, r.property_name, r.comment, r.unit_number]
        .filter(Boolean)
        .some(v => String(v).toLowerCase().includes(q));
    });
  }, [ratings, starFilter, search]);

  return (
    <>
      <div className="welcome-banner"><h2>{title}</h2><p>{subtitle}</p></div>

      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <div className="stat-card"><div className="stat-value">{stats.total}</div><div className="stat-label">Total Ratings</div></div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--amber)' }}>
            {stats.avg !== null ? <><FaStar style={{ fontSize: 14 }} /> {stats.avg.toFixed(1)}</> : '—'}
          </div>
          <div className="stat-label">Average Rating</div>
        </div>
        <div className="stat-card"><div className="stat-value">{stats.commented}</div><div className="stat-label">With Comments</div></div>
      </div>

      <div className="card">
        <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <span>All Ratings ({filtered.length})</span>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className={`btn btn-sm ${starFilter === 0 ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setStarFilter(0)}>All</button>
            {[5, 4, 3, 2, 1].map(star => (
              <button key={star} className={`btn btn-sm ${starFilter === star ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setStarFilter(star)}>
                {star}★
              </button>
            ))}
            <FaSearch style={{ marginLeft: 8 }} />
            <input
              className="form-input"
              style={{ width: 160, padding: '4px 6px', fontSize: 11 }}
              placeholder="Search..." value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="empty-state"><div className="empty-text">Loading ratings...</div></div>
        ) : error ? (
          <div className="empty-state"><div className="empty-text" style={{ color: 'var(--danger)' }}>{error}</div></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state"><div className="empty-text">No ratings found.</div></div>
        ) : (
          <div className="scroll-list" style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '65vh' }}>
            {filtered.map(r => (
              <div key={r.id} className="ticket-card" style={{ padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <Stars value={r.rating} size={18} />
                    <span style={{ marginLeft: 8, fontSize: 14, color: 'var(--text-dim)' }}>{r.rating}/5</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                    <FaCalendarAlt style={{ marginRight: 4 }} />
                    {r.created_at ? new Date(r.created_at).toLocaleString() : '—'}
                  </div>
                </div>

                {r.comment && String(r.comment).trim() ? (
                  <div style={{ marginTop: 10, padding: 10, background: 'var(--surface)', borderRadius: 4, fontSize: 13, fontStyle: 'italic', color: 'var(--text-mid)' }}>
                    <FaQuoteLeft style={{ marginRight: 4, opacity: 0.3 }} />{r.comment}
                  </div>
                ) : (
                  <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-dim)' }}>No comment provided.</div>
                )}

                <div className="ticket-meta" style={{ marginTop: 10, flexWrap: 'wrap' }}>
                  <span><FaUser /> {r.tenant_name || 'Unknown tenant'}</span>
                  <span><FaWrench /> {r.provider_name || 'Unassigned'}</span>
                  {r.provider_name && (
                    <span style={{ color: 'var(--amber)' }}>
                      ⭐ {r.provider_rating != null ? Number(r.provider_rating).toFixed(1) : '—'}
                      <span style={{ color: 'var(--text-dim)' }}> ({r.provider_rating_count || 0})</span>
                    </span>
                  )}
                  <span><FaBuilding /> {r.property_name || '—'}</span>
                  {r.unit_number && <span><FaBox /> Unit {r.unit_number}</span>}
                  <span style={{ width: '100%', color: 'var(--text-dim)' }}>{r.ticket_title}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default RatingsList;

import React, { useState, useEffect } from 'react';
import { FaBullhorn, FaCheck, FaTimes } from 'react-icons/fa';
import { getPopups, markMessageRead } from '../data/messagesStore';

const BroadcastPopup = ({ userId }) => {
  const [queue, setQueue] = useState([]);
  const [acknowledging, setAcknowledging] = useState(false);

  useEffect(() => {
    if (!userId) { setQueue([]); return; }
    let cancelled = false;
    getPopups().then(list => {
      if (!cancelled && Array.isArray(list) && list.length > 0) setQueue(list);
    });
    return () => { cancelled = true; };
  }, [userId]);

  if (queue.length === 0) return null;
  const current = queue[0];
  const sender = [current.sender_name, current.sender_surname].filter(Boolean).join(' ') || 'System Administrator';

  const acknowledge = async () => {
    setAcknowledging(true);
    await markMessageRead(current.id);
    setQueue(q => q.slice(1));
    setAcknowledging(false);
  };

  return (
    <div className="modal" style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 2000 }}>
      <div className="edit-modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="edit-modal-header">
          <span><FaBullhorn /> Announcement{queue.length > 1 ? ` (1 of ${queue.length})` : ''}</span>
          <button className="modal-close-btn" onClick={acknowledge} aria-label="Dismiss announcement"><FaTimes /></button>
        </div>
        <div style={{ padding: '4px 0 12px' }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{current.subject}</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 10 }}>
            From {sender} · {current.created_at ? new Date(current.created_at).toLocaleString() : ''}
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{current.body}</div>
        </div>
        <div className="form-actions">
          <button className="btn btn-teal" onClick={acknowledge} disabled={acknowledging}>
            <FaCheck /> {acknowledging ? 'Saving...' : 'Got it'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BroadcastPopup;
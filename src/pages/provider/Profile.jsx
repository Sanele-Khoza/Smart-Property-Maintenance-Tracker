import React, { useState, useEffect } from 'react';
import { FaUser, FaEnvelope, FaPhone, FaLock, FaBuilding, FaStar, FaCheckCircle, FaExclamationCircle, FaMapMarkerAlt, FaClock, FaToolbox, FaToggleOn, FaToggleOff, FaIdCard, FaBriefcase, FaWrench } from 'react-icons/fa';
import { getSession, getUsers, updateUser } from '../../data/authStore';
import { getTechnicians, updateTechnicianStatus, updateTechnician } from '../../data/store';

const maskIdNumber = (idNumber) => {
  if (!idNumber) return '—';
  const s = String(idNumber);
  if (s.length <= 4) return '*'.repeat(s.length);
  return '*'.repeat(s.length - 4) + s.slice(-4);
};

const ALL_SPECIALISATIONS = ['Plumbing', 'Electrical', 'HVAC', 'Structural', 'Pest Control', 'General'];
const STATUS_OPTIONS = ['AVAILABLE', 'ON_CALL', 'OFF_DUTY'];
const STATUS_LABELS = { AVAILABLE: 'Available', ON_CALL: 'On Call', OFF_DUTY: 'Off Duty' };
const STATUS_COLORS = { AVAILABLE: 'var(--teal)', ON_CALL: 'var(--amber)', OFF_DUTY: 'var(--text-dim)' };

const Profile = () => {
  const session = getSession();
  const providerName = session ? `${session.name} ${session.surname}` : '';
  const [user, setUser] = useState(session);
  const [tech, setTech] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', surname: '', email: '', phone: '' });
  const [techForm, setTechForm] = useState({ companyName: '', specialisations: [] });
  const [passForm, setPassForm] = useState({ current: '', newPass: '', confirm: '' });
  const [msg, setMsg] = useState({ text: '', type: '' });

  const refreshTech = () => {
    const all = getTechnicians();
    const found = all.find(t => t.name === providerName);
    setTech(found || null);
    if (found) {
      setTechForm({ companyName: found.companyName || '', specialisations: found.specialisations || [] });
    }
  };

  useEffect(() => {
    if (session) {
      setUser(session);
      setForm({ name: session.name || '', surname: session.surname || '', email: session.email || '', phone: session.phone || '' });
    }
    refreshTech();
  }, []);

  const showMsg = (text, type) => { setMsg({ text, type }); setTimeout(() => setMsg({ text: '', type: '' }), 4000); };

  const toggleSpecialisation = (spec) => {
    setTechForm(f => ({
      ...f,
      specialisations: f.specialisations.includes(spec)
        ? f.specialisations.filter(s => s !== spec)
        : [...f.specialisations, spec],
    }));
  };

  const handleSaveProfile = () => {
    const r = updateUser(session.id, {
      name: form.name.trim(), surname: form.surname.trim(),
      email: form.email.trim(), phone: form.phone.trim(),
    });
    if (r.success) {
      const updated = getUsers().find(u => u.id === session.id);
      setUser(updated);
      if (tech) {
        updateTechnician(tech.id, {
          companyName: techForm.companyName.trim(),
          specialisations: techForm.specialisations,
          email: form.email.trim(), phone: form.phone.trim(),
        });
      }
      showMsg('Profile updated successfully.', 'success');
      setEditing(false);
      refreshTech();
    } else {
      showMsg(r.error, 'error');
    }
  };

  const handlePasswordChange = () => {
    if (!passForm.current || !passForm.newPass || !passForm.confirm) { showMsg('All password fields are required.', 'error'); return; }
    if (passForm.newPass !== passForm.confirm) { showMsg('New passwords do not match.', 'error'); return; }
    if (passForm.newPass.length < 6) { showMsg('Password must be at least 6 characters.', 'error'); return; }
    const users = getUsers();
    const u = users.find(x => x.id === session.id);
    if (!u || u.password !== passForm.current) { showMsg('Current password is incorrect.', 'error'); return; }
    const r = updateUser(session.id, { password: passForm.newPass });
    if (r.success) { showMsg('Password changed successfully.', 'success'); setPassForm({ current: '', newPass: '', confirm: '' }); }
    else { showMsg(r.error, 'error'); }
  };

  const handleStatusChange = (newStatus) => {
    if (!tech) return;
    const r = updateTechnicianStatus(tech.id, newStatus);
    if (r.success) { refreshTech(); showMsg(`Status changed to ${STATUS_LABELS[newStatus]}`, 'success'); }
    else { showMsg(r.error, 'error'); }
  };

  const formatCoords = (lat, lng) => {
    if (lat == null || lng == null) return '—';
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  };

  const formatTimeAgo = (iso) => {
    if (!iso) return '—';
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(iso).toLocaleDateString();
  };

  if (!session || !user) return <div className="card"><div className="card-title">Profile</div><p>Unable to load profile.</p></div>;

  return (
    <>
      <div className="welcome-banner"><h2><FaUser /> My Profile</h2><p>Manage your account and service provider details. <span className="req-ref">MOD-009</span></p></div>
      {msg.text && <div className={`alert alert-${msg.type}`}>{msg.type === 'success' ? <FaCheckCircle /> : <FaExclamationCircle />} {msg.text}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card">
          <div className="card-title"><FaBuilding /> Business Details</div>
          <div className="form-group">
            <label className="form-label"><FaBriefcase /> Company Name</label>
            <input className="form-input" value={techForm.companyName} onChange={e => setTechForm(f => ({ ...f, companyName: e.target.value }))} disabled={!editing} />
          </div>
          <div className="form-group">
            <label className="form-label"><FaWrench /> Specialisations</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {ALL_SPECIALISATIONS.map(spec => (
                <button
                  key={spec}
                  className={`btn btn-sm ${techForm.specialisations.includes(spec) ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => editing && toggleSpecialisation(spec)}
                  style={{ cursor: editing ? 'pointer' : 'default', opacity: editing ? 1 : 0.7, fontSize: 11 }}
                  disabled={!editing}
                >
                  {techForm.specialisations.includes(spec) ? <FaToggleOn /> : <FaToggleOff />} {spec}
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label"><FaToolbox /> Availability Status</label>
            <div style={{ display: 'flex', gap: 4 }}>
              {STATUS_OPTIONS.map(s => (
                <button
                  key={s}
                  className={`btn btn-sm ${tech?.availabilityStatus === s ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => handleStatusChange(s)}
                  style={{ borderLeft: `3px solid ${STATUS_COLORS[s]}`, fontSize: 11 }}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>SUSPENDED status is managed by system administrators only.</div>
          </div>
          <div className="form-group">
            <label className="form-label"><FaMapMarkerAlt /> GPS Location</label>
            <div style={{ fontFamily: 'monospace', fontSize: 12, padding: '6px 8px', background: 'var(--surface)', borderRadius: 4 }}>
              {tech ? formatCoords(tech.gpsLatitude, tech.gpsLongitude) : '—'}
              {tech?.lastLocationUpdate && <span style={{ color: 'var(--text-dim)', marginLeft: 8, fontFamily: 'var(--font-sans)', fontSize: 10 }}>(updated {formatTimeAgo(tech.lastLocationUpdate)})</span>}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
            <div className="stat-card" style={{ padding: '8px' }}>
              <div className="stat-value" style={{ fontSize: 20, color: 'var(--amber)' }}><FaStar /> {tech?.rating?.toFixed(1) || '—'}</div>
              <div className="stat-label">Rating</div>
            </div>
            <div className="stat-card" style={{ padding: '8px' }}>
              <div className="stat-value" style={{ fontSize: 20 }}>{tech?.totalJobsCompleted || 0}</div>
              <div className="stat-label">Jobs Completed</div>
            </div>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>Current workload: {tech?.currentWorkload || 0} active job(s)</div>
        </div>
        <div>
          <div className="card">
            <div className="card-title"><FaUser /> Account Details</div>
            <div className="form-group">
              <label className="form-label">Name</label>
              <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} disabled={!editing} />
            </div>
            <div className="form-group">
              <label className="form-label">Surname</label>
              <input className="form-input" value={form.surname} onChange={e => setForm(f => ({ ...f, surname: e.target.value }))} disabled={!editing} />
            </div>
            <div className="form-group">
              <label className="form-label"><FaEnvelope /> Email</label>
              <input className="form-input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} disabled={!editing} />
            </div>
            <div className="form-group">
              <label className="form-label"><FaPhone /> Phone</label>
              <input className="form-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} disabled={!editing} />
            </div>
            <div className="form-group">
              <label className="form-label"><FaIdCard /> ID Number <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>(masked — POPIA)</span></label>
              <input className="form-input" value={maskIdNumber(user.idNumber)} disabled style={{ opacity: 0.8 }} />
            </div>
            {editing ? (
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button className="btn btn-primary" onClick={handleSaveProfile}><FaCheckCircle /> Save</button>
                <button className="btn btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
              </div>
            ) : (
              <button className="btn btn-secondary" onClick={() => setEditing(true)} style={{ marginTop: 12 }}><FaUser /> Edit Profile</button>
            )}
          </div>
          <div className="card" style={{ marginTop: 12 }}>
            <div className="card-title"><FaLock /> Change Password</div>
            <div className="form-group">
              <label className="form-label">Current Password</label>
              <input className="form-input" type="password" value={passForm.current} onChange={e => setPassForm(f => ({ ...f, current: e.target.value }))} placeholder="Enter current password" />
            </div>
            <div className="form-group">
              <label className="form-label">New Password</label>
              <input className="form-input" type="password" value={passForm.newPass} onChange={e => setPassForm(f => ({ ...f, newPass: e.target.value }))} placeholder="Min 6 characters" />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm New Password</label>
              <input className="form-input" type="password" value={passForm.confirm} onChange={e => setPassForm(f => ({ ...f, confirm: e.target.value }))} placeholder="Re-enter new password" />
            </div>
            <button className="btn btn-primary btn-full" onClick={handlePasswordChange} style={{ marginTop: 12 }}><FaLock /> Change Password</button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Profile;
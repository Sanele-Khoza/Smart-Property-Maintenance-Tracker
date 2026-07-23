import React, { useState, useEffect } from 'react';
import { FaUser, FaEnvelope, FaPhone, FaIdCard, FaLock, FaBell, FaSave, FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';
import { getSession, getUsers, updateUser } from '../../data/authStore';

const maskIdNumber = (idNumber) => {
  if (!idNumber) return '—';
  const s = String(idNumber);
  if (s.length <= 4) return '*'.repeat(s.length);
  return '*'.repeat(s.length - 4) + s.slice(-4);
};

const Profile = () => {
  const session = getSession();
  const [user, setUser] = useState(session);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', surname: '', email: '', phone: '', preferredNotificationChannel: 'EMAIL' });
  const [passForm, setPassForm] = useState({ current: '', newPass: '', confirm: '' });
  const [msg, setMsg] = useState({ text: '', type: '' });

  useEffect(() => {
    if (user) {
      setForm({ name: user.name || '', surname: user.surname || '', email: user.email || '', phone: user.phone || '', preferredNotificationChannel: user.preferredNotificationChannel || 'EMAIL' });
    }
  }, [user]);

  const showMsg = (text, type) => { setMsg({ text, type }); setTimeout(() => setMsg({ text: '', type: '' }), 4000); };

  const handleSave = async () => {
    const r = await updateUser(user.id, {
      name: form.name.trim(),
      surname: form.surname.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      preferredNotificationChannel: form.preferredNotificationChannel,
    });
    if (r.success) {
      const updated = getUsers().find(u => u.id === user.id);
      setUser(updated);
      showMsg('Profile updated successfully.', 'success');
      setEditing(false);
    } else {
      showMsg(r.error, 'error');
    }
  };

  const handlePasswordChange = async () => {
    if (!passForm.current || !passForm.newPass || !passForm.confirm) { showMsg('All password fields are required.', 'error'); return; }
    if (passForm.newPass !== passForm.confirm) { showMsg('New passwords do not match.', 'error'); return; }
    if (passForm.newPass.length < 6) { showMsg('Password must be at least 6 characters.', 'error'); return; }
    const users = getUsers();
    const u = users.find(x => x.id === user.id);
    if (!u || u.password !== passForm.current) { showMsg('Current password is incorrect.', 'error'); return; }
    const r = await updateUser(user.id, { password: passForm.newPass });
    if (r.success) {
      showMsg('Password changed successfully.', 'success');
      setPassForm({ current: '', newPass: '', confirm: '' });
    } else {
      showMsg(r.error, 'error');
    }
  };

  if (!user) return <div className="card"><div className="card-title">Profile</div><p>Unable to load profile.</p></div>;

  return (
    <>
      <div className="welcome-banner"><h2><FaUser /> My Profile</h2><p>Manage your account details and preferences. <span className="req-ref">MOD-001</span></p></div>
      {msg.text && <div className={`alert alert-${msg.type}`}>{msg.type === 'success' ? <FaCheckCircle /> : <FaExclamationCircle />} {msg.text}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card">
          <div className="card-title">Personal Information <span className="req-ref">REQ-045</span></div>
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
            <label className="form-label"><FaBell /> Notification Channel <span className="req-ref">REQ-045</span></label>
            <select className="form-select" value={form.preferredNotificationChannel} onChange={e => setForm(f => ({ ...f, preferredNotificationChannel: e.target.value }))} disabled={!editing}>
              <option value="EMAIL">Email</option>
              <option value="SMS">SMS</option>
              <option value="PUSH">Push</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label"><FaIdCard /> ID Number <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>(masked — POPIA)</span></label>
            <input className="form-input" value={maskIdNumber(user.idNumber)} disabled style={{ opacity: 0.8 }} />
          </div>
          {editing ? (
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn btn-primary" onClick={handleSave}><FaSave /> Save</button>
              <button className="btn btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          ) : (
            <button className="btn btn-secondary" onClick={() => setEditing(true)} style={{ marginTop: 12 }}><FaUser /> Edit Profile</button>
          )}
        </div>
        <div className="card">
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
    </>
  );
};

export default Profile;
import React, { useState } from 'react';
import { registerUser } from '../../data/authStore';
import Alert from '../common/Alert';

const ROLE_OPTIONS = [
  { value: '', label: '-- Select Role --' },
  { value: 'TENANT', label: 'Tenant' },
  { value: 'PROPERTY_MANAGER', label: 'Property Manager' },
  { value: 'SERVICE_PROVIDER', label: 'Service Provider' },
];

const RegisterPage = ({ onRegisterSuccess, onVerifyNavigate }) => {
  const [form, setForm] = useState({
    name: '', surname: '', age: '', email: '', phone: '',
    idNumber: '', password: '', confirmPassword: '', role: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [registeredEmail, setRegisteredEmail] = useState('');

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (form.password.length < 8) {
      setError('Password must be at least 8 characters with uppercase, lowercase, number, and special character.');
      return;
    }
    if (!/[A-Z]/.test(form.password)) { setError('Password must contain at least one uppercase letter.'); return; }
    if (!/[a-z]/.test(form.password)) { setError('Password must contain at least one lowercase letter.'); return; }
    if (!/[0-9]/.test(form.password)) { setError('Password must contain at least one number.'); return; }
    if (!/[^A-Za-z0-9]/.test(form.password)) { setError('Password must contain at least one special character.'); return; }

    if (!form.role) {
      setError('Please select a role.');
      return;
    }

    const result = await registerUser({
      name: form.name,
      surname: form.surname,
      age: form.age,
      email: form.email,
      phone: form.phone,
      idNumber: form.idNumber,
      password: form.password,
      role: form.role,
    });

    if (result.success) {
      setVerificationToken(result.verificationToken);
      setRegisteredEmail(form.email);
      setSuccess('Account created! Please verify your email.');
      setForm({
        name: '', surname: '', age: '', email: '', phone: '',
        idNumber: '', password: '', confirmPassword: '', role: '',
      });
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card auth-card-wide">
        <div className="auth-header">
          <img src="/SPMT.svg" alt="SPMT" className="auth-logo" />
          <h1>Create Account</h1>
          <p>SPMT - Group 20</p>
        </div>
        <form onSubmit={handleSubmit}>
          <Alert msg={error} type="error" />
          <Alert msg={success} type="success" />
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="reg-name">Name</label>
              <input className="form-input" type="text" name="name" id="reg-name" value={form.name} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="reg-surname">Surname</label>
              <input className="form-input" type="text" name="surname" id="reg-surname" value={form.surname} onChange={handleChange} required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="reg-age">Age</label>
              <input className="form-input" type="number" name="age" id="reg-age" min="1" max="150" value={form.age} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="reg-idnumber">ID Number</label>
              <input className="form-input" type="text" name="idNumber" id="reg-idnumber" value={form.idNumber} onChange={handleChange} required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="reg-email">Email</label>
              <input className="form-input" type="email" name="email" id="reg-email" value={form.email} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="reg-phone">Phone</label>
              <input className="form-input" type="tel" name="phone" id="reg-phone" value={form.phone} onChange={handleChange} required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="reg-password">Password</label>
              <input className="form-input" type="password" name="password" id="reg-password" value={form.password} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="reg-confirm">Confirm Password</label>
              <input className="form-input" type="password" name="confirmPassword" id="reg-confirm" value={form.confirmPassword} onChange={handleChange} required />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="reg-role">Role</label>
            <select className="form-select" name="role" id="reg-role" value={form.role} onChange={handleChange} required>
              {ROLE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>
            System Administrator accounts are provisioned by an existing admin only.
          </p>
          <button type="submit" className="btn btn-teal btn-full">
            Register
          </button>
        </form>

        {verificationToken && (
          <div style={{
            background: 'rgba(0,201,167,0.08)', border: '1px dashed var(--teal)',
            borderRadius: 6, padding: 14, marginTop: 14,
          }}>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--ink)', marginTop: 6 }}>
              A verification email has been sent to <strong>{registeredEmail}</strong>. 
              Please check your inbox (and spam folder) and click the link to activate your account.
            </div>
          </div>
        )}

        <div className="auth-footer">
          <span>Already have an account?</span>
          <a href="/login" onClick={(e) => { e.preventDefault(); onRegisterSuccess(); }}>
            Sign in
          </a>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;

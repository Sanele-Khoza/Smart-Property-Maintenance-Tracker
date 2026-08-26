import React, { useState } from 'react';
import { registerUser, resendVerificationEmail } from '../../data/authStore';
import Alert from '../common/Alert';

const ROLE_OPTIONS = [
  { value: '', label: '-- Select Role --' },
  { value: 'TENANT', label: 'Tenant' },
  { value: 'PROPERTY_MANAGER', label: 'Property Manager' },
  { value: 'SERVICE_PROVIDER', label: 'Service Provider' },
];

const SPECIALISATION_OPTIONS = ['Plumbing', 'Electrical', 'HVAC', 'Structural', 'Pest Control', 'General'];

const RegisterPage = ({ onRegisterSuccess, onVerifyNavigate }) => {
  const [form, setForm] = useState({
    name: '', surname: '', age: '', email: '', phone: '',
    idNumber: '', password: '', confirmPassword: '', role: '',
    companyName: '', specialisations: [],
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [resendMsg, setResendMsg] = useState('');
  const [resending, setResending] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const toggleSpecialisation = (spec) => {
    setForm(f => ({
      ...f,
      specialisations: f.specialisations.includes(spec)
        ? f.specialisations.filter(s => s !== spec)
        : [...f.specialisations, spec],
    }));
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

    if (!/^\d{13}$/.test(form.idNumber)) {
      setError('ID number must be exactly 13 digits.');
      return;
    }

    if (!/^\d{10}$/.test(form.phone)) {
      setError('Phone number must be exactly 10 digits.');
      return;
    }

    if (form.role === 'SERVICE_PROVIDER' && !form.companyName.trim()) {
      setError('Company name is required for service providers.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await registerUser({
        name: form.name,
        surname: form.surname,
        age: form.age,
        email: form.email,
        phone: form.phone,
        idNumber: form.idNumber,
        password: form.password,
        role: form.role,
        companyName: form.companyName,
        specialisations: form.specialisations,
      });

      if (result.success) {
        setRegistered(true);
        setRegisteredEmail(form.email);
        setForm({
          name: '', surname: '', age: '', email: '', phone: '',
          idNumber: '', password: '', confirmPassword: '', role: '',
          companyName: '', specialisations: [],
        });
      } else {
        setError(result.error);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (registered) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div style={{ textAlign: 'center', padding: '30px 20px' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'rgba(0,201,167,0.15)', color: 'var(--teal)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, margin: '0 auto 16px', fontWeight: 700,
            }}>✉</div>
            <h2 style={{ fontFamily: 'var(--font-body)', fontSize: 18, color: 'var(--ink)', marginBottom: 8 }}>
              Check your email
            </h2>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.6, marginBottom: 8 }}>
              We sent a verification link to
            </p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink)', fontWeight: 600, marginBottom: 20 }}>
              {registeredEmail}
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 24 }}>
              Click the link in the email to verify your account.
              Check your spam folder if you don't see it.
            </p>
            {resendMsg && (
              <Alert msg={resendMsg} type="success" />
            )}
            <button className="btn btn-primary btn-full" style={{ marginBottom: 12 }} onClick={onRegisterSuccess}>
              Go to Login
            </button>
            <button
              className="btn btn-secondary btn-full"
              disabled={resending}
              onClick={async () => {
                setResending(true);
                setResendMsg('');
                await resendVerificationEmail(registeredEmail);
                setResendMsg('Verification email resent. Check your inbox.');
                setResending(false);
              }}
            >
              {resending ? 'Sending…' : 'Resend Verification Email'}
            </button>
          </div>
        </div>
      </div>
    );
  }

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
          {form.role === 'SERVICE_PROVIDER' && (
            <>
              <div className="form-group">
                <label className="form-label" htmlFor="reg-company">Company Name</label>
                <input className="form-input" type="text" name="companyName" id="reg-company" placeholder="e.g. Bob's Plumbing Co" value={form.companyName} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Specialisations (categories you service)</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {SPECIALISATION_OPTIONS.map(spec => (
                    <button
                      key={spec}
                      type="button"
                      className={`btn btn-sm ${form.specialisations.includes(spec) ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => toggleSpecialisation(spec)}
                      style={{ fontSize: 11 }}
                    >
                      {spec}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>
            System Administrator accounts are provisioned by an existing admin only.
          </p>
          <button type="submit" className="btn btn-teal btn-full" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Register'}
          </button>
        </form>

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

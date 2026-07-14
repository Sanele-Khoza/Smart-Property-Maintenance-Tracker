import React, { useState } from 'react';
import { requestPasswordReset, resetPassword } from '../../data/authStore';
import Alert from '../common/Alert';

const ForgotPasswordPage = ({ onBack }) => {
  const [step, setStep] = useState('request');
  const [email, setEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [msg, setMsg] = useState({ text: '', type: '' });

  const handleRequest = async (e) => {
    e.preventDefault();
    setMsg({ text: '', type: '' });
    const result = await requestPasswordReset(email);
    setMsg({ text: result.message, type: 'info' });
    setStep('reset');
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setMsg({ text: '', type: '' });

    if (newPassword.length < 6) {
      setMsg({ text: 'Password must be at least 6 characters.', type: 'error' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMsg({ text: 'Passwords do not match.', type: 'error' });
      return;
    }

    const result = await resetPassword(resetToken, newPassword);
    if (result.success) {
      setMsg({ text: 'Password reset successful! Redirecting to login...', type: 'success' });
      setTimeout(() => onBack(), 2000);
    } else {
      setMsg({ text: result.error, type: 'error' });
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <img src="/SPMT.svg" alt="SPMT" className="auth-logo" />
          <h1>{step === 'request' ? 'Reset Password' : 'Enter New Password'}</h1>
        </div>

        {step === 'request' && (
          <form onSubmit={handleRequest}>
            <Alert msg={msg.text} type={msg.type === 'info' ? 'success' : msg.type} />
            <div className="form-group">
              <label className="form-label" htmlFor="reset-email">Email</label>
              <input
                id="reset-email"
                className="form-input"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary btn-full">Send Reset Link</button>
            {resetToken && (
              <div style={{
                background: 'rgba(240,165,0,0.08)', border: '1px dashed var(--amber)',
                borderRadius: 6, padding: 12, marginTop: 12,
                fontFamily: 'var(--font-mono)', fontSize: 11,
              }}>
                Simulated email — in production this would be sent to your inbox.<br />
                Your one-time reset token (valid 1 hour):<br />
                <strong style={{ fontSize: 14 }}>{resetToken}</strong>
              </div>
            )}
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <span
                style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--amber)', cursor: 'pointer', textDecoration: 'none' }}
                onClick={onBack}
              >
                Back to Login
              </span>
            </div>
          </form>
        )}

        {step === 'reset' && (
          <form onSubmit={handleReset}>
            <Alert msg={msg.text} type={msg.type} />
            <div className="form-group">
              <label className="form-label">Token</label>
              <input
                className="form-input"
                type="text"
                value={resetToken}
                onChange={(e) => setResetToken(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">New Password</label>
              <input
                className="form-input"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <input
                className="form-input"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary btn-full">Reset Password</button>
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <span
                style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--amber)', cursor: 'pointer', textDecoration: 'none' }}
                onClick={() => { setStep('request'); setMsg({ text: '', type: '' }); }}
              >
                Start over
              </span>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPasswordPage;

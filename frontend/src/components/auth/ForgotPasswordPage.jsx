import React, { useState, useEffect, useRef } from 'react';
import { requestPasswordReset, resetPassword } from '../../data/authStore';
import Alert from '../common/Alert';

const ForgotPasswordPage = ({ onBack, initialToken }) => {
  const [step, setStep] = useState(initialToken ? 'reset' : 'request');
  const [email, setEmail] = useState('');
  const [resetToken, setResetToken] = useState(initialToken || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [submitting, setSubmitting] = useState(false);
  const tokenInputRef = useRef(null);

  useEffect(() => {
    if (initialToken) {
      setResetToken(initialToken);
      setStep('reset');
    }
  }, [initialToken]);

  useEffect(() => {
    if (step === 'reset' && tokenInputRef.current) {
      tokenInputRef.current.focus();
    }
  }, [step]);

  const handleRequest = async (e) => {
    e.preventDefault();
    setMsg({ text: '', type: '' });
    setSubmitting(true);
    try {
      const result = await requestPasswordReset(email);
      setMsg({ text: result.message || 'If that email exists, a reset link has been sent.', type: 'success' });
    } catch {
      setMsg({ text: 'If that email exists, a reset link has been sent.', type: 'success' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setMsg({ text: '', type: '' });

    if (newPassword.length < 8) {
      setMsg({ text: 'Password must be at least 8 characters.', type: 'error' });
      return;
    }
    if (!/[A-Z]/.test(newPassword)) { setMsg({ text: 'Password must contain at least one uppercase letter.', type: 'error' }); return; }
    if (!/[a-z]/.test(newPassword)) { setMsg({ text: 'Password must contain at least one lowercase letter.', type: 'error' }); return; }
    if (!/[0-9]/.test(newPassword)) { setMsg({ text: 'Password must contain at least one number.', type: 'error' }); return; }
    if (!/[^A-Za-z0-9]/.test(newPassword)) { setMsg({ text: 'Password must contain at least one special character.', type: 'error' }); return; }
    if (newPassword !== confirmPassword) {
      setMsg({ text: 'Passwords do not match.', type: 'error' });
      return;
    }
    if (!resetToken) {
      setMsg({ text: 'Reset token is required.', type: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      const result = await resetPassword(resetToken, newPassword);
      if (result.success) {
        setMsg({ text: 'Password reset successful! Redirecting to login...', type: 'success' });
        setTimeout(() => onBack(), 2000);
      } else {
        setMsg({ text: result.error || 'Failed to reset password.', type: 'error' });
      }
    } catch (err) {
      setMsg({ text: err.message || 'Failed to reset password.', type: 'error' });
    } finally {
      setSubmitting(false);
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
            <Alert msg={msg.text} type={msg.type} />
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-mid)', marginBottom: 16, lineHeight: 1.5 }}>
              Enter your email address and we'll send you a link to reset your password.
            </p>
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
            <button type="submit" className="btn btn-primary btn-full" disabled={submitting}>
              {submitting ? 'Sending…' : 'Send Reset Link'}
            </button>
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
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-mid)', marginBottom: 16, lineHeight: 1.5 }}>
              Enter your new password below.
            </p>
            <div className="form-group">
              <label className="form-label">Reset Token</label>
              <input
                ref={tokenInputRef}
                className="form-input"
                type="text"
                value={resetToken}
                onChange={(e) => setResetToken(e.target.value)}
                placeholder="Paste token from email"
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
                placeholder="At least 8 characters"
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
            <button type="submit" className="btn btn-primary btn-full" disabled={submitting}>
              {submitting ? 'Resetting…' : 'Reset Password'}
            </button>
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <span
                style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--amber)', cursor: 'pointer', textDecoration: 'none' }}
                onClick={() => { setStep('request'); setResetToken(''); setMsg({ text: '', type: '' }); }}
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

import React, { useEffect, useRef, useState } from 'react';
import { verifyEmail, resendVerificationEmail } from '../../data/authStore';

const spinnerKeyframes = `
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
`;

const VerifyEmailPage = ({ token, onVerified, registeredEmail }) => {
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [resendMsg, setResendMsg] = useState('');
  const [resending, setResending] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current || !token) return;
    startedRef.current = true;
    (async () => {
      const result = await verifyEmail(token);
      if (result.success) {
        setStatus('success');
      } else {
        setError(result.error);
        setStatus('error');
      }
    })();
  }, [token]);

  const handleResend = async () => {
    if (!registeredEmail) return;
    setResending(true);
    setResendMsg('');
    await resendVerificationEmail(registeredEmail);
    setResendMsg('Verification email resent. Check your inbox.');
    setResending(false);
  };

  return (
    <div className="auth-page">
      <style>{spinnerKeyframes}</style>
      <div className="auth-card">
        {status === 'loading' && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{
              width: 36, height: 36, border: '3px solid var(--border)',
              borderTop: '3px solid var(--amber)', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite', margin: '0 auto 16px',
            }} />
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-mid)' }}>
              Verifying your email...
            </div>
          </div>
        )}
        {status === 'success' && (
          <div style={{ textAlign: 'center', padding: '30px 20px' }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: 'rgba(0,201,167,0.15)', color: 'var(--teal)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24, margin: '0 auto 16px', fontWeight: 700,
            }}>&#10003;</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--ink)', marginBottom: 8 }}>
              Email verified successfully!
            </div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-mid)', lineHeight: 1.6, marginBottom: 20 }}>
              Your account is now pending approval from your Property Manager or System Administrator.
            </div>
            <button className="btn btn-primary" onClick={onVerified}>Go to Login</button>
          </div>
        )}
        {status === 'error' && (
          <div style={{ textAlign: 'center', padding: '30px 20px' }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: 'rgba(224,82,82,0.15)', color: 'var(--danger)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24, margin: '0 auto 16px', fontWeight: 700,
            }}>&#10007;</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--danger)', marginBottom: 8 }}>
              {error}
            </div>
            {error.includes('already verified') ? (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-mid)', marginBottom: 20 }}>
                Your email has already been verified. You can log in to your account.
              </p>
            ) : (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-mid)', marginBottom: 20 }}>
                The verification link may have expired or already been used.
              </p>
            )}
            {resendMsg && (
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--teal)', marginBottom: 12 }}>
                {resendMsg}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
              {registeredEmail && !error.includes('already verified') && (
                <button className="btn btn-secondary" disabled={resending} onClick={handleResend}>
                  {resending ? 'Sending…' : 'Resend Verification Email'}
                </button>
              )}
              <button className="btn btn-primary" onClick={onVerified}>Go to Login</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VerifyEmailPage;

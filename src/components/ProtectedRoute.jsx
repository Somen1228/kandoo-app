import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import KandooLoader from './KandooLoader';
import { kandooMascots } from '../assets/kandoo/mascots';

function EmailVerificationGate() {
  const { user, sendVerificationEmail, reloadUser, logout } = useAuth();
  const [checking, setChecking]   = useState(false);
  const [resent, setResent]       = useState(false);
  const [notYet, setNotYet]       = useState(false);

  const check = async () => {
    setChecking(true);
    setNotYet(false);
    const verified = await reloadUser();
    if (!verified) setNotYet(true);
    setChecking(false);
  };

  const resend = async () => {
    await sendVerificationEmail();
    setResent(true);
    setTimeout(() => setResent(false), 4000);
  };

  return (
    <main className="login-page">
      <div className="login-drag-region" data-tauri-drag-region />
      <section className="login-card" style={{ textAlign: 'center' }}>
        <div className="login-brand">
          <img src={kandooMascots.calm} alt="" />
          <h1>Verify your email</h1>
          <p>We sent a link to <strong>{user?.email}</strong>. Click it to activate your account.</p>
        </div>

        {notYet && (
          <div className="login-alert" style={{ textAlign: 'left' }}>
            Not verified yet — check your inbox (and spam folder).
          </div>
        )}
        {resent && (
          <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 8,
            background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
            color: 'var(--accent)', fontSize: '0.78rem' }}>
            Verification email resent!
          </div>
        )}

        <button className="login-primary" onClick={check} disabled={checking}>
          {checking ? 'Checking…' : "I've verified my email →"}
        </button>
        <div style={{ marginTop: 10 }}>
          <button className="login-offline" onClick={resend}>Resend verification email</button>
        </div>
        <button type="button" className="login-switch" style={{ marginTop: 18, display: 'block', width: '100%' }}
          onClick={logout}>
          Sign out
        </button>
      </section>
    </main>
  );
}

export default function ProtectedRoute({ children }) {
  const { user, isGuest, loading } = useAuth();

  if (loading) return <KandooLoader fullscreen message="Opening your workspace…" />;
  if (!user && !isGuest) return <Navigate to="/login" replace />;

  // Email/password users must verify before accessing the app
  if (user && user.authProvider === 'password' && !user.firebaseUser?.emailVerified) {
    return <EmailVerificationGate />;
  }

  return children;
}

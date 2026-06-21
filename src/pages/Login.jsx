import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import KandooLoader from '../components/KandooLoader';
import { kandooMascots } from '../assets/kandoo/mascots';
import './Login.css';

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09A6.4 6.4 0 0 1 5.49 12c0-.73.13-1.43.35-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

const FRIENDLY_ERRORS = {
  'auth/invalid-email':                        'Enter a valid email address.',
  'auth/invalid-credential':                   'Email or password is incorrect.',
  'auth/email-already-in-use':                 'An account already exists with this email.',
  'auth/weak-password':                        'Password must be at least six characters.',
  'auth/network-request-failed':               'Network error. Check your connection and try again.',
  'auth/popup-closed-by-user':                 'The sign-in window was closed.',
  'auth/unauthorized-domain':                  'This domain is not authorized in Firebase.',
  'auth/account-exists-with-different-credential':
    'This email is already linked to a Google account. Sign in with Google instead.',
  'auth/wrong-password':                       'Incorrect password.',
  'auth/user-not-found':                       'No account found with this email.',
  'auth/too-many-requests':                    'Too many attempts. Try again later or reset your password.',
};

function friendlyError(message) {
  const code = message?.match(/auth\/[\w-]+/)?.[0];
  return FRIENDLY_ERRORS[code] || message?.replace('Firebase: ', '').replace(/\s*\(auth\/[\w-]+\)\.?$/, '') || '';
}

// ── Forgot password sub-screen ────────────────────────────────────────────────
function ForgotPassword({ onBack }) {
  const { forgotPassword, error, clearError } = useAuth();
  const [email, setEmail]       = useState('');
  const [sent, setSent]         = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    clearError();
    try {
      await forgotPassword(email);
      setSent(true);
    } catch { /* error shown via authState.error */ }
    finally { setSubmitting(false); }
  };

  if (sent) return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📬</div>
      <p style={{ color: 'var(--theme-text-secondary)', fontSize: '0.88rem', lineHeight: 1.5 }}>
        Reset link sent to <strong>{email}</strong>. Check your inbox and follow the link.
      </p>
      <button type="button" className="login-switch" style={{ marginTop: 18 }} onClick={onBack}>
        ← Back to sign in
      </button>
    </div>
  );

  return (
    <form onSubmit={submit} className="login-form">
      <p style={{ margin: '0 0 4px', color: 'var(--theme-text-secondary)', fontSize: '0.84rem' }}>
        Enter your email and we’ll send a reset link.
      </p>
      {error && <div className="login-alert">{friendlyError(error)}</div>}
      <label>Email
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          autoComplete="email" autoFocus />
      </label>
      <button className="login-primary" disabled={submitting}>
        {submitting ? 'Sending…' : 'Send reset link'}
      </button>
      <button type="button" className="login-switch" onClick={onBack}>← Back to sign in</button>
    </form>
  );
}

// ── Main login page ───────────────────────────────────────────────────────────
export default function Login() {
  const authState = useAuth();
  const [tab, setTab]           = useState(() => authState.supportsGoogle ? 'google' : 'email');
  const [isSignUp, setIsSignUp] = useState(false);
  const [forgotPw, setForgotPw] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [form, setForm]         = useState({ displayName: '', email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);

  if (authState.user || authState.isGuest) return <Navigate to="/" replace />;

  const run = async (action) => {
    setSubmitting(true);
    authState.clearError();
    try { await action(); } catch { /* AuthContext owns the user-facing error */ }
    finally { setSubmitting(false); }
  };

  const submitEmail = (event) => {
    event.preventDefault();
    run(() => isSignUp
      ? authState.signUpWithEmail(form.email, form.password, form.displayName, rememberMe)
      : authState.signInWithEmail(form.email, form.password, rememberMe));
  };

  const switchTab = (t) => { setTab(t); setForgotPw(false); authState.clearError(); };

  return (
    <main className="login-page">
      <div className="login-drag-region" data-tauri-drag-region />
      {submitting && <KandooLoader fullscreen message={isSignUp ? 'Creating your workspace…' : 'Signing you in…'} />}
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-brand">
          <img src={kandooMascots.calm} alt="" />
          <h1 id="login-title">Kandoo</h1>
          <p>Your projects, tasks, and notes—available everywhere.</p>
        </div>

        {!authState.firebaseConfigured && (
          <div className="login-alert">Cloud login is not configured yet.</div>
        )}
        {authState.supportsGoogle && !authState.googleConfigured && (
          <div className="login-alert">Desktop Google login needs <code>VITE_GOOGLE_DESKTOP_CLIENT_ID</code>.</div>
        )}
        {authState.error && !forgotPw && <div className="login-alert">{friendlyError(authState.error)}</div>}

        {authState.supportsGoogle && (
          <div className="login-tabs" role="tablist">
            <button className={tab === 'google' ? 'is-active' : ''} onClick={() => switchTab('google')}>Google</button>
            <button className={tab === 'email'  ? 'is-active' : ''} onClick={() => switchTab('email')}>Email</button>
          </div>
        )}

        {tab === 'google' && authState.supportsGoogle ? (
          <button className="login-google"
            disabled={submitting || !authState.firebaseConfigured || !authState.googleConfigured}
            onClick={() => run(() => authState.signInWithGoogle(rememberMe))}>
            <GoogleIcon /> Continue with Google
          </button>
        ) : forgotPw ? (
          <ForgotPassword onBack={() => { setForgotPw(false); authState.clearError(); }} />
        ) : (
          <form className="login-form" onSubmit={submitEmail}>
            {isSignUp && (
              <label>Name
                <input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                  autoComplete="name" placeholder="How should we call you?" />
              </label>
            )}
            <label>Email
              <input type="email" required value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" />
            </label>
            <label>Password
              <input type="password" required minLength={6} value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                autoComplete={isSignUp ? 'new-password' : 'current-password'} />
            </label>
            <button className="login-primary" disabled={submitting || !authState.firebaseConfigured}>
              {isSignUp ? 'Create account' : 'Sign in'}
            </button>
            {!isSignUp && (
              <button type="button" className="login-switch"
                onClick={() => { setForgotPw(true); authState.clearError(); }}>
                Forgot password?
              </button>
            )}
            <button type="button" className="login-switch"
              onClick={() => { setIsSignUp((v) => !v); authState.clearError(); }}>
              {isSignUp ? 'Already have an account? Sign in' : 'New to Kandoo? Create an account'}
            </button>
          </form>
        )}

        {!forgotPw && (
          <>
            <label className="login-remember">
              <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
              Remember me
            </label>
            <div className="login-divider"><span>or</span></div>
            <button className="login-offline" onClick={authState.continueOffline}>Continue offline on this device</button>
            <p className="login-footnote">Offline work stays local. Sign in to back it up and use it on other devices.</p>
          </>
        )}
      </section>
    </main>
  );
}

'use client';

import { FormEvent, useEffect, useState } from 'react';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import Logo from './Logo';
import PasswordChange from './PasswordChange';
import { apiUrl, errorMessage, TOKEN_KEY, responseJson } from '../lib/api';
import { clearConsoleCache } from '../lib/consoleCache';
import { FAILURE_ALERTS_KEY, SECTION_PATHS, sectionFromLegacyHash } from '../lib/sections';
import { clearSessionCache } from '../lib/sessionCache';

type AuthUser = { email?: string; role?: string; forcePasswordChange?: boolean };
type AuthResponse = { token?: string; user?: AuthUser; message?: string };

const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [revealPassword, setRevealPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [forcePasswordChange, setForcePasswordChange] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    const storedToken = window.localStorage.getItem(TOKEN_KEY);
    if (!storedToken) {
      clearSessionCache();
      clearConsoleCache();
      setSessionChecked(true);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`${apiUrl}/auth/me`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        });
        const data = await responseJson<{ user?: AuthUser; message?: string }>(response);
        if (!response.ok || !data.user) throw new Error(data.message || 'Session expired');
        if (cancelled) return;
        setToken(storedToken);
        setUserEmail(data.user.email || '');
        setForcePasswordChange(Boolean(data.user.forcePasswordChange));
      } catch {
        clearSessionCache();
        clearConsoleCache();
        window.localStorage.removeItem(TOKEN_KEY);
      } finally {
        if (!cancelled) setSessionChecked(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!token || forcePasswordChange) return;
    const legacy = sectionFromLegacyHash(window.location.hash);
    router.replace(legacy ? SECTION_PATHS[legacy] : '/overview');
  }, [forcePasswordChange, router, token]);

  function applySession(data: AuthResponse) {
    if (!data.token || !data.user) return false;
    clearSessionCache();
    clearConsoleCache();
    window.localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setUserEmail(data.user.email || '');
    setForcePasswordChange(Boolean(data.user.forcePasswordChange));
    return true;
  }

  async function signInWithGoogle(credential: string) {
    setMessage('');
    setSubmitting(true);
    try {
      const response = await fetch(`${apiUrl}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });
      const data = await responseJson<AuthResponse>(response);
      if (!response.ok || !applySession(data)) throw new Error(data.message || 'Google sign-in failed');
    } catch (error) {
      setMessage(errorMessage(error, 'Google sign-in failed'));
    } finally {
      setSubmitting(false);
    }
  }

  function initializeGoogle() {
    const element = document.getElementById('google-button');
    if (!element || !window.google || !googleClientId) return;
    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: ({ credential }) => signInWithGoogle(credential),
    });
    window.google.accounts.id.renderButton(element, {
      theme: 'filled_black',
      size: 'large',
      shape: 'rectangular',
      text: 'continue_with',
      width: '360',
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    setSubmitting(true);
    try {
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await responseJson<AuthResponse>(response);
      if (!response.ok || !applySession(data)) throw new Error(data.message || 'Unable to sign in');
    } catch (error) {
      setMessage(errorMessage(error, 'Unable to sign in'));
    } finally {
      setSubmitting(false);
    }
  }

  function signOut() {
    clearSessionCache();
    clearConsoleCache();
    window.localStorage.removeItem(TOKEN_KEY);
    window.sessionStorage.removeItem(FAILURE_ALERTS_KEY);
    setToken(null);
    setUserEmail('');
    setForcePasswordChange(false);
    setMessage('');
  }

  if (!sessionChecked || (token && !forcePasswordChange)) {
    return (
      <main className="auth-page">
        <div className="auth-glow auth-glow--blue" aria-hidden="true" />
        <div className="auth-glow auth-glow--violet" aria-hidden="true" />
        <div className="auth-loading">
          <Logo size="lg" tagline />
          <span className="auth-spinner" aria-hidden="true" />
          <p className="auth-sub">Checking your session…</p>
        </div>
      </main>
    );
  }

  if (token) {
    return (
      <PasswordChange
        token={token}
        email={userEmail}
        onComplete={() => router.replace('/overview')}
        onSignOut={signOut}
      />
    );
  }

  return (
    <main className="auth-page">
      <div className="auth-glow auth-glow--blue" aria-hidden="true" />
      <div className="auth-glow auth-glow--violet" aria-hidden="true" />

      <div className="auth-shell">
        <section className="auth-brand">
          <div className="auth-brand__head">
            <Logo size="md" />
            <span className="auth-brand__chip">Cloud Console</span>
          </div>

          <p className="auth-tagline">
            Code <span className="is-sep">•</span> <span className="is-accent">Innovate</span>{' '}
            <span className="is-sep">•</span> Elevate
          </p>

          <h1 className="auth-headline">
            Enterprise multi-tenant VPS orchestration &amp; instant Git deployment pipeline.
          </h1>

          <p className="auth-lede">
            Deterministic node virtualization, sub-second rollout automation, and high-frequency real-time
            telemetry built for high-throughput engineering teams.
          </p>

          <div className="auth-features">
            <article className="auth-feature">
              <span className="auth-feature__icon" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91 0Z" />
                  <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2Z" />
                  <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
                  <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
                </svg>
              </span>
              <h3>One-click Git deploys</h3>
              <p>Automated zero-downtime rolling releases triggered from GitHub/GitLab pushes.</p>
            </article>

            <article className="auth-feature">
              <span className="auth-feature__icon auth-feature__icon--violet" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <path d="M8 21h8M12 17v4" />
                  <path d="m7 8 3 2.5L7 13" />
                </svg>
              </span>
              <h3>Live PM2 controls</h3>
              <p>Real-time telemetry, memory &amp; CPU tracking, instant process restarts and hot reloads.</p>
            </article>

            <article className="auth-feature">
              <span className="auth-feature__icon auth-feature__icon--indigo" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </span>
              <h3>Scheduled webhooks</h3>
              <p>Proactive uptime monitoring, automated failover pings, and multi-channel alerts.</p>
            </article>
          </div>

          <p className="auth-brand__foot">Need access? Contact your HexTorq administrator.</p>
        </section>

        <section className="auth-card" aria-labelledby="auth-title">
          <p className="auth-eyebrow">HexTorq Cloud</p>
          <h2 id="auth-title" className="auth-title">
            Sign in to Cloud Console
          </h2>
          <p className="auth-sub">Enter your credentials to access deployment nodes and tenant services.</p>

          {message && (
            <div className="auth-alert" role="alert">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v5M12 16h.01" />
              </svg>
              <span>
                <strong>Authentication failed</strong>
                {message}
              </span>
            </div>
          )}

          <form className="auth-form" onSubmit={submit}>
            <div className="auth-field">
              <div className="auth-label-row">
                <label className="auth-label" htmlFor="auth-email">
                  Work Email
                </label>
              </div>
              <div className="auth-input-wrap">
                <svg className="auth-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m2 7 10 6 10-6" />
                </svg>
                <input
                  id="auth-email"
                  className="auth-input"
                  type="email"
                  autoComplete="username"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
            </div>

            <div className="auth-field">
              <div className="auth-label-row">
                <label className="auth-label" htmlFor="auth-password">
                  Password
                </label>
              </div>
              <div className="auth-input-wrap">
                <svg className="auth-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="4" y="10" width="16" height="11" rx="2" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
                <input
                  id="auth-password"
                  className="auth-input auth-input--with-action"
                  type={revealPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <button
                  type="button"
                  className="auth-icon-btn"
                  onClick={() => setRevealPassword((current) => !current)}
                  aria-label={revealPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={revealPassword}
                >
                  {revealPassword ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19M6.61 6.61A18.15 18.15 0 0 0 2 12s3 8 10 8a9.7 9.7 0 0 0 5.39-1.61" />
                      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24M2 2l20 20" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button className="auth-submit" type="submit" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </form>

          {googleClientId ? (
            <>
              <div className="auth-divider">Or continue with</div>
              <div className="auth-google">
                <div id="google-button" />
              </div>
            </>
          ) : (
            <>
              <div className="auth-divider">Or continue with</div>
              <div className="auth-google">
                <button
                  type="button"
                  className="auth-google-fallback"
                  disabled
                  title="Google sign-in is not configured for this deployment"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M21.6 12.2c0-.7-.06-1.4-.18-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3Z" />
                    <path fill="#34A853" d="M12 22c2.7 0 4.9-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1a5.9 5.9 0 0 1-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z" />
                    <path fill="#FBBC05" d="M6.4 14a6 6 0 0 1 0-3.9V7.5H3.1a10 10 0 0 0 0 9l3.3-2.5Z" />
                    <path fill="#EA4335" d="M12 6a5.4 5.4 0 0 1 3.8 1.5l2.8-2.8A9.6 9.6 0 0 0 12 2 10 10 0 0 0 3.1 7.5l3.3 2.6A5.9 5.9 0 0 1 12 6Z" />
                  </svg>
                  Continue with Google
                </button>
              </div>
            </>
          )}

          <p className="auth-foot">Access is provisioned by your administrator.</p>
        </section>
      </div>

      {googleClientId && <Script src="https://accounts.google.com/gsi/client" onLoad={initializeGoogle} />}
    </main>
  );
}

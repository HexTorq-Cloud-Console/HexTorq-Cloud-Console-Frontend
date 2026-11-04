'use client';

import { FormEvent, useEffect, useState } from 'react';
import Script from 'next/script';
import Dashboard from './Dashboard';
import PasswordChange from './PasswordChange';
import { apiUrl, errorMessage, TOKEN_KEY, responseJson } from '../lib/api';
export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState('');
  const [forcePasswordChange, setForcePasswordChange] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    const storedToken = window.localStorage.getItem(TOKEN_KEY);
    if (!storedToken) {
      setSessionChecked(true);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`${apiUrl}/auth/me`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        });
        const data = await responseJson<{ user?: { role?: string; forcePasswordChange?: boolean }; message?: string }>(response);
        if (!response.ok || !data.user) throw new Error(data.message || 'Session expired');
        if (cancelled) return;
        setToken(storedToken);
        setRole(data.user.role || '');
        setForcePasswordChange(Boolean(data.user.forcePasswordChange));
      } catch {
        window.localStorage.removeItem(TOKEN_KEY);
      } finally {
        if (!cancelled) setSessionChecked(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function signInWithGoogle(credential: string) {
    setMessage('Signing in...');
    try {
      const response = await fetch(`${apiUrl}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });
      const data = await responseJson<{ token?: string; user?: { role?: string; forcePasswordChange?: boolean }; message?: string }>(response);
      if (!response.ok || !data.token || !data.user) throw new Error(data.message || 'Google sign-in failed');
      window.localStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token);
      setRole(data.user.role || '');
      setForcePasswordChange(Boolean(data.user.forcePasswordChange));
    } catch (error) {
      setMessage(errorMessage(error, 'Google sign-in failed'));
    }
  }

  function initializeGoogle() {
    const element = document.getElementById('google-button');
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!element || !window.google || !clientId) return;
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: ({ credential }) => signInWithGoogle(credential),
    });
    window.google.accounts.id.renderButton(element, { theme: 'outline', size: 'large', width: '330' });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage('Signing in...');
    try {
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await responseJson<{ token?: string; user?: { role?: string; forcePasswordChange?: boolean }; message?: string }>(response);
      if (!response.ok || !data.token || !data.user) throw new Error(data.message || 'Unable to sign in');
      window.localStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token);
      setRole(data.user.role || '');
      setForcePasswordChange(Boolean(data.user.forcePasswordChange));
    } catch (error) {
      setMessage(errorMessage(error, 'Unable to sign in'));
    }
  }

  if (!sessionChecked) {
    return (
      <main className="login-shell">
        <section className="login-card">
          <p className="eyebrow">HEX TORQ CLOUD</p>
          <h1>Cloud Console</h1>
          <p className="muted">Checking your session...</p>
        </section>
      </main>
    );
  }

  if (token) {
    return forcePasswordChange ? (
      <PasswordChange token={token} onComplete={() => setForcePasswordChange(false)} />
    ) : (
      <Dashboard token={token} role={role} />
    );
  }

  return (
    <main className="login-shell">
      <Script src="https://accounts.google.com/gsi/client" onLoad={initializeGoogle} />
      <section className="login-card">
        <p className="eyebrow">HEX TORQ CLOUD</p>
        <h1>Cloud Console</h1>
        <p className="muted">Manage deployments across every connected VPS.</p>
        <form onSubmit={submit}>
          <label>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          <button type="submit">Sign in</button>
        </form>
        <div id="google-button" className="google-button" />
        {message && <p className="message">{message}</p>}
        <p className="help">Need access? Contact your HexTorq administrator.</p>
      </section>
    </main>
  );
}

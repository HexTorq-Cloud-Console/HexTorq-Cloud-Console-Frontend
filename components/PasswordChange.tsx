'use client';

import { FormEvent, useState } from 'react';
import Logo from './Logo';
import { apiUrl, errorMessage, responseJson } from '../lib/api';

type PasswordChangeProps = {
  token: string;
  email?: string;
  onComplete: () => void;
  onSignOut?: () => void;
};

export default function PasswordChange({ token, email, onComplete, onSignOut }: PasswordChangeProps) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [reveal, setReveal] = useState(false);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const lengthMet = password.length >= 8;
  const matchMet = confirmation.length > 0 && password === confirmation;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    if (!lengthMet || !matchMet) {
      setMessage('Passwords must match and contain at least 8 characters.');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`${apiUrl}/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ password }),
      });
      const data = await responseJson<{ message?: string }>(response);
      if (!response.ok) throw new Error(data.message || 'Unable to change password');
      onComplete();
    } catch (error) {
      setMessage(errorMessage(error, 'Unable to change password'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-glow auth-glow--blue" aria-hidden="true" />
      <div className="auth-glow auth-glow--violet" aria-hidden="true" />

      <div className="auth-center-card">
        <div className="auth-logo-row">
          <Logo size="md" tagline />
        </div>
        <div className="auth-vault">
          <span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="4" y="10" width="16" height="11" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
            HexTorq Security Vault
          </span>
        </div>

        <section className="auth-card auth-card--wide" aria-labelledby="password-title">
          <div className="auth-shield" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3 4.5 6v6c0 4.4 3.2 7.6 7.5 9 4.3-1.4 7.5-4.6 7.5-9V6L12 3Z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>

          <h1 id="password-title" className="auth-title">
            Set a new password
          </h1>
          <p className="auth-sub">This is your first sign-in. Replace your temporary password to continue.</p>

          {email && (
            <div className="auth-user-chip">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m2 7 10 6 10-6" />
              </svg>
              <code>{email}</code>
              {onSignOut && (
                <button type="button" onClick={onSignOut}>
                  Sign out
                </button>
              )}
            </div>
          )}

          {message && (
            <div className="auth-alert" role="alert">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v5M12 16h.01" />
              </svg>
              <span>{message}</span>
            </div>
          )}

          <form className="auth-form" onSubmit={submit}>
            <div className="auth-field">
              <div className="auth-label-row">
                <label className="auth-label" htmlFor="new-password">
                  New Password
                </label>
                <span className="auth-label-hint">Min. 8 characters</span>
              </div>
              <div className="auth-input-wrap">
                <svg className="auth-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="4" y="10" width="16" height="11" rx="2" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
                <input
                  id="new-password"
                  className="auth-input auth-input--with-action"
                  type={reveal ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  className="auth-icon-btn"
                  onClick={() => setReveal((current) => !current)}
                  aria-label={reveal ? 'Hide password' : 'Show password'}
                  aria-pressed={reveal}
                >
                  {reveal ? (
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

            <div className="auth-field">
              <div className="auth-label-row">
                <label className="auth-label" htmlFor="confirm-password">
                  Confirm New Password
                </label>
                {matchMet && <span className="auth-label-hint auth-hint--ok">Matched</span>}
              </div>
              <div className="auth-input-wrap">
                <svg className="auth-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 3 4.5 6v6c0 4.4 3.2 7.6 7.5 9 4.3-1.4 7.5-4.6 7.5-9V6L12 3Z" />
                </svg>
                <input
                  id="confirm-password"
                  className="auth-input"
                  type={reveal ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  required
                  minLength={8}
                />
              </div>
            </div>

            <div className="auth-rules">
              <p className="auth-rules__title">Password requirements</p>
              <p className={`auth-rule${lengthMet ? ' is-met' : ''}`}>
                {lengthMet ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" />
                    <path d="m8.5 12 2.5 2.5 4.5-4.5" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" />
                  </svg>
                )}
                At least 8 characters
              </p>
              <p className={`auth-rule${matchMet ? ' is-met' : ''}`}>
                {matchMet ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" />
                    <path d="m8.5 12 2.5 2.5 4.5-4.5" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" />
                  </svg>
                )}
                Passwords match
              </p>
            </div>

            <button className="auth-submit" type="submit" disabled={saving}>
              {saving ? 'Updating password…' : 'Update password & continue'}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

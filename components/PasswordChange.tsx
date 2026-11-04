'use client';

import { FormEvent, useState } from 'react';
import { apiUrl, errorMessage, responseJson } from '../lib/api';
function PasswordChange({ token, onComplete }: { token: string; onComplete: () => void }) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8 || password !== confirmation) {
      setMessage('Passwords must match and contain at least 8 characters.');
      return;
    }
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
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <p className="eyebrow">FIRST LOGIN</p>
        <h1>Set your password</h1>
        <p className="muted">Your administrator provided a temporary password. Choose a private password before continuing.</p>
        <form onSubmit={submit}>
          <label>
            New password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} />
          </label>
          <label>
            Confirm password
            <input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required minLength={8} />
          </label>
          <button type="submit">Save password</button>
        </form>
        {message && <p className="error">{message}</p>}
      </section>
    </main>
  );
}
export default PasswordChange;

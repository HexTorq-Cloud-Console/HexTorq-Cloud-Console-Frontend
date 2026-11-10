'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientAccess } from '../types/api';

const REVEAL_AUTO_HIDE_MS = 30 * 1000;

function postgresConnectionUri(entry: ClientAccess) {
  const username = encodeURIComponent(entry.username || '');
  const database = entry.databaseName ? encodeURIComponent(entry.databaseName) : '';
  const sslMode = encodeURIComponent(entry.sslMode || 'Prefer');
  return `postgresql://${username}@${entry.host}:${entry.port}/${database}?sslmode=${sslMode}`;
}

function AccessEntryCard({ entry, onReveal }: { entry: ClientAccess; onReveal?: (accessId: string) => Promise<string | null> }) {
  const [secretVisible, setSecretVisible] = useState(false);
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [loadingSecret, setLoadingSecret] = useState(false);
  const [revealError, setRevealError] = useState('');
  const [copied, setCopied] = useState('');
  const autoHideRef = useRef<number | null>(null);

  const fields: Array<{ label: string; value: string }> = [
    { label: 'Host', value: entry.host },
    { label: 'Port', value: String(entry.port) },
  ];

  if (entry.type === 'SFTP') {
    fields.push(
      { label: 'Protocol', value: 'SFTP' },
      { label: 'Username', value: entry.username },
      { label: 'Path', value: entry.path || '/' },
    );
  } else {
    fields.push(
      { label: 'Maintenance database', value: entry.databaseName || '' },
      { label: 'Username', value: entry.username },
      { label: 'SSL mode', value: entry.sslMode || 'Prefer' },
    );
  }

  const hideSecret = useCallback(() => {
    if (autoHideRef.current !== null) {
      window.clearTimeout(autoHideRef.current);
      autoHideRef.current = null;
    }
    setSecretVisible(false);
    setRevealedPassword(null);
    setRevealError('');
  }, []);

  useEffect(() => {
    return () => {
      if (autoHideRef.current !== null) window.clearTimeout(autoHideRef.current);
    };
  }, []);

  async function copyField(label: string, value: string) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(''), 1500);
    } catch {
      // Clipboard access can be blocked by the browser; the value remains selectable.
    }
  }

  async function revealSecret() {
    if (!onReveal || loadingSecret) return;
    setLoadingSecret(true);
    setRevealError('');
    try {
      const password = await onReveal(entry.id);
      if (password === null) {
        setRevealError('No password is available for this entry.');
        return;
      }
      setRevealedPassword(password);
      setSecretVisible(true);
      autoHideRef.current = window.setTimeout(hideSecret, REVEAL_AUTO_HIDE_MS);
    } catch (error) {
      setRevealError(error instanceof Error ? error.message : 'Unable to reveal password');
    } finally {
      setLoadingSecret(false);
    }
  }

  const revealReady = Boolean(onReveal);
  const connectionText = entry.type === 'SFTP'
    ? `Host: ${entry.host}:${entry.port}\nUser: ${entry.username}\nPath: ${entry.path || '/'}`
    : postgresConnectionUri(entry);

  return (
    <article className={`access-card ${entry.type === 'DATABASE' ? 'database' : 'sftp'}`}>
      <div className="access-card-head">
        <span className={`access-type-badge ${entry.type === 'DATABASE' ? 'database' : 'sftp'}`}>
          {entry.type === 'DATABASE' ? 'POSTGRESQL' : 'SFTP'}
        </span>
        <span className={`access-state ${entry.enabled ? 'enabled' : 'disabled'}`}>
          {entry.enabled ? 'Active' : 'Disabled'}
        </span>
      </div>
      <h3>{entry.label}</h3>
      {entry.client && <p className="access-client">{entry.client.name}</p>}
      <div className="access-fields">
        {fields.map((field) => (
          <div className="access-field" key={field.label}>
            <span className="access-label">{field.label}</span>
            <div className="access-value-row">
              <code>{field.value || 'Not set'}</code>
              {field.value && (
                <button type="button" className="mini-button" onClick={() => copyField(field.label, field.value)}>
                  {copied === field.label ? 'Copied' : 'Copy'}
                </button>
              )}
            </div>
          </div>
        ))}
        <div className="access-field">
          <span className="access-label">Password</span>
          <div className="access-value-row">
            <code className={secretVisible ? 'access-secret is-visible' : 'access-secret'}>
              {secretVisible ? revealedPassword || '—' : '••••••••'}
            </code>
            {revealReady && (
              <>
                {secretVisible ? (
                  <button type="button" className="mini-button" onClick={hideSecret}>Hide</button>
                ) : (
                  <button type="button" className="mini-button" onClick={() => void revealSecret()} disabled={loadingSecret}>
                    {loadingSecret ? 'Revealing…' : 'Reveal'}
                  </button>
                )}
                {secretVisible && revealedPassword && (
                  <button type="button" className="mini-button" onClick={() => copyField('Password', revealedPassword)}>
                    {copied === 'Password' ? 'Copied' : 'Copy'}
                  </button>
                )}
              </>
            )}
          </div>
          {revealError && <span className="access-reveal-error">{revealError}</span>}
          {!revealReady && (
            <span className="access-hint">Password is not available in this view.</span>
          )}
        </div>
      </div>

      <div className="access-connection">
        <div className="access-connection__head">
          <span className="access-label">{entry.type === 'SFTP' ? 'FileZilla connection' : 'PostgreSQL connection'}</span>
          <button type="button" className="mini-button" onClick={() => copyField('Connection', connectionText)}>
            {copied === 'Connection' ? 'Copied' : 'Copy'}
          </button>
        </div>
        <pre className="access-connection__text">{connectionText}</pre>
        <p className="access-connection__note">
          {entry.type === 'DATABASE'
            ? 'Connection string does not include a password. Add it only when required.'
            : 'Use these details in FileZilla with your password.'}
        </p>
      </div>

      {entry.notes && <p className="access-notes">{entry.notes}</p>}
      {copied === 'Password' && (
        <p className="access-clip-warning">Copied to clipboard — treat as sensitive.</p>
      )}
    </article>
  );
}
export default AccessEntryCard;
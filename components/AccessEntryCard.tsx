'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { ClientAccess } from '../types/api';
import { showSakugaToast } from '../lib/sakugaToast';

const REVEAL_AUTO_HIDE_MS = 30 * 1000;

function postgresConnectionUri(entry: ClientAccess) {
  const username = encodeURIComponent(entry.username || '');
  const database = entry.databaseName ? encodeURIComponent(entry.databaseName) : '';
  const sslMode = encodeURIComponent(entry.sslMode || 'Prefer');
  return `postgresql://${username}@${entry.host}:${entry.port}/${database}?sslmode=${sslMode}`;
}

function AccessEntryCard({
  entry,
  onReveal,
}: {
  entry: ClientAccess;
  onReveal?: (accessId: string) => Promise<string | null>;
}) {
  const [secretVisible, setSecretVisible] = useState(false);
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [loadingSecret, setLoadingSecret] = useState(false);
  const [revealError, setRevealError] = useState('');
  const [copied, setCopied] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const autoHideRef = useRef<number | null>(null);
  const copyTimerRef = useRef<number | null>(null);
  const statusId = useId();

  const fields: Array<{ label: string; value: string; mono?: boolean }> = [
    { label: 'Host', value: entry.host, mono: true },
    { label: 'Port', value: String(entry.port), mono: true },
  ];

  if (entry.type === 'SFTP') {
    fields.push(
      { label: 'Protocol', value: 'SFTP' },
      { label: 'Username', value: entry.username, mono: true },
      { label: 'Path', value: entry.path || '/', mono: true },
    );
  } else {
    fields.push(
      { label: 'Database', value: entry.databaseName || '', mono: true },
      { label: 'Username', value: entry.username, mono: true },
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
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  async function copyField(label: string, value: string) {
    if (!value) return;
    if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setCopyStatus(`${label} copied`);
      showSakugaToast(`${label} copied`);
    } catch {
      setCopied('');
      setCopyStatus(`Unable to copy ${label.toLowerCase()}`);
    }
    copyTimerRef.current = window.setTimeout(() => {
      setCopied('');
      setCopyStatus('');
    }, 1800);
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
  const isDb = entry.type === 'DATABASE';
  const connectionText = isDb
    ? postgresConnectionUri(entry)
    : `sftp://${entry.username}@${entry.host}:${entry.port}${entry.path || '/'}`;

  return (
    <article className={`access-card access-card--compact ${isDb ? 'database' : 'sftp'}`}>
      <header className="access-card__top">
        <div className="access-card__title-wrap">
          <div className="access-card__badges">
            <span className={`access-type-badge ${isDb ? 'database' : 'sftp'}`}>
              {isDb ? 'POSTGRESQL' : 'SFTP'}
            </span>
            <span className={`access-state ${entry.enabled ? 'enabled' : 'disabled'}`}>
              <span className="ht-dot" /> {entry.enabled ? 'Active' : 'Disabled'}
            </span>
          </div>
          <h3>{entry.label}</h3>
          {entry.client && <p className="access-client">{entry.client.name}</p>}
        </div>
        <span id={statusId} className="access-copy-live" role="status" aria-live="polite">
          {copyStatus}
        </span>
      </header>

      <dl className="access-grid-fields">
        {fields.map((field) => {
          const isCopied = copied === field.label;
          return (
            <div className="access-kv" key={field.label}>
              <dt className="access-label">{field.label}</dt>
              <dd className="access-kv__val">
                <code className={field.mono ? 'is-mono' : undefined} title={field.value || undefined}>
                  {field.value || 'Not set'}
                </code>
                {field.value && (
                  <button
                    type="button"
                    className="mini-button access-copy-btn"
                    data-copied={isCopied ? '' : undefined}
                    aria-label={`Copy ${field.label}`}
                    onClick={() => void copyField(field.label, field.value)}
                  >
                    {isCopied ? '✓' : 'Copy'}
                  </button>
                )}
              </dd>
            </div>
          );
        })}

        <div className="access-kv access-kv--secret">
          <dt className="access-label">Password</dt>
          <dd className="access-kv__val">
            <code className={secretVisible ? 'access-secret is-visible is-mono' : 'access-secret is-mono'}>
              {secretVisible ? revealedPassword || '—' : '••••••••••'}
            </code>
            {revealReady && (
              <span className="access-secret-actions">
                {secretVisible ? (
                  <button type="button" className="mini-button" onClick={hideSecret}>Hide</button>
                ) : (
                  <button
                    type="button"
                    className="mini-button"
                    onClick={() => void revealSecret()}
                    disabled={loadingSecret}
                  >
                    {loadingSecret ? '…' : 'Reveal'}
                  </button>
                )}
                {secretVisible && revealedPassword && (
                  <button
                    type="button"
                    className="mini-button access-copy-btn"
                    data-copied={copied === 'Password' ? '' : undefined}
                    aria-label="Copy Password"
                    onClick={() => void copyField('Password', revealedPassword)}
                  >
                    {copied === 'Password' ? '✓' : 'Copy'}
                  </button>
                )}
              </span>
            )}
          </dd>
          {revealError && <span className="access-reveal-error">{revealError}</span>}
          {!revealReady && <span className="access-hint">Unavailable here</span>}
        </div>
      </dl>

      <footer className="access-conn-bar">
        <span className="access-conn-bar__label">{isDb ? 'URI' : 'SFTP'}</span>
        <code className="access-conn-bar__code" title={connectionText}>{connectionText}</code>
        <button
          type="button"
          className="mini-button access-conn-bar__btn"
          data-copied={copied === 'Connection' ? '' : undefined}
          aria-label={`Copy ${isDb ? 'PostgreSQL URI' : 'SFTP connection'}`}
          onClick={() => void copyField('Connection', connectionText)}
        >
          {copied === 'Connection' ? '✓ Copied' : 'Copy URI'}
        </button>
      </footer>

      {entry.notes && <p className="access-notes access-notes--compact">{entry.notes}</p>}
      {copied === 'Password' && (
        <p className="access-clip-warning">Copied to clipboard — treat as sensitive.</p>
      )}
    </article>
  );
}

export default AccessEntryCard;

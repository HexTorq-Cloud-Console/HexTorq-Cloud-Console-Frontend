'use client';

import { useState } from 'react';
import type { ClientAccess } from '../types/api';
function AccessEntryCard({ entry }: { entry: ClientAccess }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState('');

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
            <code>{entry.password ? (revealed ? entry.password : '••••••••') : 'Unavailable'}</code>
            {entry.password && (
              <>
                <button type="button" className="mini-button" onClick={() => setRevealed((current) => !current)}>
                  {revealed ? 'Hide' : 'Show'}
                </button>
                <button type="button" className="mini-button" onClick={() => copyField('Password', entry.password || '')}>
                  {copied === 'Password' ? 'Copied' : 'Copy'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      {entry.notes && <p className="access-notes">{entry.notes}</p>}
    </article>
  );
}
export default AccessEntryCard;

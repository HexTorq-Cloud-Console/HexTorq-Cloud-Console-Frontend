'use client';

import { useEffect, useState } from 'react';
import { apiUrl, responseJson } from '../lib/api';

type BackupDatabase = { id: string; accessId: string; label: string; databaseName?: string | null; host: string; port: number; backupEnabled: boolean };

export default function DatabaseBackupsView({ token }: { token: string }) {
  const [enabled, setEnabled] = useState(false);
  const [databases, setDatabases] = useState<BackupDatabase[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [backups, setBackups] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    const headers = { Authorization: `Bearer ${token}` };
    const [optionsResponse, historyResponse] = await Promise.all([fetch(`${apiUrl}/database-backups/options`, { headers }), fetch(`${apiUrl}/database-backups`, { headers })]);
    const options = await responseJson<{ enabled?: boolean; databases?: BackupDatabase[] }>(optionsResponse);
    const history = await responseJson<{ backups?: any[] }>(historyResponse);
    if (optionsResponse.ok) { setEnabled(Boolean(options.enabled)); setDatabases(options.databases || []); setSelected((current) => current.filter((id) => (options.databases || []).some((database) => database.id === id && database.backupEnabled))); }
    if (historyResponse.ok) setBackups(history.backups || []);
  }

  useEffect(() => { void load(); }, [token]);

  async function createBackup() {
    setBusy(true); setError('');
    try {
      const targets = databases.filter((database) => selected.includes(database.id)).map(({ accessId, databaseName }) => ({ accessId, databaseName }));
      const response = await fetch(`${apiUrl}/database-backups`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ databases: targets }) });
      const data = await responseJson<{ backup?: any; message?: string }>(response);
      if (!response.ok || !data.backup) throw new Error(data.message || 'Unable to start database backup');
      setBackups((current) => [data.backup, ...current]);
      const stream = await fetch(`${apiUrl}/database-backups/${encodeURIComponent(data.backup.id)}/stream`, { headers: { Authorization: `Bearer ${token}` } });
      if (!stream.ok || !stream.body) throw new Error('Backup started, but live progress is unavailable');
      const reader = stream.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true }); const events = buffer.split('\n\n'); buffer = events.pop() || '';
        for (const event of events) { const line = event.split('\n').find((item) => item.startsWith('data: ')); if (!line) continue; const current = JSON.parse(line.slice(6)); setBackups((items) => items.map((item) => item.id === current.id ? current : item)); }
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to start database backup'); }
    finally { setBusy(false); }
  }

  async function download(id: string, name: string) {
    const response = await fetch(`${apiUrl}/database-backups/${encodeURIComponent(id)}/download`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) return;
    const url = URL.createObjectURL(await response.blob()); const link = document.createElement('a'); link.href = url; link.download = name || 'database-backup.zip'; link.click(); URL.revokeObjectURL(url);
  }

  return <section className="database-backups-page" aria-labelledby="database-backups-title">
    <header className="database-backups-page__header"><div><p className="overview-kicker"><span className="overview-kicker__dot" /> POSTGRESQL · SECURE ARCHIVES</p><h2 id="database-backups-title">Database Backups</h2><p>Create timestamped PostgreSQL ZIP backups from your approved databases.</p></div><span className="database-backups-page__retention">30-day retention</span></header>
    <section className="database-backups ht-card"><div className="list-heading"><div><span className="list-kicker">DATABASE DUMP CENTER</span><h3>Select databases</h3></div><span className="list-count">{databases.length}</span></div>
      {!enabled ? <p className="muted">Database backups are not enabled for your account. Contact your administrator.</p> : <><p className="muted">Select one or more approved databases and create a single timestamped ZIP archive.</p><div className="database-backups__choices">{databases.filter((database) => database.backupEnabled).map((database) => <label key={database.id}><input type="checkbox" checked={selected.includes(database.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, database.id] : current.filter((id) => id !== database.id))} /><strong>{database.databaseName}</strong><small>{database.label} · {database.host}:{database.port}</small></label>)}</div>{error && <p className="error">{error}</p>}<button type="button" className="ht-btn ht-btn--primary" disabled={busy || selected.length === 0} onClick={createBackup}>{busy ? 'Backup in progress…' : 'Create database backup'}</button></>}</section>
    {backups.length > 0 && <section className="database-backups__history"><div className="database-backups__history-head"><h3>Backup history</h3><span>{backups.length} archive{backups.length === 1 ? '' : 's'}</span></div>{backups.map((backup) => <article key={backup.id}><div><strong>{backup.archiveName || 'Backup in progress'}</strong><small>{backup.status} · {backup.completedDatabases}/{backup.totalDatabases} databases</small></div>{backup.status === 'RUNNING' && <progress max={backup.totalDatabases} value={backup.completedDatabases} />}{['SUCCESS','PARTIAL'].includes(backup.status) && <button type="button" onClick={() => download(backup.id, backup.archiveName)}>Download ZIP</button>}{backup.items?.map((item: any) => <small key={item.id}>{item.databaseName}: {item.status}{item.message ? ` — ${item.message}` : ''}</small>)}</article>)}</section>}
  </section>;
}

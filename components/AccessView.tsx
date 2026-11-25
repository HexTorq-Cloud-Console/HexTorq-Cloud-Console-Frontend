'use client';

import { useEffect, useState } from 'react';
import type { ClientAccess } from '../types/api';
import AccessEntryCard from './AccessEntryCard';
import { apiUrl, responseJson } from '../lib/api';

export default function AccessView({ entries, token }: { entries: ClientAccess[]; token: string }) {
  const [filter, setFilter] = useState<'ALL' | 'SFTP' | 'DATABASE'>('ALL');
  const [backupEnabled, setBackupEnabled] = useState(false);
  const [backupDatabases, setBackupDatabases] = useState<Array<{ id: string; accessId: string; label: string; databaseName?: string | null; host: string; port: number; backupEnabled: boolean }>>([]);
  const [selectedDatabases, setSelectedDatabases] = useState<string[]>([]);
  const [backups, setBackups] = useState<any[]>([]);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupError, setBackupError] = useState('');
  const visible = entries.filter((entry) => filter === 'ALL' || entry.type === filter);

  async function loadBackups() {
    const headers = { Authorization: `Bearer ${token}` };
    const [optionsResponse, historyResponse] = await Promise.all([
      fetch(`${apiUrl}/database-backups/options`, { headers }),
      fetch(`${apiUrl}/database-backups`, { headers }),
    ]);
    const options = await responseJson<{ enabled?: boolean; databases?: typeof backupDatabases }>(optionsResponse);
    const history = await responseJson<{ backups?: any[] }>(historyResponse);
    if (optionsResponse.ok) {
      setBackupEnabled(Boolean(options.enabled));
      setBackupDatabases(options.databases || []);
      setSelectedDatabases((current) => current.filter((id) => (options.databases || []).some((db) => db.id === id && db.backupEnabled)));
    }
    if (historyResponse.ok) setBackups(history.backups || []);
  }

  useEffect(() => { void loadBackups(); }, [token]);

  async function createBackup() {
    setBackupBusy(true); setBackupError('');
    try {
      const targets = backupDatabases.filter((database) => selectedDatabases.includes(database.id)).map(({ accessId, databaseName }) => ({ accessId, databaseName }));
      const response = await fetch(`${apiUrl}/database-backups`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ databases: targets }) });
      const data = await responseJson<{ backup?: any; message?: string }>(response);
      if (!response.ok || !data.backup) throw new Error(data.message || 'Unable to start database backup');
      setBackups((current) => [data.backup, ...current]);
      const stream = await fetch(`${apiUrl}/database-backups/${encodeURIComponent(data.backup.id)}/stream`, { headers: { Authorization: `Bearer ${token}` } });
      if (!stream.ok || !stream.body) throw new Error('Backup started, but live progress is unavailable');
      const reader = stream.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
      while (true) {
        const { value, done } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n'); buffer = events.pop() || '';
        for (const event of events) {
          const line = event.split('\n').find((item) => item.startsWith('data: '));
          if (!line) continue;
          const current = JSON.parse(line.slice(6));
          setBackups((items) => items.map((item) => item.id === current.id ? current : item));
        }
      }
    } catch (reason) { setBackupError(reason instanceof Error ? reason.message : 'Unable to start database backup'); }
    finally { setBackupBusy(false); }
  }

  async function downloadBackup(id: string, name: string) {
    const response = await fetch(`${apiUrl}/database-backups/${encodeURIComponent(id)}/download`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) return;
    const url = URL.createObjectURL(await response.blob()); const link = document.createElement('a'); link.href = url; link.download = name || 'database-backup.zip'; link.click(); URL.revokeObjectURL(url);
  }

  async function revealPassword(accessId: string) {
    const response = await fetch(`${apiUrl}/access/${encodeURIComponent(accessId)}/reveal`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await responseJson<{ password?: string | null; message?: string }>(response);
    if (!response.ok || data.password == null) throw new Error(data.message || 'Unable to reveal password');
    return data.password;
  }

  return <section className="access-page" id="access-list" aria-labelledby="access-title">
    <header className="access-page__header"><div><p className="overview-kicker"><span className="overview-kicker__dot" /> CREDENTIAL VAULT · ENCRYPTED</p><h2 id="access-title">Access Credentials</h2><p>Connection details assigned to your account. Passwords are revealed on demand and hidden again automatically.</p></div><div className="access-filters" role="tablist">{(['ALL','SFTP','DATABASE'] as const).map((item) => <button type="button" role="tab" aria-selected={filter===item} className={filter===item?'is-active':''} onClick={()=>setFilter(item)} key={item}>{item==='ALL'?'All':item==='SFTP'?'SFTP (FileZilla)':'PostgreSQL'}</button>)}</div></header>
    {visible.length === 0 ? <div className="ht-card ht-empty">No credentials assigned yet. Contact your administrator.</div> : <div className="access-page__grid">{visible.map((entry)=><AccessEntryCard entry={entry} key={entry.id} onReveal={revealPassword}/>)}</div>}
    <section className="ht-card database-backups" aria-labelledby="database-backups-title">
      <div className="list-heading"><div><span className="list-kicker">POSTGRESQL BACKUPS</span><h3 id="database-backups-title">Database dump center</h3></div><span className="list-count">{backups.length}</span></div>
      {!backupEnabled ? <p className="muted">Database backups are not enabled for your account. Contact your administrator.</p> : <>
        <p className="muted">Select approved databases and create one timestamped ZIP backup. Backup files are retained for one month.</p>
        <div className="database-backups__choices">{backupDatabases.filter((db) => db.backupEnabled).map((db) => <label key={db.id}><input type="checkbox" checked={selectedDatabases.includes(db.id)} onChange={(event) => setSelectedDatabases((current) => event.target.checked ? [...current, db.id] : current.filter((id) => id !== db.id))} /> <strong>{db.label}</strong><small>{db.databaseName} · {db.host}:{db.port}</small></label>)}</div>
        {backupError && <p className="error">{backupError}</p>}
        <button type="button" className="ht-btn ht-btn--primary" disabled={backupBusy || selectedDatabases.length === 0} onClick={createBackup}>{backupBusy ? 'Backup in progress…' : 'Create database backup'}</button>
      </>}
      {backups.length > 0 && <div className="database-backups__history"><h4>Backup history</h4>{backups.map((backup) => <article key={backup.id}><div><strong>{backup.archiveName || 'Backup in progress'}</strong><small>{backup.status} · {backup.completedDatabases}/{backup.totalDatabases} databases</small></div>{backup.status === 'RUNNING' && <progress max={backup.totalDatabases} value={backup.completedDatabases} />}{['SUCCESS','PARTIAL'].includes(backup.status) && <button type="button" onClick={() => downloadBackup(backup.id, backup.archiveName)}>Download ZIP</button>}{backup.items?.map((item: any) => <small key={item.id}>{item.label}: {item.status}{item.message ? ` — ${item.message}` : ''}</small>)}</article>)}</div>}
    </section>
    <p className="access-security"><span aria-hidden="true">♢</span> Passwords are stored encrypted and shown only to your account.</p>
  </section>;
}

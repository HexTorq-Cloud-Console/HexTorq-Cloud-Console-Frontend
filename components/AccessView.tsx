'use client';

import { useState } from 'react';
import type { ClientAccess } from '../types/api';
import AccessEntryCard from './AccessEntryCard';
import { apiUrl, responseJson } from '../lib/api';

export default function AccessView({ entries, token }: { entries: ClientAccess[]; token: string }) {
  const [filter, setFilter] = useState<'ALL' | 'SFTP' | 'DATABASE'>('ALL');
  const visible = entries.filter((entry) => filter === 'ALL' || entry.type === filter);

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
    <p className="access-security"><span aria-hidden="true">♢</span> Passwords are stored encrypted and shown only to your account.</p>
  </section>;
}
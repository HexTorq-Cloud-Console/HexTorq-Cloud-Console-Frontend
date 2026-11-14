'use client';

import { useState } from 'react';
import NotificationSettings from './NotificationSettings';
import type { FailureAlert } from '../types/api';

export default function AlertsView({ alerts, onDismiss, onDismissAll }: { alerts: FailureAlert[]; onDismiss: (id: string) => void; onDismissAll: () => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return <section className="alerts-page" id="alerts-list" aria-labelledby="alerts-title">
    <header className="alerts-page__header"><div><p className="overview-kicker"><span className="overview-kicker__dot overview-kicker__dot--danger" /> SESSION ALERTS</p><h2 id="alerts-title">Alerts <span>{alerts.length}</span></h2><p>Deployment and webhook failures requiring attention.</p></div><button className="ht-btn ht-btn--secondary" type="button" onClick={onDismissAll} disabled={!alerts.length}>Dismiss all</button></header>
    <NotificationSettings />
    {alerts.length===0 ? <div className="ht-card ht-empty">No active alerts. Your deployment and webhook activity is healthy.</div> : <div className="alerts-list">{alerts.map((alert)=><article data-ascii="surface" className="alert-card" key={alert.id}><div className="alert-card__head"><span className="alert-card__icon">!</span><div><h3>{alert.title}</h3><time>{new Date(alert.timestamp).toLocaleString()}</time></div><button type="button" className="alert-card__close" onClick={()=>onDismiss(alert.id)} aria-label={`Dismiss ${alert.title}`}>×</button></div><div className="alert-card__details"><div><span>Error message</span><p>{alert.details.split('\n')[0] || 'Failure reported by the deployment pipeline.'}</p></div><div><span>Failure details</span><p>{alert.details.split('\n').slice(1,3).join(' ') || 'See the full deployment log below.'}</p></div></div><button type="button" className="alert-card__log-toggle" onClick={()=>setExpanded(expanded===alert.id?null:alert.id)}>▣ {expanded===alert.id?'Hide':'View'} full deployment log {expanded===alert.id?'↑':'↓'}</button>{expanded===alert.id&&<pre className="alert-card__log">{alert.details}</pre>}</article>)}</div>}
  </section>;
}

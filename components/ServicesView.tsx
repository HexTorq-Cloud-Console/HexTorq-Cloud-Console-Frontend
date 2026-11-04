'use client';

import { useMemo, useState } from 'react';
import type { Deployment, Pm2Status, Service } from '../types/api';

type ServicesViewProps = {
  services: Service[];
  deployments: Deployment[];
  pm2Status: Record<string, Pm2Status>;
  deploying: string | null;
  pm2Action: string | null;
  onDeploy: (serviceId: string, force?: boolean) => void;
  onForceDeploy: (serviceId: string) => void;
  onPm2: (serviceId: string, action: string) => void;
  onLogs: (service: Service) => void;
  onDetails: (service: Service) => void;
};

type Filter = 'ALL' | 'PM2' | 'STATIC' | 'ENABLED' | 'DISABLED';

function latestFor(service: Service, deployments: Deployment[]) {
  return deployments.find((deployment) => deployment.service.id === service.id);
}

export default function ServicesView({ services, deployments, pm2Status, deploying, pm2Action, onDeploy, onForceDeploy, onPm2, onLogs, onDetails }: ServicesViewProps) {
  const [filter, setFilter] = useState<Filter>('ALL');
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return services.filter((service) => {
      const matchesFilter = filter === 'ALL'
        || (filter === 'PM2' && service.type === 'PM2')
        || (filter === 'STATIC' && service.type === 'STATIC_FRONTEND')
        || (filter === 'ENABLED' && service.enabled)
        || (filter === 'DISABLED' && !service.enabled);
      const matchesQuery = !normalized || [service.name, service.branch, service.projectKey, service.pm2ProcessName || ''].some((value) => value.toLowerCase().includes(normalized));
      return matchesFilter && matchesQuery;
    });
  }, [filter, query, services]);

  const counts: Record<Filter, number> = {
    ALL: services.length,
    PM2: services.filter((service) => service.type === 'PM2').length,
    STATIC: services.filter((service) => service.type === 'STATIC_FRONTEND').length,
    ENABLED: services.filter((service) => service.enabled).length,
    DISABLED: services.filter((service) => !service.enabled).length,
  };

  return (
    <section className="services-page" id="services-list" aria-labelledby="services-title">
      <header className="services-page__header">
        <div>
          <p className="overview-kicker"><span className="overview-kicker__dot" /> WORKSPACE / SERVICE REGISTRY</p>
          <h2 id="services-title">Services <span>{services.length} total</span></h2>
          <p>Manage application processes, Git deployments, and runtime environments.</p>
        </div>
        <button className="ht-btn ht-btn--secondary" type="button" onClick={() => window.location.reload()}>↻ Refresh status</button>
      </header>

      <div className="services-toolbar">
        <div className="services-filters" role="tablist" aria-label="Service filters">
          {(['ALL', 'PM2', 'STATIC', 'ENABLED', 'DISABLED'] as Filter[]).map((item) => (
            <button key={item} type="button" role="tab" aria-selected={filter === item} className={`services-filter${filter === item ? ' is-active' : ''}`} onClick={() => setFilter(item)}>
              {item === 'STATIC' ? 'Static' : item.charAt(0) + item.slice(1).toLowerCase()} <span>{counts[item]}</span>
            </button>
          ))}
        </div>
        <label className="services-search">
          <span aria-hidden="true">⌕</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter services by name, branch, or commit…" aria-label="Filter services" />
        </label>
      </div>

      {filtered.length === 0 ? <div className="ht-card ht-empty">No services match the selected filter.</div> : (
        <div className="services-grid">
          {filtered.map((service) => {
            const latest = latestFor(service, deployments);
            const status = service.type === 'PM2' ? pm2Status[service.id] : undefined;
            const busy = deploying === service.id;
            const action = pm2Action?.startsWith(`${service.id}:`) ? pm2Action.split(':')[1] : null;
            return (
              <article className={`service-tile${service.enabled ? '' : ' is-disabled'}${service.agent.enabled ? '' : ' is-agent-offline'}`} key={service.id}>
                <button type="button" className="service-tile__head" onClick={() => onDetails(service)} aria-label={`Open details for ${service.name}`}>
                  <span className={`service-tile__icon service-tile__icon--${service.type === 'PM2' ? 'pm2' : 'static'}`} aria-hidden="true">{service.type === 'PM2' ? '▣' : '▤'}</span>
                  <span className="service-tile__name"><strong>{service.name}</strong><small>{service.type === 'PM2' ? 'PM2 process' : 'Static frontend'}</small></span>
                  <span className={`ht-pill ${service.enabled ? 'ht-pill--success' : 'ht-pill--danger'}`}><span className="ht-dot" /> {service.enabled ? 'ENABLED' : 'DISABLED'}</span>
                </button>
                 <div className="service-tile__meta"><span>{service.agent.name}</span><span>·</span><span>{service.branch}</span>{!service.agent.enabled && <span className="service-agent-warning">● agent unreachable</span>}</div>
                <div className="service-tile__commit"><code>{latest?.commitHash ? latest.commitHash.slice(0, 8) : '—'}</code><span>{latest?.commitMessage || 'No deployment recorded'}</span></div>
                <div className="service-tile__runtime">
                  {service.type === 'PM2' ? <><span className={`ht-dot ${status?.status === 'online' ? 'ht-dot--live' : ''}`} style={{ color: status?.status === 'online' ? 'var(--ht-success)' : 'var(--ht-danger)' }} /> {status?.status || 'unknown'} <span>·</span> CPU {status?.cpu ?? 0}% <span>·</span> {Math.round((status?.memory || 0) / 1024 / 1024)} MB <span>·</span> {status?.restarts || 0} restarts</> : <>◈ static frontend <span>·</span> {service.deployDirectory || service.workingDirectory}</>}
                </div>
                <div className="service-tile__actions">
                  <button className="ht-btn ht-btn--primary" type="button" onClick={() => onDeploy(service.id)} disabled={!service.enabled || busy}>{busy ? 'Deploying…' : service.type === 'PM2' && status?.status === 'stopped' ? 'Start & deploy' : 'Normal deploy'}</button>
                  <button className="ht-btn ht-btn--secondary" type="button" onClick={() => onForceDeploy(service.id)} disabled={!service.enabled || busy}>Force</button>
                  {service.type === 'PM2' && <button className="ht-btn ht-btn--icon" type="button" onClick={() => onLogs(service)} aria-label={`View live logs for ${service.name}`}>▤</button>}
                </div>
                {service.type === 'PM2' && <div className="service-tile__pm2-actions">
                  {(['start', 'stop', 'restart', 'reload'] as const).map((pm2ActionName) => <button key={pm2ActionName} type="button" onClick={() => onPm2(service.id, pm2ActionName)} disabled={!service.enabled || Boolean(action)}>{action === pm2ActionName ? '…' : pm2ActionName}</button>)}
                </div>}
              </article>
            );
          })}
        </div>
      )}

      <footer className="services-footer"><span>◫ Runtime service registry</span><span>{services.filter((service) => service.enabled).length} enabled · {services.filter((service) => service.type === 'PM2').length} PM2 · {services.filter((service) => service.type === 'STATIC_FRONTEND').length} static</span></footer>
    </section>
  );
}

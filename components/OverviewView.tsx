'use client';

import { useState } from 'react';
import type { Deployment, Pm2Status, Service, WebhookHealthData } from '../types/api';
import WebhookHealthPanel from './WebhookHealthPanel';

type OverviewViewProps = {
  services: Service[];
  deployments: Deployment[];
  pm2Status: Record<string, Pm2Status>;
  health: WebhookHealthData | null;
  healthLoading: boolean;
  healthError: string;
  healthRunLoading: boolean;
  failureAlerts: Array<{ id: string; title: string; timestamp: string; details: string }>;
  onDeploy: (serviceId: string, force?: boolean) => void;
  deploying: string | null;
  onHealthSettings: () => void;
  onRunHealth: () => void;
  onAccess: () => void;
  onDeployment: (deploymentId: string) => void;
};

function shortHash(value?: string | null) {
  return value ? value.slice(0, 8) : '—';
}

function relativeTime(value: string) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function serviceTypeLabel(service: Service) {
  return service.type === 'STATIC_FRONTEND' ? 'STATIC' : 'PM2';
}

function healthLabel(health: WebhookHealthData | null) {
  const run = health?.activeRun || health?.latestRun;
  if (!run) return { title: 'NOT RUN', detail: 'No health run recorded' };
  return {
    title: run.status === 'PARTIAL' ? 'PARTIAL' : run.status,
    detail: `${run.successfulServices}/${run.totalServices} passed`,
  };
}

export default function OverviewView({
  services,
  deployments,
  pm2Status,
  health,
  healthLoading,
  healthError,
  healthRunLoading,
  failureAlerts,
  onDeploy,
  deploying,
  onHealthSettings,
  onRunHealth,
  onAccess,
  onDeployment,
}: OverviewViewProps) {
  const [showAllServices, setShowAllServices] = useState(false);
  const [showAllDeployments, setShowAllDeployments] = useState(false);
  const clientName = services[0]?.client.name || 'your workspace';
  const recentCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentDeployments = deployments.filter((deployment) => new Date(deployment.startedAt).getTime() >= recentCutoff);
  const completedRecent = recentDeployments.filter((deployment) => deployment.status !== 'DEPLOYING' && deployment.status !== 'QUEUED');
  const successfulRecent = completedRecent.filter((deployment) => deployment.status === 'SUCCESS');
  const successRate = completedRecent.length ? Math.round((successfulRecent.length / completedRecent.length) * 1000) / 10 : null;
  const pm2Count = services.filter((service) => service.type === 'PM2').length;
  const staticCount = services.filter((service) => service.type === 'STATIC_FRONTEND').length;
  const enabledServices = services.filter((service) => service.enabled);
  const activeServices = showAllServices ? enabledServices : enabledServices.slice(0, 3);
  const latestDeployments = showAllDeployments ? deployments : deployments.slice(0, 5);
  const latestHealth = healthLabel(health);

  return (
    <div className="overview-page">
      {failureAlerts.length > 0 && (
        <section className="overview-alert" aria-live="assertive">
          <span className="overview-alert__icon" aria-hidden="true">!</span>
          <div className="overview-alert__body">
            <strong>{failureAlerts[0].title}</strong>
            <span>{relativeTime(failureAlerts[0].timestamp)} · {failureAlerts.length} alert{failureAlerts.length === 1 ? '' : 's'} active</span>
          </div>
          <span className="overview-alert__reason">Deployment failure requires attention</span>
        </section>
      )}

      <header className="overview-header">
        <div>
          <p className="overview-kicker"><span className="overview-kicker__dot" /> TENANT SPACE · PRODUCTION RUNTIME</p>
          <h1>Good afternoon, {clientName}</h1>
          <p className="overview-subtitle">Deployment telemetry, fleet health, and automated pipelines are available across your services.</p>
        </div>
        <div className="overview-header__actions">
          <span className="overview-context">{services.length} configured service{services.length === 1 ? '' : 's'}</span>
          <button className="ht-btn ht-btn--secondary" type="button" onClick={onRunHealth} disabled={healthRunLoading || !services.length}>
            {healthRunLoading ? 'Running…' : '↻ Run health checks'}
          </button>
        </div>
      </header>

      <section className="overview-metrics" aria-label="Workspace metrics">
        <article className="overview-metric">
          <span className="overview-metric__label">Total services</span>
          <strong>{services.length}</strong>
          <div className="overview-metric__meta"><span>{pm2Count} PM2</span><span>·</span><span>{staticCount} Static</span></div>
          <div className="overview-meter"><span style={{ width: services.length ? '100%' : '0%' }} /></div>
        </article>
        <article className="overview-metric">
          <span className="overview-metric__label">Deployments (7d)</span>
          <strong>{recentDeployments.length}</strong>
          <div className="overview-metric__meta">vs last 7 calendar days</div>
          <div className="overview-spark" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></div>
        </article>
        <article className="overview-metric">
          <span className="overview-metric__label">Success rate</span>
          <strong>{successRate === null ? '—' : `${successRate}%`}</strong>
          <div className="overview-metric__meta">{completedRecent.length ? `${successfulRecent.length} successful / ${completedRecent.length - successfulRecent.length} failed` : 'No completed deployments yet'}</div>
        </article>
        <article className="overview-metric overview-metric--health">
          <span className="overview-metric__label">Health check</span>
          <strong>{latestHealth.title}</strong>
          <div className="overview-metric__meta">{latestHealth.detail}{health?.schedule.nextRunAt ? ` · Next ${relativeTime(health.schedule.nextRunAt)}` : ''}</div>
        </article>
      </section>

      <div className="overview-columns">
        <div className="overview-primary">
          <div className="overview-section-heading">
            <div>
              <h2>Active services <span>{activeServices.length} of {services.length}</span></h2>
            </div>
              <button className="overview-text-button" type="button" onClick={() => setShowAllServices((current) => !current)}>
                {showAllServices ? 'Show preview ↑' : `View all services (${services.length}) →`}
              </button>
          </div>

          <section className="overview-service-list" id="services">
            {activeServices.length === 0 ? (
              <div className="ht-empty">No enabled services are configured yet.</div>
            ) : activeServices.map((service) => {
              const status = service.type === 'PM2' ? pm2Status[service.id] : undefined;
              const latest = deployments.find((deployment) => deployment.service.id === service.id);
              const isDeploying = deploying === service.id;
              return (
                <article className="overview-service" key={service.id}>
                  <div className="overview-service__identity">
                    <span className={`overview-service__icon overview-service__icon--${service.type === 'PM2' ? 'pm2' : 'static'}`} aria-hidden="true">
                      {service.type === 'PM2' ? '▣' : '▤'}
                    </span>
                    <div className="overview-service__copy">
                      <div className="overview-service__title-row">
                        <h3>{service.name}</h3>
                        <span className={`ht-badge ${service.type === 'PM2' ? 'ht-badge--pm2' : 'ht-badge--static'}`}>{serviceTypeLabel(service)}</span>
                        <span className="ht-pill ht-pill--success"><span className="ht-dot" /> ENABLED</span>
                      </div>
                      <p className="overview-service__path">{service.type === 'PM2' ? service.pm2ProcessName || service.workingDirectory : service.deployDirectory || service.workingDirectory}</p>
                      <p className="overview-service__runtime">
                        {service.type === 'PM2' ? <><span className="ht-dot ht-dot--live" /> {status?.status || 'online'} · CPU {status?.cpu ?? 0}% · {Math.round((status?.memory || 0) / 1024 / 1024)} MB · {status?.restarts || 0} restarts</> : <>◈ static frontend · branch {service.branch}</>}
                      </p>
                      <p className="overview-service__commit"><code>{shortHash(latest?.commitHash)}</code> {latest?.commitMessage || 'No deployment recorded yet'}</p>
                    </div>
                  </div>
                  <div className="overview-service__actions">
                    <button className="ht-btn ht-btn--primary" type="button" onClick={() => onDeploy(service.id)} disabled={isDeploying || !service.enabled}>{isDeploying ? 'Deploying…' : 'Normal deploy'}</button>
                    <button className="ht-btn ht-btn--secondary" type="button" onClick={() => onDeploy(service.id, true)} disabled={isDeploying || !service.enabled}>Force deploy</button>
                  </div>
                </article>
              );
            })}
          </section>

          <section className="overview-lower-grid">
            <div>
              <div className="overview-section-heading overview-section-heading--compact">
                <h2>Recent deployments</h2><a href="#deployments">View history →</a>
              </div>
              <div className="overview-deployments" id="deployments">
                {latestDeployments.length === 0 ? <div className="ht-empty">No deployments recorded yet.</div> : latestDeployments.map((deployment) => (
                  <button className="overview-deployment" type="button" key={deployment.id} onClick={() => onDeployment(deployment.id)}>
                    <span className={`overview-deployment__dot overview-deployment__dot--${deployment.status.toLowerCase()}`} />
                    <div><strong>{deployment.service.name}</strong><span>{deployment.commitMessage || 'Message not reported'}</span></div>
                    <code>{shortHash(deployment.commitHash)}</code>
                    <span className={`ht-pill ht-pill--${deployment.status === 'SUCCESS' ? 'success' : deployment.status === 'DEPLOYING' ? 'warning' : 'danger'}`}>{deployment.status}</span>
                    <time>{relativeTime(deployment.startedAt)}</time>
                  </button>
                ))}
                {deployments.length > 5 && <button className="overview-history-toggle" type="button" onClick={() => setShowAllDeployments((current) => !current)}>{showAllDeployments ? 'Show recent deployments ↑' : `View all ${deployments.length} deployments ↓`}</button>}
              </div>
            </div>
            <div id="access">
              <div className="overview-section-heading overview-section-heading--compact"><h2>Client access</h2></div>
              <div className="overview-access-card">
                <p>View the FileZilla/SFTP and database credentials assigned to this account.</p>
                <button className="ht-btn ht-btn--secondary" type="button" onClick={onAccess}>View access credentials →</button>
              </div>
            </div>
          </section>
        </div>

        <aside className="overview-sidebar" id="health">
          <div className="overview-section-heading overview-section-heading--compact"><h2>Webhook health</h2><span className="ht-pill ht-pill--brand">{health?.schedule.enabled ? 'ACTIVE' : 'MANUAL'}</span></div>
          <WebhookHealthPanel health={health} loading={healthLoading} error={healthError} runLoading={healthRunLoading} onSettings={onHealthSettings} onRun={onRunHealth} />
        </aside>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { AnalyticsData, Deployment, Pm2Status, Service, WebhookHealthData } from '../types/api';
import WebhookHealthPanel from './WebhookHealthPanel';

type OverviewViewProps = {
  services: Service[];
  deployments: Deployment[];
  pm2Status: Record<string, Pm2Status>;
  health: WebhookHealthData | null;
  healthLoading: boolean;
  healthError: string;
  healthRunLoading: boolean;
  analytics: AnalyticsData | null;
  email?: string;
  role: string;
  failureAlerts: Array<{ id: string; title: string; timestamp: string; details: string }>;
  onDeploy: (serviceId: string, force?: boolean) => void;
  onForceDeploy: (serviceId: string) => void;
  deploying: string | null;
  onHealthSettings: () => void;
  onRunHealth: () => void;
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

function displayNameFor(email?: string, role = '') {
  if (role === 'SUPER_ADMIN') return 'Administrator';
  if (!email) return 'your workspace';
  const local = email.split('@')[0] || '';
  const name = local.replace(/[._-]+/g, ' ').trim();
  return name || 'your workspace';
}

export default function OverviewView({
  services,
  deployments,
  pm2Status,
  health,
  healthLoading,
  healthError,
  healthRunLoading,
  analytics,
  email,
  role,
  failureAlerts,
  onDeploy,
  onForceDeploy,
  deploying,
  onHealthSettings,
  onRunHealth,
  onDeployment,
}: OverviewViewProps) {
  const [showAllServices, setShowAllServices] = useState(false);
  const [showAllDeployments, setShowAllDeployments] = useState(false);
  const isClient = role === 'CLIENT';

  const recentCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentDeployments = deployments.filter((deployment) => new Date(deployment.startedAt).getTime() >= recentCutoff);
  const recentTotal = analytics?.summary.total ?? recentDeployments.length;
  const recentSuccess = analytics?.summary.successful ?? recentDeployments.filter((deployment) => deployment.status === 'SUCCESS').length;
  const recentFailed = analytics?.summary.failed ?? recentDeployments.filter((deployment) => deployment.status !== 'DEPLOYING' && deployment.status !== 'QUEUED' && deployment.status !== 'SUCCESS').length;
  const successRate = analytics?.summary.successRate ?? (recentDeployments.length
    ? Math.round((recentDeployments.filter((deployment) => deployment.status === 'SUCCESS').length / recentDeployments.length) * 1000) / 10
    : null);

  const analyticsServices = analytics?.services;
  const pm2Count = analyticsServices?.pm2 ?? services.filter((service) => service.type === 'PM2').length;
  const staticCount = analyticsServices?.static ?? services.filter((service) => service.type === 'STATIC_FRONTEND').length;
  const totalServices = analyticsServices?.total ?? services.length;
  const enabledServices = analyticsServices?.enabled ?? services.filter((service) => service.enabled).length;

  const enabledServiceRecords = services.filter((service) => service.enabled);
  const activeServices = showAllServices ? enabledServiceRecords : enabledServiceRecords.slice(0, 3);
  const latestDeployments = showAllDeployments ? deployments : deployments.slice(0, 5);
  const latestHealth = healthLabel(health);

  const dailyMax = Math.max(1, ...(analytics?.daily || []).map((bucket) => bucket.total));

  function dailyBarHeight(total: number) {
    const height = total ? Math.max(10, Math.round((total / dailyMax) * 100)) : 0;
    return `${Math.max(4, Math.min(height, 100))}%`;
  }

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
          <p className="overview-kicker"><span className="overview-kicker__dot" /> {isClient ? 'TENANT SPACE · PRODUCTION RUNTIME' : 'CONTROL PLANE · ALL TENANTS'}</p>
          <h1>Good afternoon, {displayNameFor(email, role)}</h1>
          <p className="overview-subtitle">Deployment telemetry, fleet health, and automated pipelines are available across your services.</p>
        </div>
        <div className="overview-header__actions">
          <span className="overview-context">{totalServices} configured service{totalServices === 1 ? '' : 's'}</span>
          {isClient && (
            <button className="ht-btn ht-btn--secondary" type="button" onClick={onRunHealth} disabled={healthRunLoading || !services.length}>
              {healthRunLoading ? 'Running...' : '↻ Run health checks'}
            </button>
          )}
        </div>
      </header>

      <section className="overview-metrics" aria-label="Workspace metrics">
        <article className="overview-metric">
          <span className="overview-metric__label">Total services</span>
          <strong>{totalServices}</strong>
          <div className="overview-metric__meta"><span>{pm2Count} PM2</span><span>·</span><span>{staticCount} Static</span><span>·</span><span>{enabledServices} enabled</span></div>
          <div className="overview-meter"><span style={{ width: totalServices ? '100%' : '0%' }} /></div>
        </article>
        <article className="overview-metric">
          <span className="overview-metric__label">Deployments (7d)</span>
          <strong>{recentTotal}</strong>
          <div className="overview-metric__meta">{recentSuccess} successful · {recentFailed} failed · last 7 days</div>
          <div className="overview-spark deploy-activity" aria-label="Deployment activity by day" role="img">
            {(analytics?.daily || []).map((bucket) => {
              const tone = bucket.total === 0 ? 'var(--ht-text-muted)' : bucket.failed > 0 && bucket.successful === 0 ? 'var(--ht-danger)' : bucket.failed > 0 ? 'var(--ht-warning)' : 'var(--ht-success)';
              return (
                <i key={bucket.date} title={`${bucket.date}: ${bucket.total} deployments (${bucket.successful} ok, ${bucket.failed} failed)`} aria-hidden="true" style={{ height: dailyBarHeight(bucket.total), background: tone }} />
              );
            })}
            {!analytics && <span className="overview-spark-empty">no analytics</span>}
          </div>
        </article>
        <article className="overview-metric">
          <span className="overview-metric__label">Success rate</span>
          <strong>{successRate === null ? '—' : `${successRate}%`}</strong>
          <div className="overview-metric__meta">{recentSuccess} successful / {recentFailed} failed</div>
        </article>
        {isClient ? (
          <article className="overview-metric overview-metric--health">
            <span className="overview-metric__label">Health check</span>
            <strong>{latestHealth.title}</strong>
            <div className="overview-metric__meta">{latestHealth.detail}{health?.schedule.nextRunAt ? ` · Next ${relativeTime(health.schedule.nextRunAt)}` : ''}</div>
          </article>
        ) : (
          <article className="overview-metric overview-metric--health">
            <span className="overview-metric__label">Health check</span>
            <strong>{analytics ? '—' : '—'}</strong>
            <div className="overview-metric__meta">Webhook health is scoped to client accounts</div>
          </article>
        )}
      </section>

      <div className="overview-columns">
        <div className="overview-primary">
          <div className="overview-section-heading">
            <div>
              <h2>Active services <span>{activeServices.length} of {enabledServices}</span></h2>
            </div>
              <button className="overview-text-button" type="button" onClick={() => setShowAllServices((current) => !current)}>
                {showAllServices ? 'Show preview ↑' : `View all services (${enabledServices}) →`}
              </button>
          </div>

          <section className="overview-service-list" id="services">
            {activeServices.length === 0 ? (
              <div className="ht-empty">No enabled services are configured yet.</div>
            ) : activeServices.map((service) => {
              const status = service.type === 'PM2' ? pm2Status[service.id] : undefined;
              const latest = deployments.find((deployment) => deployment.service.id === service.id);
              const isDeploying = deploying === service.id;
              const hasRuntime = status && typeof status === 'object' && Object.keys(status).length > 0;
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
                        {service.type === 'PM2' ? (
                          hasRuntime ? (
                            <><span className={`ht-dot${status?.status === 'online' ? ' ht-dot--live' : ''}`} /> {status?.status || 'unknown'}{typeof status?.cpu === 'number' ? <> · CPU {status.cpu}%</> : null}{typeof status?.memory === 'number' ? <> · {Math.round(status.memory / 1024 / 1024)} MB</> : null}{typeof status?.restarts === 'number' ? <> · {status.restarts} restarts</> : null}{typeof status?.cpu !== 'number' && typeof status?.memory !== 'number' && typeof status?.restarts !== 'number' ? ' · telemetry limited' : null}</>
                          ) : (
                            <>Runtime telemetry unavailable</>
                          )
                        ) : <>◈ static frontend · branch {service.branch}</>}
                      </p>
                      <p className="overview-service__commit"><code>{shortHash(latest?.commitHash)}</code> {latest?.commitMessage || 'No deployment recorded yet'}</p>
                    </div>
                  </div>
                  <div className="overview-service__actions">
                    <button className="ht-btn ht-btn--primary" type="button" onClick={() => onDeploy(service.id)} disabled={isDeploying || !service.enabled}>{isDeploying ? 'Deploying...' : 'Normal deploy'}</button>
                    <button className="ht-btn ht-btn--secondary" type="button" onClick={() => onForceDeploy(service.id)} disabled={isDeploying || !service.enabled}>Force deploy</button>
                  </div>
                </article>
              );
            })}
          </section>

          <section className="overview-lower-grid">
            <div>
              <div className="overview-section-heading overview-section-heading--compact">
                <h2>Recent deployments</h2><Link href="/deployments">View history →</Link>
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
                {deployments.length > 5 && <button className="overview-history-toggle" type="button" onClick={() => setShowAllDeployments((current) => !current)}>{showAllDeployments ? 'Show recent deployments ↑' : `View all ${deployments.length} loaded ↓`}</button>}
              </div>
            </div>
            {isClient && (
              <div id="access">
                <div className="overview-section-heading overview-section-heading--compact"><h2>Client access</h2></div>
                <div className="overview-access-card">
                  <p>View the FileZilla/SFTP and database credentials assigned to this account.</p>
                  <Link className="ht-btn ht-btn--secondary" href="/access">View access credentials →</Link>
                </div>
              </div>
            )}
          </section>
        </div>

        {isClient && (
          <aside className="overview-sidebar" id="health">
            <div className="overview-section-heading overview-section-heading--compact"><h2>Webhook health</h2><span className="ht-pill ht-pill--brand">{health?.schedule.enabled ? 'ACTIVE' : 'MANUAL'}</span></div>
            <WebhookHealthPanel health={health} loading={healthLoading} error={healthError} runLoading={healthRunLoading} onSettings={onHealthSettings} onRun={onRunHealth} />
          </aside>
        )}
      </div>
    </div>
  );
}
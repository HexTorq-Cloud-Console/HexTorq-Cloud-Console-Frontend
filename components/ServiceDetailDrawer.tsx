'use client';

import { useEffect, useState } from 'react';
import type { Deployment, Pm2Status, Service } from '../types/api';

type Props = {
  service: Service;
  deployments: Deployment[];
  pm2Status?: Pm2Status;
  pm2FetchedAt?: string | null;
  deploying: boolean;
  onDeploy: (serviceId: string) => void;
  onForceDeploy: (serviceId: string) => void;
  onLogs: (service: Service) => void;
  onDeployment: (deploymentId: string) => void;
  onClose: () => void;
};

function shortHash(value?: string | null) {
  return value ? value.slice(0, 8) : '—';
}

function duration(value?: number) {
  if (!value) return 'Running';
  const seconds = Math.round(value / 1000);
  return seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`;
}

function uptime(value?: number) {
  if (!value || value <= 0) return '—';
  const seconds = Math.floor((Date.now() - value) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

type Tab = 'overview' | 'metrics' | 'deployments';

export default function ServiceDetailDrawer({
  service,
  deployments,
  pm2Status,
  pm2FetchedAt,
  deploying,
  onDeploy,
  onForceDeploy,
  onLogs,
  onDeployment,
  onClose,
}: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const [copied, setCopied] = useState('');

  const serviceDeployments = deployments.filter((deployment) => deployment.service.id === service.id);
  const hasTelemetry = Boolean(pm2Status);
  const runtimeStatus = pm2Status?.status || (hasTelemetry ? 'unknown' : 'unavailable');
  const agentOnline = service.agent.status === 'online';

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  async function copyValue(label: string, value: string) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(''), 1500);
    } catch {
      // Clipboard can be blocked; the value remains selectable.
    }
  }

  const metrics = service.type === 'PM2'
    ? [
      { label: 'Status', value: runtimeStatus, tone: runtimeStatus === 'online' ? 'good' : runtimeStatus === 'stopped' || runtimeStatus === 'errored' ? 'bad' : 'muted' },
      { label: 'CPU', value: typeof pm2Status?.cpu === 'number' ? `${pm2Status.cpu}%` : '—', tone: 'plain' },
      { label: 'Memory', value: typeof pm2Status?.memory === 'number' ? `${Math.round(pm2Status.memory / 1024 / 1024)} MB` : '—', tone: 'plain' },
      { label: 'Restarts', value: typeof pm2Status?.restarts === 'number' ? String(pm2Status.restarts) : '—', tone: 'plain' },
      { label: 'Uptime', value: uptime(pm2Status?.uptime), tone: 'plain' },
      { label: 'Last update', value: pm2FetchedAt ? new Date(pm2FetchedAt).toLocaleTimeString() : '—', tone: 'plain' },
    ]
    : [];

  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="detail-drawer" role="dialog" aria-modal="true" aria-label={`Details for ${service.name}`}>
        <header className="detail-drawer__header">
          <div className="detail-drawer__title">
            <p className="eyebrow">SERVICE DETAILS</p>
            <div className="detail-drawer__name">
              <h2>{service.name}</h2>
              <span className={`ht-pill ${service.enabled ? 'ht-pill--success' : 'ht-pill--danger'}`}>
                <span className="ht-dot" /> {service.enabled ? 'ENABLED' : 'DISABLED'}
              </span>
            </div>
            <p className="modal-subtitle">
              {service.type === 'PM2' ? 'PM2 runtime service' : 'Static frontend service'} · {service.client.name} · {service.agent.name}
            </p>
          </div>
          <button className="modal-close" aria-label="Close" onClick={onClose}>x</button>
        </header>

        <div className="detail-drawer__actions detail-drawer__actions--bar">
          <button className="ht-btn ht-btn--primary" type="button" onClick={() => onDeploy(service.id)} disabled={deploying || !service.enabled}>
            {deploying ? 'Deploying…' : 'Deploy'}
          </button>
          <button className="ht-btn ht-btn--secondary" type="button" onClick={() => onForceDeploy(service.id)} disabled={deploying || !service.enabled}>
            Force deploy
          </button>
          {service.type === 'PM2' && (
            <button className="ht-btn ht-btn--secondary" type="button" onClick={() => onLogs(service)}>
              Live logs
            </button>
          )}
          <span className={`detail-drawer__state detail-drawer__state--${agentOnline ? 'good' : 'bad'}`}>
            <span className="ht-dot" /> Agent {service.agent.status || 'unknown'}
          </span>
        </div>

        <nav className="detail-tabs" aria-label="Service detail tabs">
          {(['overview', 'metrics', 'deployments'] as Tab[]).map((item) => (
            <button
              key={item}
              type="button"
              className={`detail-tab${tab === item ? ' is-active' : ''}`}
              aria-selected={tab === item}
              onClick={() => setTab(item)}
            >
              {item === 'overview' ? 'Overview' : item === 'metrics' ? 'Metrics' : `Deployments (${serviceDeployments.length})`}
            </button>
          ))}
        </nav>

        <div className="detail-drawer__body">
          {tab === 'overview' && (
            <>
              <section className="detail-group">
                <h3 className="detail-group__title">Deployment</h3>
                <dl className="detail-grid">
                  <div className="detail-item"><dt>Branch</dt><dd><code>{service.branch || 'origin/HEAD'}</code></dd></div>
                  <div className="detail-item"><dt>Project key</dt><dd><code>{service.projectKey}</code></dd></div>
                  <div className="detail-item detail-item--wide"><dt>Repository</dt><dd><code>{service.repositoryUrl}</code></dd></div>
                  <div className="detail-item"><dt>Deploy directory</dt><dd><code>{service.deployDirectory || 'Not configured'}</code></dd></div>
                  <div className="detail-item"><dt>Working directory</dt><dd><code>{service.workingDirectory}</code></dd></div>
                </dl>
              </section>

              <section className="detail-group">
                <h3 className="detail-group__title">Runtime</h3>
                <dl className="detail-grid">
                  <div className="detail-item"><dt>Type</dt><dd>{service.type === 'STATIC_FRONTEND' ? 'Static frontend' : 'PM2 process'}</dd></div>
                  <div className="detail-item"><dt>PM2 process</dt><dd><code>{service.pm2ProcessName || 'Not applicable'}</code></dd></div>
                  <div className="detail-item"><dt>Client</dt><dd>{service.client.name}</dd></div>
                  <div className="detail-item"><dt>Agent</dt><dd>{service.agent.name}</dd></div>
                </dl>
              </section>

              <section className="detail-group">
                <h3 className="detail-group__title">Webhook</h3>
                <div className="detail-item detail-item--wide">
                  <dt>Delivery URL</dt>
                  <dd>
                    <div className="detail-copy-row">
                      <code>{service.webhookUrl || 'Uses the agent pipeline webhook'}</code>
                      {service.webhookUrl && (
                        <button type="button" className="mini-button" onClick={() => copyValue('Webhook', service.webhookUrl || '')}>
                          {copied === 'Webhook' ? 'Copied' : 'Copy'}
                        </button>
                      )}
                    </div>
                  </dd>
                </div>
              </section>

              <p className="detail-drawer__note">
                Configuration is managed from the Administration workspace; this panel is read-only.
              </p>
            </>
          )}

          {tab === 'metrics' && (
            service.type === 'PM2' ? (
              hasTelemetry ? (
                <>
                  <div className="detail-metrics">
                    {metrics.map((metric) => (
                      <div className={`detail-metric detail-metric--${metric.tone}`} key={metric.label}>
                        <span>{metric.label}</span>
                        <strong>{metric.value}</strong>
                      </div>
                    ))}
                  </div>
                  <p className="detail-drawer__note">Metrics reflect the latest polled PM2 status and may be several seconds old.</p>
                </>
              ) : (
                <div className="ht-card ht-empty">Runtime telemetry is unavailable right now. The agent may be offline or the process may not be running.</div>
              )
            ) : (
              <div className="ht-card ht-empty">Static frontend services do not expose PM2 CPU or memory metrics.</div>
            )
          )}

          {tab === 'deployments' && (
            serviceDeployments.length === 0 ? (
              <div className="ht-card ht-empty">No deployments have been recorded for this service yet.</div>
            ) : (
              <div className="detail-deployments">
                {serviceDeployments.map((deployment) => (
                  <button type="button" key={deployment.id} className="detail-deployment-row" onClick={() => onDeployment(deployment.id)}>
                    <span className={`ht-pill ht-pill--${deployment.status === 'SUCCESS' ? 'success' : deployment.status === 'DEPLOYING' || deployment.status === 'QUEUED' ? 'warning' : 'danger'}`}>
                      <span className="ht-dot" />{deployment.status}
                    </span>
                    <span className="detail-deployment-row__commit"><code>{shortHash(deployment.commitHash)}</code> {deployment.commitMessage || 'Message not reported'}</span>
                    <span className="detail-deployment-row__meta">
                      <time>{new Date(deployment.startedAt).toLocaleString()}</time> · {deployment.triggerSource} · {duration(deployment.durationMs)}
                    </span>
                  </button>
                ))}
              </div>
            )
          )}
        </div>
      </aside>
    </div>
  );
}

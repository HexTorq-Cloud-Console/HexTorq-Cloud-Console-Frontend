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
    } catch { /* Clipboard can be blocked; value remains selectable. */ }
  }

  const metrics = service.type === 'PM2'
    ? [
      { label: 'Runtime status', value: pm2Status?.status || (hasTelemetry ? 'unknown' : 'unavailable') },
      {
        label: 'CPU',
        value: typeof pm2Status?.cpu === 'number' ? `${pm2Status.cpu}%` : 'unavailable',
      },
      {
        label: 'Memory',
        value: typeof pm2Status?.memory === 'number' ? `${Math.round(pm2Status.memory / 1024 / 1024)} MB` : 'unavailable',
      },
      {
        label: 'Restarts',
        value: typeof pm2Status?.restarts === 'number' ? String(pm2Status.restarts) : 'unavailable',
      },
      { label: 'Last updated', value: pm2FetchedAt ? new Date(pm2FetchedAt).toLocaleString() : 'Never fetched' },
    ]
    : [];

  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="detail-drawer" role="dialog" aria-modal="true" aria-label={`Details for ${service.name}`}>
        <header className="detail-drawer__header">
          <div className="detail-drawer__title">
            <p className="eyebrow">SERVICE DETAILS</p>
            <h2>{service.name}</h2>
            <p className="modal-subtitle">
              {service.type === 'PM2' ? 'PM2 runtime service' : 'Static frontend service'} ·{' '}
              {service.enabled ? 'Enabled' : 'Disabled'} · {service.agent.name}
            </p>
          </div>
          <button className="modal-close" aria-label="Close" onClick={onClose}>x</button>
        </header>

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
              <div className="detail-drawer__actions">
                <button className="ht-btn ht-btn--primary" type="button" onClick={() => onDeploy(service.id)} disabled={deploying || !service.enabled}>
                  {deploying ? 'Deploying…' : 'Normal deploy'}
                </button>
                <button className="ht-btn ht-btn--secondary" type="button" onClick={() => onForceDeploy(service.id)} disabled={deploying || !service.enabled}>Force deploy</button>
                {service.type === 'PM2' && (
                  <button className="ht-btn ht-btn--secondary" type="button" onClick={() => onLogs(service)}>View live logs</button>
                )}
              </div>
              <dl className="detail-grid">
                <div className="detail-item"><dt>Type</dt><dd>{service.type === 'STATIC_FRONTEND' ? 'Static frontend' : 'PM2 process'}</dd></div>
                <div className="detail-item"><dt>Client</dt><dd>{service.client.name}</dd></div>
                <div className="detail-item"><dt>Branch</dt><dd><code>{service.branch || 'origin/HEAD'}</code></dd></div>
                <div className="detail-item"><dt>Project key</dt><dd><code>{service.projectKey}</code></dd></div>
                <div className="detail-item"><dt>Repository</dt><dd><code>{service.repositoryUrl}</code></dd></div>
                <div className="detail-item"><dt>Working directory</dt><dd><code>{service.workingDirectory}</code></dd></div>
                <div className="detail-item"><dt>Deploy directory</dt><dd><code>{service.deployDirectory || 'Not configured'}</code></dd></div>
                <div className="detail-item"><dt>PM2 process</dt><dd><code>{service.pm2ProcessName || 'Not applicable'}</code></dd></div>
                <div className="detail-item detail-item--wide"><dt>Webhook URL</dt><dd>
                  <div className="detail-copy-row">
                    <code>{service.webhookUrl || 'Uses the agent pipeline webhook'}</code>
                    {service.webhookUrl && (
                      <button type="button" className="mini-button" onClick={() => copyValue('Webhook', service.webhookUrl || '')}>
                        {copied === 'Webhook' ? 'Copied' : 'Copy'}
                      </button>
                    )}
                  </div>
                </dd></div>
              </dl>
              <p className="detail-drawer__note">
                Configuration is managed from the Administration workspace; this panel is read-only.
              </p>
            </>
          )}

          {tab === 'metrics' && (
            service.type === 'PM2' ? (
              <>
                {hasTelemetry ? (
                  <dl className="detail-grid">
                    {metrics.map((metric) => (
                      <div className="detail-item" key={metric.label}>
                        <dt>{metric.label}</dt>
                        <dd className={metric.value === 'unavailable' ? 'is-unavailable' : ''}>{metric.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <div className="ht-card ht-empty">Runtime telemetry is unavailable right now. The agent may be offline or the process may not be running.</div>
                )}
                <p className="detail-drawer__note">Metrics reflect the latest polled PM2 status and may be several seconds old.</p>
              </>
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

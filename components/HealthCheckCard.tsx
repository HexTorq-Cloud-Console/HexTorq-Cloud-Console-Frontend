'use client';

import { healthStatusClass, healthStatusLabel, scheduleDateTimeLabel } from '../lib/format';

type HealthCheckCardProps = {
  serviceName: string;
  serviceType: string;
  status: string;
  httpStatus?: number | null;
  deploymentStatus?: string | null;
  message?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  durationMs?: number | null;
  timeZone?: string;
};

function duration(value?: number | null) {
  if (!value) return '—';
  const seconds = Math.round(value / 1000);
  return seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`;
}

/**
 * One card design for a single service webhook check, shared by the Overview panel
 * and the full Webhook Health page so both stay in sync.
 */
export default function HealthCheckCard({
  serviceName,
  serviceType,
  status,
  httpStatus,
  deploymentStatus,
  message,
  startedAt,
  completedAt,
  durationMs,
  timeZone,
}: HealthCheckCardProps) {
  const statusClass = healthStatusClass(status);
  const httpOk = httpStatus != null && httpStatus >= 200 && httpStatus < 300;
  const deploymentFailed = deploymentStatus === 'FAILED' || deploymentStatus === 'ERROR';
  const deploymentOk = deploymentStatus === 'SUCCESS';

  return (
    <article className={`health-check health-check--${statusClass}`}>
      <div className="health-check__head">
        <div className="health-check__id">
          <strong>{serviceName}</strong>
          <span className="ht-badge">{serviceType === 'STATIC_FRONTEND' ? 'STATIC' : 'PM2'}</span>
        </div>
        <span className={`ht-pill ht-pill--${statusClass}`}>
          <span className="ht-dot" />
          {healthStatusLabel(status)}
        </span>
      </div>

      <div className="health-check__signals">
        <span className={`health-chip ${httpOk ? 'ok' : status === 'FAILED' ? 'bad' : ''}`}>
          Webhook {httpStatus ? `HTTP ${httpStatus}` : 'pending'}
        </span>
        <span className={`health-chip ${deploymentOk ? 'ok' : deploymentFailed ? 'bad' : ''}`}>
          Deployment {deploymentStatus ? deploymentStatus.toLowerCase() : 'waiting'}
        </span>
        <span className="health-chip health-chip--quiet">{duration(durationMs)}</span>
      </div>

      <p className={`health-check__message${status === 'FAILED' ? ' is-error' : ''}`}>
        {message || (deploymentOk ? 'Deployment finished cleanly.' : 'Waiting for the pipeline.')}
      </p>

      <div className="health-check__foot">
        <time>{completedAt ? scheduleDateTimeLabel(completedAt, timeZone || 'UTC') : startedAt ? `Queued ${scheduleDateTimeLabel(startedAt, timeZone || 'UTC')}` : 'Queued'}</time>
      </div>
    </article>
  );
}

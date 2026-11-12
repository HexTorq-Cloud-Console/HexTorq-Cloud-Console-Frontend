'use client';

import type { WebhookHealthData } from '../types/api';
import { healthStatusClass, healthStatusLabel, intervalLabel, scheduleDateTimeLabel, scheduleHourLabel } from '../lib/format';
import HealthCheckCard from './HealthCheckCard';
function WebhookHealthPanel({
  health,
  loading,
  error,
  runLoading,
  onSettings,
  onRun,
}: {
  health: WebhookHealthData | null;
  loading: boolean;
  error: string;
  runLoading: boolean;
  onSettings: () => void;
  onRun: () => void;
}) {
  const run = health?.latestRun || null;
  const active = health?.activeRun || run?.status === 'RUNNING';
  const completedChecks = run
    ? run.checks.filter((check) => check.status === 'SUCCESS' || check.status === 'FAILED').length
    : 0;

  return (
    <section className="health-panel">
      <div className="health-panel-head">
        <div>
          <p className="eyebrow">WEBHOOK HEALTH</p>
          <h2>Service health checks</h2>
          <p className="muted">
            {health?.schedule.enabled
              ? `${intervalLabel(health.schedule.intervalDays)} at ${scheduleHourLabel(health.schedule.hour)} ${health.schedule.timeZone}.`
              : 'Automatic checks are off. Enable a schedule or run every webhook now.'}
          </p>
        </div>
        <div className="health-panel-actions">
          <button className="secondary" type="button" onClick={onSettings}>
            Settings
          </button>
          <button type="button" onClick={onRun} disabled={runLoading || Boolean(active)}>
            {runLoading ? 'Starting...' : active ? 'Check running...' : 'Run all now'}
          </button>
        </div>
      </div>

      <div className="health-schedule-meta">
        <span>{health?.schedule.enabled ? `Next check: ${health.schedule.nextRunAt ? scheduleDateTimeLabel(health.schedule.nextRunAt, health.schedule.timeZone) : 'Waiting for schedule'}` : 'Schedule disabled'}</span>
        <span>{health?.schedule.lastRunAt ? `Last check: ${scheduleDateTimeLabel(health.schedule.lastRunAt, health.schedule.timeZone)}` : 'No health check has run yet'}</span>
        {health?.schedule.timeZone && <span>Time zone: {health.schedule.timeZone}</span>}
      </div>

      {error && <p className="error">{error}</p>}
      {loading && !health && <p className="muted">Loading webhook health...</p>}
      {!loading && !run && !error && (
        <p className="muted health-empty">
          No health checks have run yet. Use Run all now to verify every enabled service webhook.
        </p>
      )}

      {run && (
        <div className="health-run">
          <div className="health-run-head">
            <div>
              <span className={`badge ${healthStatusClass(run.status)}`}>{healthStatusLabel(run.status)}</span>
              <strong>{run.source === 'SCHEDULED' ? 'Automatic check' : 'Manual check'}</strong>
              <span className="row-meta">
                {completedChecks} / {run.totalServices} services checked
              </span>
            </div>
            <span className="row-meta">
              {run.completedAt ? `Finished ${new Date(run.completedAt).toLocaleString()}` : `Started ${new Date(run.startedAt).toLocaleString()}`}
            </span>
          </div>
          <div className="health-check-grid">
            {run.checks.map((check) => {
              const deployment = check.deployment;
              return (
                <HealthCheckCard
                  key={check.id}
                  serviceName={check.service.name}
                  serviceType={check.service.type}
                  status={check.status}
                  httpStatus={check.httpStatus}
                  deploymentStatus={deployment?.status ?? null}
                  message={check.message}
                  startedAt={check.startedAt}
                  completedAt={check.completedAt}
                  durationMs={check.durationMs}
                />
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

export default WebhookHealthPanel;

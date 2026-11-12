'use client';

import type { WebhookHealthData } from '../types/api';
import { healthStatusClass, healthStatusLabel, intervalLabel, scheduleDateTimeLabel, scheduleHourLabel } from '../lib/format';

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
  const passed = run?.successfulServices || 0;
  const total = run?.totalServices || 0;
  const ratio = total ? Math.round((passed / total) * 100) : 0;
  // Problems first: the panel is a health summary, not a second copy of the full page.
  const problems = (run?.checks || [])
    .filter((check) => check.status !== 'SUCCESS')
    .slice(0, 4);

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
        <div className="health-panel__summary">
          <div className="health-panel__score">
            <span className={`ht-pill ht-pill--${healthStatusClass(run.status)}`}>
              <span className="ht-dot" />
              {healthStatusLabel(run.status)}
            </span>
            <strong>{passed}/{total}</strong>
            <span>services passed · {completedChecks} checked</span>
          </div>
          <div className="health-panel__bar">
            <span style={{ width: `${ratio}%` }} />
          </div>
          <ul className="health-panel__issues">
            {problems.length === 0 ? (
              <li className="is-ok">Every enabled service accepted the webhook and finished its deployment.</li>
            ) : (
              problems.map((check) => (
                <li key={check.id}>
                  <span className="health-panel__issue-dot" aria-hidden="true" />
                  <strong>{check.service.name}</strong>
                  <span>{check.message || `Status ${check.status.toLowerCase()}`}</span>
                </li>
              ))
            )}
          </ul>
          <a className="health-panel__link" href="/health">Open the full health report →</a>
        </div>
      )}
    </section>
  );
}

export default WebhookHealthPanel;

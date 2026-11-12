'use client';

import type { WebhookHealthData } from '../types/api';
import { healthStatusClass, healthStatusLabel, intervalLabel, scheduleDateTimeLabel, scheduleHourLabel } from '../lib/format';
import HealthCheckCard from './HealthCheckCard';

type WebhookHealthViewProps = { health: WebhookHealthData | null; loading: boolean; error: string; runLoading: boolean; onSettings: () => void; onRun: () => void };

function duration(value?: number | null) {
  if (!value) return '—';
  const seconds = Math.round(value / 1000);
  return seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`;
}

export default function WebhookHealthView({ health, loading, error, runLoading, onSettings, onRun }: WebhookHealthViewProps) {
  const run = health?.activeRun || health?.latestRun;
  const checks = run?.checks || [];
  const passed = run?.successfulServices || 0;
  const total = run?.totalServices || checks.length;

  return (
    <section className="health-page" id="health-list" aria-labelledby="health-title">
      <header className="health-page__header">
        <div><p className="overview-kicker"><span className="overview-kicker__dot" /> AUTOMATED PROBES · AUTO-REFRESHING EVERY 5S</p><h2 id="health-title">Webhook Health</h2><p>Tests every enabled service webhook and waits for the deployment to finish.</p></div>
        <div className="health-page__actions"><button className="ht-btn ht-btn--secondary" type="button" onClick={onSettings}>◷ Settings</button><button className="ht-btn ht-btn--primary" type="button" onClick={onRun} disabled={runLoading || run?.status === 'RUNNING'}>{runLoading ? 'Starting…' : run?.status === 'RUNNING' ? 'Run in progress…' : '▷ Run all now'}</button></div>
      </header>

      <section className="health-summary">
        <div className="health-summary__lead">
          <span className="health-summary__label">Latest execution</span>
          <div className="health-summary__main">
            <span className={`ht-pill ht-pill--${run ? healthStatusClass(run.status) : 'neutral'}`}>{run ? healthStatusLabel(run.status) : 'NOT RUN'}</span>
            <strong>{run ? `${passed}/${total} passed` : 'No run recorded'}</strong>
          </div>
          {total > 0 && (
            <>
              <div className="health-summary__bar"><span style={{ width: `${Math.round((passed / total) * 100)}%` }} /></div>
              <small className="health-summary__note">{Math.round((passed / total) * 100)}% of enabled services accepted the webhook</small>
            </>
          )}
        </div>
        <div><span className="health-summary__label">Started</span><strong>{run ? scheduleDateTimeLabel(run.startedAt, health?.schedule.timeZone || 'UTC') : '—'}</strong></div>
        <div><span className="health-summary__label">Duration</span><strong>{run ? duration(run.completedAt ? new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime() : null) : '—'}</strong></div>
        <div className="health-summary__next"><span className="health-summary__label">Next scheduled run</span><strong>{health?.schedule.enabled && health.schedule.nextRunAt ? scheduleDateTimeLabel(health.schedule.nextRunAt, health.schedule.timeZone) : 'Schedule disabled'}</strong></div>
      </section>

      <div className="health-pipeline" aria-label="Health check pipeline">
        {[
          ['Call webhook', 'Each enabled service is triggered'],
          ['HTTP response', 'The webhook HTTP code is recorded'],
          ['Find deployment', 'The run is matched to its pipeline'],
          ['Wait for result', 'The deployment is polled until it ends'],
          ['Mark result', 'Each service is marked pass or fail'],
        ].map(([title, description], index) => (
          <div className="health-pipeline__step" key={title}>
            <span className="health-pipeline__index">{index + 1}</span>
            <span className="health-pipeline__text"><b>{title}</b><small>{description}</small></span>
          </div>
        ))}
      </div>

      {error && <p className="error">{error}</p>}
      {loading && !health && <div className="ht-card ht-empty">Loading webhook health…</div>}
      {!loading && !run && !error && <div className="ht-card ht-empty">No health checks have run yet. Use Run all now to verify every enabled service webhook.</div>}

      {run && <>
        <div className="health-checks-heading"><h3>Service checks <span>{checks.length} total</span></h3><code>Run ID #{run.id.slice(-8)}</code></div>
        <div className="health-service-grid">{checks.map((check) => {
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
              timeZone={health?.schedule.timeZone || 'UTC'}
            />
          );
        })}</div>
      </>}

      <section className="health-history"><div className="health-checks-heading"><h3>Run history</h3><code>Last {health?.recentRuns.length || 0} execution records</code></div><div className="health-history__table"><div className="health-history__header"><span>Started</span><span>Source</span><span>Status</span><span>Services</span><span>Passed</span><span>Failed</span><span>Duration</span></div>{(health?.recentRuns || []).map((item) => <div className="health-history__row" key={item.id}><time>{scheduleDateTimeLabel(item.startedAt, health?.schedule.timeZone || 'UTC')}</time><span>{item.source === 'SCHEDULED' ? 'Scheduled' : 'Manual'}</span><span className={`ht-pill ht-pill--${healthStatusClass(item.status)}`}>{healthStatusLabel(item.status)}</span><span>{item.totalServices}</span><strong className="is-good">{item.successfulServices}</strong><strong className={item.failedServices ? 'is-error' : ''}>{item.failedServices}</strong><code>{duration(item.completedAt ? new Date(item.completedAt).getTime() - new Date(item.startedAt).getTime() : null)}</code></div>)}</div></section>
    </section>
  );
}

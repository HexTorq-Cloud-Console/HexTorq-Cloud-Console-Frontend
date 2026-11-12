'use client';

import { useMemo, useState } from 'react';
import type { WebhookHealthData } from '../types/api';
import { healthStatusClass, healthStatusLabel, scheduleDateTimeLabel } from '../lib/format';

type WebhookHealthViewProps = { health: WebhookHealthData | null; loading: boolean; error: string; runLoading: boolean; onSettings: () => void; onRun: () => void };
type CheckFilter = 'ALL' | 'PASSED' | 'FAILED';

const STEPS = [
  ['Call webhook', 'Every enabled service is triggered'],
  ['HTTP response', 'The webhook status code is recorded'],
  ['Find deployment', 'The run is matched to its pipeline'],
  ['Wait for result', 'The deployment is polled until it ends'],
  ['Mark result', 'Each service is marked pass or fail'],
];

function duration(value?: number | null) {
  if (!value) return '—';
  const seconds = Math.round(value / 1000);
  return seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`;
}

export default function WebhookHealthView({ health, loading, error, runLoading, onSettings, onRun }: WebhookHealthViewProps) {
  const [filter, setFilter] = useState<CheckFilter>('ALL');
  const [query, setQuery] = useState('');
  const run = health?.activeRun || health?.latestRun;
  const checks = run?.checks || [];
  const passed = run?.successfulServices || 0;
  const total = run?.totalServices || checks.length;
  const failed = Math.max(0, total - passed);
  const passRatio = total ? Math.round((passed / total) * 100) : 0;
  const timeZone = health?.schedule.timeZone || 'UTC';

  const visibleChecks = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return checks
      .filter((check) => {
        if (filter === 'PASSED' && check.status !== 'SUCCESS') return false;
        if (filter === 'FAILED' && check.status === 'SUCCESS') return false;
        if (!needle) return true;
        return check.service.name.toLowerCase().includes(needle);
      })
      .sort((first, second) => {
        // Problems first, then most recent.
        const firstFailed = first.status === 'SUCCESS' ? 1 : 0;
        const secondFailed = second.status === 'SUCCESS' ? 1 : 0;
        if (firstFailed !== secondFailed) return firstFailed - secondFailed;
        return new Date(second.completedAt || second.startedAt || 0).getTime() - new Date(first.completedAt || first.startedAt || 0).getTime();
      });
  }, [checks, filter, query]);

  return (
    <section className="health-page" id="health-list" aria-labelledby="health-title">
      <header className="health-page__header">
        <div>
          <p className="overview-kicker"><span className="overview-kicker__dot" /> AUTOMATED PROBES · AUTO-REFRESHING EVERY 5S</p>
          <h2 id="health-title">Webhook Health</h2>
          <p>Tests every enabled service webhook and waits for the deployment to finish.</p>
        </div>
        <div className="health-page__actions">
          <button className="ht-btn ht-btn--secondary" type="button" onClick={onSettings}>◷ Settings</button>
          <button className="ht-btn ht-btn--primary" type="button" onClick={onRun} disabled={runLoading || run?.status === 'RUNNING'}>
            {runLoading ? 'Starting…' : run?.status === 'RUNNING' ? 'Run in progress…' : '▷ Run all now'}
          </button>
        </div>
      </header>

      {run && (
        <section className="health-hero">
          <div className="health-hero__lead">
            <span className="health-summary__label">Latest execution</span>
            <div className="health-hero__score">
              <span className={`ht-pill ht-pill--${healthStatusClass(run.status)}`}>
                <span className="ht-dot" />{healthStatusLabel(run.status)}
              </span>
              <strong>{passed}</strong>
              <span className="health-hero__of">/ {total}</span>
              <em>services passed</em>
            </div>
            <div className="health-hero__bar">
              <span className="is-pass" style={{ width: `${passRatio}%` }} />
              <span className="is-fail" style={{ width: `${100 - passRatio}%` }} />
            </div>
            <small className="health-summary__note">
              {passRatio}% of enabled services accepted the webhook{failed ? ` · ${failed} failed` : ''}
            </small>
          </div>
          <dl className="health-hero__stats">
            <div><dt>Started</dt><dd>{scheduleDateTimeLabel(run.startedAt, timeZone)}</dd></div>
            <div><dt>Duration</dt><dd>{duration(run.completedAt ? new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime() : null)}</dd></div>
            <div><dt>Trigger</dt><dd>{run.source === 'SCHEDULED' ? 'Scheduled' : 'Manual'}</dd></div>
            <div><dt>Next run</dt><dd>{health?.schedule.enabled && health.schedule.nextRunAt ? scheduleDateTimeLabel(health.schedule.nextRunAt, timeZone) : 'Schedule disabled'}</dd></div>
          </dl>
        </section>
      )}

      <ol className="health-steps">
        {STEPS.map(([title, description], index) => (
          <li className="health-steps__item" key={title}>
            <span className="health-steps__index">{index + 1}</span>
            <span className="health-steps__text"><b>{title}</b><small>{description}</small></span>
          </li>
        ))}
      </ol>

      {error && <p className="error">{error}</p>}
      {loading && !health && <div className="ht-card ht-empty">Loading webhook health…</div>}
      {!loading && !run && !error && <div className="ht-card ht-empty">No health checks have run yet. Use Run all now to verify every enabled service webhook.</div>}

      {run && (
        <section className="health-checks">
          <div className="health-checks__toolbar">
            <h3>Service checks <span>{checks.length} total</span></h3>
            <div className="health-checks__filters">
              <div className="health-checks__tabs" role="tablist" aria-label="Filter service checks">
                {(['ALL', 'PASSED', 'FAILED'] as CheckFilter[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    role="tab"
                    aria-selected={filter === item}
                    className={`health-checks__tab${filter === item ? ' is-active' : ''}`}
                    onClick={() => setFilter(item)}
                  >
                    {item === 'ALL' ? 'All' : item === 'PASSED' ? `Passed ${passed}` : `Failed ${failed}`}
                  </button>
                ))}
              </div>
              <label className="health-checks__search">
                <span aria-hidden="true">⌕</span>
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter services…" aria-label="Filter services" />
              </label>
            </div>
          </div>

          <div className="health-checks__head" aria-hidden="true">
            <span>Status</span><span>Service</span><span>Webhook</span><span>Deployment</span><span>Duration</span><span>Completed</span>
          </div>

          <div className="health-checks__list">
            {visibleChecks.length === 0 ? (
              <div className="health-checks__empty">No service checks match this filter.</div>
            ) : (
              visibleChecks.map((check) => {
                const deployment = check.deployment;
                const httpOk = check.httpStatus != null && check.httpStatus >= 200 && check.httpStatus < 300;
                const deploymentFailed = deployment?.status === 'FAILED' || deployment?.status === 'ERROR';
                const statusClass = healthStatusClass(check.status);
                return (
                  <div className={`health-row health-row--${statusClass}`} key={check.id}>
                    <span className={`health-row__status health-row__status--${statusClass}`}>
                      <span className="ht-dot" />{healthStatusLabel(check.status)}
                    </span>
                    <span className="health-row__service">
                      <strong>{check.service.name}</strong>
                      <span className="ht-badge">{check.service.type === 'STATIC_FRONTEND' ? 'STATIC' : 'PM2'}</span>
                    </span>
                    <span className={`health-row__signal${httpOk ? ' is-ok' : check.status === 'FAILED' ? ' is-bad' : ''}`}>
                      {check.httpStatus ? `HTTP ${check.httpStatus}` : 'pending'}
                    </span>
                    <span className={`health-row__signal${deployment?.status === 'SUCCESS' ? ' is-ok' : deploymentFailed ? ' is-bad' : ''}`}>
                      {deployment ? deployment.status.toLowerCase() : 'waiting'}
                    </span>
                    <span className="health-row__duration">{duration(check.durationMs)}</span>
                    <time className="health-row__time">
                      {check.completedAt ? scheduleDateTimeLabel(check.completedAt, timeZone) : check.startedAt ? scheduleDateTimeLabel(check.startedAt, timeZone) : 'Queued'}
                    </time>
                    {check.message && check.status !== 'SUCCESS' ? (
                      <span className="health-row__message">{check.message}</span>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </section>
      )}

      <section className="health-history">
        <div className="health-checks-heading"><h3>Run history</h3><code>Last {health?.recentRuns.length || 0} execution records</code></div>
        <div className="health-history__table">
          <div className="health-history__header"><span>Started</span><span>Source</span><span>Status</span><span>Services</span><span>Passed</span><span>Failed</span><span>Duration</span></div>
          {(health?.recentRuns || []).map((item) => (
            <div className="health-history__row" key={item.id}>
              <time>{scheduleDateTimeLabel(item.startedAt, timeZone)}</time>
              <span>{item.source === 'SCHEDULED' ? 'Scheduled' : 'Manual'}</span>
              <span className={`ht-pill ht-pill--${healthStatusClass(item.status)}`}>{healthStatusLabel(item.status)}</span>
              <span>{item.totalServices}</span>
              <strong className="is-good">{item.successfulServices}</strong>
              <strong className={item.failedServices ? 'is-error' : ''}>{item.failedServices}</strong>
              <code>{duration(item.completedAt ? new Date(item.completedAt).getTime() - new Date(item.startedAt).getTime() : null)}</code>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}

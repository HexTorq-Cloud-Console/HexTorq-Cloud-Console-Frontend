'use client';

import { AsciiReveal } from 'ascii-reveal';
import { useAscii } from './AsciiContext';

import { useMemo, useState } from 'react';
import type { Deployment, Service } from '../types/api';

type DeploymentsViewProps = { deployments: Deployment[]; services: Service[]; hasMore: boolean; loadingMore: boolean; onLoadMore: () => void; onOpen: (deploymentId: string) => void };
type StatusFilter = 'ALL' | 'SUCCESS' | 'FAILED' | 'ERROR' | 'DEPLOYING';

function duration(value?: number) {
  if (!value) return 'Running';
  const seconds = Math.round(value / 1000);
  return seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`;
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function pillStatus(status: string) {
  if (status === 'SUCCESS') return 'success';
  if (status === 'DEPLOYING' || status === 'QUEUED') return 'warning';
  return 'danger';
}

export default function DeploymentsView({ deployments, services, hasMore, loadingMore, onLoadMore, onOpen }: DeploymentsViewProps) {
  const { preset, origin, speed, replayKey, mode, revealPreset } = useAscii();
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [serviceId, setServiceId] = useState('ALL');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 8;
  const completed = deployments.filter((item) => item.status !== 'DEPLOYING' && item.status !== 'QUEUED');
  const success = completed.filter((item) => item.status === 'SUCCESS').length;
  const active = deployments.filter((item) => item.status === 'DEPLOYING' || item.status === 'QUEUED').length;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return deployments.filter((item) => {
      const matchesStatus = status === 'ALL' || item.status === status;
      const matchesService = serviceId === 'ALL' || item.service.id === serviceId;
      const matchesQuery = !q || [item.service.name, item.commitHash || '', item.commitMessage || '', item.triggerSource, item.branch || ''].some((value) => value.toLowerCase().includes(q));
      return matchesStatus && matchesService && matchesQuery;
    });
  }, [deployments, query, serviceId, status]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageRows = filtered.slice((page - 1) * perPage, page * perPage);

  function changeStatus(next: StatusFilter) { setStatus(next); setPage(1); }

  return (
    <section className="deployments-page" id="deployments-list" aria-labelledby="deployments-title">
      <header className="deployments-page__header">
        <div>
          <p className="overview-kicker"><span className="overview-kicker__dot" /> PRODUCTION PIPELINE</p>
          <h2 id="deployments-title">Deployments</h2>
          <p>Records are retrieved in batches of up to 100; {deployments.length} loaded{hasMore ? ' so far' : ''}.</p>
        </div>
        <span className="deployments-total">{deployments.length} recorded</span>
      </header>

      <AsciiReveal key={replayKey} preset={mode === 'skeleton_reveal' ? revealPreset : preset} origin={origin} speed={speed} lazy={true} className="deployments-metrics">
        <article data-ascii="surface"><span>Success ratio</span><strong>{completed.length ? `${Math.round((success / completed.length) * 1000) / 10}%` : '—'}</strong></article>
        <article data-ascii="surface"><span>Completed runs</span><strong>{completed.length}</strong></article>
        <article data-ascii="surface"><span>Active deployments</span><strong>{active}</strong></article>
        <article data-ascii="surface"><span>Failed / error</span><strong className={completed.length - success ? 'is-danger' : ''}>{completed.length - success}</strong></article>
      </AsciiReveal>

      <div className="deployments-filters">
        <label><span>Service</span><select value={serviceId} onChange={(event) => { setServiceId(event.target.value); setPage(1); }}><option value="ALL">All services</option>{services.map((service) => <option value={service.id} key={service.id}>{service.name}</option>)}</select></label>
        <div className="deployments-statuses" role="tablist" aria-label="Deployment status filters">
          {(['ALL', 'SUCCESS', 'FAILED', 'ERROR', 'DEPLOYING'] as StatusFilter[]).map((item) => <button type="button" role="tab" aria-selected={status === item} className={status === item ? 'is-active' : ''} onClick={() => changeStatus(item)} key={item}>{item === 'ALL' ? 'All' : item.charAt(0) + item.slice(1).toLowerCase()} <span>{item === 'ALL' ? deployments.length : deployments.filter((deployment) => deployment.status === item).length}</span></button>)}
        </div>
        <label className="deployments-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Filter by commit hash, branch, or message…" aria-label="Filter deployments" /></label>
      </div>

      <div className="deployments-table-wrap">
        <table className="deployments-table"><thead><tr><th>Service</th><th>Status</th><th>Trigger</th><th>Started</th><th>Duration</th><th>Commit</th><th>Commit message</th></tr></thead>
          <tbody>{pageRows.length === 0 ? <tr><td colSpan={7} className="deployments-empty">No deployments match these filters.</td></tr> : pageRows.map((deployment) => <tr key={deployment.id} tabIndex={0} onClick={() => onOpen(deployment.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onOpen(deployment.id); }}>
            <td><strong>{deployment.service.name}</strong><small>{deployment.branch || 'branch not reported'}</small></td>
            <td><span className={`ht-pill ht-pill--${pillStatus(deployment.status)}`}><span className="ht-dot" />{deployment.status}</span></td>
            <td><span className="trigger-badge">{deployment.triggerSource}</span></td>
            <td><time>{dateLabel(deployment.startedAt)}</time></td>
            <td><code>{duration(deployment.durationMs)}</code></td>
            <td><code className="commit-code">{deployment.commitHash ? deployment.commitHash.slice(0, 8) : '—'}</code></td>
            <td className="deployment-message" title={deployment.commitMessage || undefined}>{deployment.commitMessage || 'Message not reported'}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="deployments-mobile-list">
        {pageRows.length === 0 ? <div className="ht-card ht-empty">No deployments match these filters.</div> : pageRows.map((deployment) => <button className="deployment-mobile-card" type="button" key={deployment.id} onClick={() => onOpen(deployment.id)}>
          <div className="deployment-mobile-card__head"><strong>{deployment.service.name}</strong><span className={`ht-pill ht-pill--${pillStatus(deployment.status)}`}><span className="ht-dot" />{deployment.status}</span></div>
          <div className="deployment-mobile-card__commit"><code>{deployment.commitHash ? deployment.commitHash.slice(0, 8) : '—'}</code><span>{deployment.commitMessage || 'Message not reported'}</span></div>
          {deployment.failureReason && <div className="deployment-mobile-card__failure">{deployment.failureReason}</div>}
          <div className="deployment-mobile-card__meta"><time>{dateLabel(deployment.startedAt)}</time><span>{deployment.triggerSource}</span><code>{duration(deployment.durationMs)}</code></div>
        </button>)}
      </div>
      <footer className="deployments-pagination"><span>Showing {filtered.length ? (page - 1) * perPage + 1 : 0}–{Math.min(page * perPage, filtered.length)} of {filtered.length} loaded</span><div><button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>← Previous</button><strong>{page} / {pageCount}</strong><button type="button" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)}>Next →</button></div></footer>
      {hasMore && (
        <div className="deployments-load-more">
          <button type="button" onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : 'Load older deployments ↓'}
          </button>
        </div>
      )}
      {!hasMore && deployments.length > 0 && (
        <p className="deployments-all-loaded">All deployment history has been loaded.</p>
      )}
    </section>
  );
}

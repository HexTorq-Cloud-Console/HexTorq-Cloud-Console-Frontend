'use client';

import type { ReactNode } from 'react';
import { AsciiSkeleton } from 'ascii-reveal';
import type { ConsoleSection } from '../lib/sections';

function SkeletonHeader({
  seed,
  titleWidth = 220,
  subtitleWidth = 340,
  right,
}: {
  seed: number;
  titleWidth?: number | string;
  subtitleWidth?: number | string;
  right?: ReactNode;
}) {
  return (
    <div className="state-sk-header">
      <div className="state-sk-header__left">
        <AsciiSkeleton lines={1} widths={[160]} seed={seed} />
        <AsciiSkeleton rows={2} width={titleWidth} seed={seed + 1} />
        <AsciiSkeleton lines={1} widths={[subtitleWidth]} seed={seed + 2} />
      </div>
      {right && <div className="state-sk-header__right">{right}</div>}
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="overview-page">
      <SkeletonHeader
        seed={10}
        titleWidth={210}
        subtitleWidth={380}
        right={
          <>
            <div className="state-sk-pill state-sk-pill--md" />
            <div className="state-sk-pill state-sk-pill--md" />
            <div className="state-sk-pill state-sk-pill--cta" />
          </>
        }
      />
      <div className="kpi-grid kpi-grid--peak">
        {[1, 2, 3, 4, 5].map((item) => (
          <div className="state-skeleton-card state-skeleton-card--peak" data-ascii="skip" key={item}>
            <div className="state-sk-row-between">
              <AsciiSkeleton lines={1} widths={[90]} seed={item * 10} />
              <div className="state-sk-pill state-sk-pill--sm" />
            </div>
            <div className="state-sk-peak-bottom">
              <AsciiSkeleton lines={1} widths={[88]} seed={item * 10 + 1} />
              <AsciiSkeleton rows={2} width={64} seed={item * 10 + 2} />
              <AsciiSkeleton lines={1} widths={['72%']} seed={item * 10 + 3} />
            </div>
          </div>
        ))}
      </div>
      <div className="state-skeleton-card state-skeleton-card--compact" data-ascii="skip">
        <AsciiSkeleton lines={1} widths={[170]} seed={80} />
        <AsciiSkeleton rows={2} width="100%" seed={81} />
      </div>
      <div className="console-state__body">
        <div className="state-skeleton-card state-skeleton-card--large" data-ascii="skip">
          <AsciiSkeleton lines={1} widths={['46%']} seed={91} />
          <AsciiSkeleton rows={3} width="100%" seed={92} />
          <AsciiSkeleton rows={3} width="100%" seed={93} />
          <AsciiSkeleton rows={3} width="100%" seed={94} />
        </div>
        <div className="state-skeleton-card state-skeleton-card--large" data-ascii="skip">
          <AsciiSkeleton lines={1} widths={['52%']} seed={101} />
          <AsciiSkeleton rows={3} width="100%" seed={102} />
          <AsciiSkeleton rows={3} width="100%" seed={103} />
        </div>
      </div>
    </div>
  );
}

function ServicesSkeleton() {
  return (
    <div className="services-page">
      <SkeletonHeader
        seed={200}
        titleWidth={190}
        subtitleWidth={340}
        right={<div className="state-sk-pill state-sk-pill--lg" />}
      />
      <div className="services-toolbar" data-ascii="skip">
        <AsciiSkeleton lines={1} widths={['52%']} seed={210} />
        <AsciiSkeleton lines={1} widths={[240]} seed={211} />
      </div>
      <div className="services-grid">
        {[1, 2, 3, 4, 5, 6].map((item) => (
          <div className="service-tile state-sk-card-reset" data-ascii="skip" key={item}>
            <div className="service-tile__head">
              <div className="state-sk-square" />
              <div className="service-tile__name">
                <AsciiSkeleton lines={1} widths={['68%']} seed={220 + item} />
                <AsciiSkeleton lines={1} widths={['42%']} seed={230 + item} />
              </div>
            </div>
            <AsciiSkeleton lines={1} widths={['80%']} seed={240 + item} />
            <div className="service-tile__commit">
              <AsciiSkeleton rows={2} width="100%" seed={250 + item} />
            </div>
            <div className="service-tile__footer">
              <AsciiSkeleton rows={2} width="100%" seed={260 + item} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DeploymentsSkeleton() {
  return (
    <div className="deployments-page">
      <SkeletonHeader
        seed={300}
        titleWidth={210}
        subtitleWidth={350}
        right={<div className="state-sk-pill state-sk-pill--md" />}
      />
      <div className="deployments-metrics">
        {[1, 2, 3, 4].map((item) => (
          <div className="state-skeleton-card state-skeleton-card--metric" data-ascii="skip" key={item}>
            <AsciiSkeleton lines={1} widths={[90]} seed={310 + item} />
            <AsciiSkeleton rows={2} width={68} seed={320 + item} />
            <AsciiSkeleton lines={1} widths={[110]} seed={330 + item} />
          </div>
        ))}
      </div>
      <div className="state-skeleton-card state-skeleton-card--table" data-ascii="skip">
        <AsciiSkeleton lines={1} widths={['45%']} seed={340} />
        {[1, 2, 3, 4, 5, 6].map((row) => (
          <AsciiSkeleton rows={2} width="100%" seed={350 + row} key={row} />
        ))}
      </div>
    </div>
  );
}

function HealthSkeleton() {
  return (
    <div className="health-page">
      <SkeletonHeader
        seed={400}
        titleWidth={240}
        subtitleWidth={380}
        right={
          <>
            <div className="state-sk-pill state-sk-pill--md" />
            <div className="state-sk-pill state-sk-pill--cta" />
          </>
        }
      />
      <section className="health-hero" data-ascii="skip">
        <div className="health-hero__lead">
          <AsciiSkeleton lines={1} widths={[120]} seed={410} />
          <AsciiSkeleton rows={2} width={170} seed={411} />
          <AsciiSkeleton lines={1} widths={['92%']} seed={412} />
        </div>
        <div className="health-hero__stats">
          {[1, 2, 3, 4].map((stat) => (
            <div key={stat}>
              <AsciiSkeleton lines={1} widths={[72]} seed={420 + stat} />
              <AsciiSkeleton lines={1} widths={[105]} seed={430 + stat} />
            </div>
          ))}
        </div>
      </section>
      <div className="health-steps" data-ascii="skip">
        {[1, 2, 3, 4, 5].map((step) => (
          <div className="health-steps__item" key={step}>
            <div className="state-sk-circle" />
            <div className="health-steps__text">
              <AsciiSkeleton lines={1} widths={[88]} seed={440 + step} />
              <AsciiSkeleton lines={1} widths={['85%']} seed={450 + step} />
            </div>
          </div>
        ))}
      </div>
      <div className="health-checks__list">
        {[1, 2, 3, 4, 5].map((row) => (
          <div className="health-row" data-ascii="skip" key={row}>
            <AsciiSkeleton lines={1} widths={[84]} seed={460 + row} />
            <AsciiSkeleton lines={1} widths={['78%']} seed={470 + row} />
            <AsciiSkeleton lines={1} widths={[88]} seed={480 + row} />
            <AsciiSkeleton lines={1} widths={[96]} seed={485 + row} />
            <AsciiSkeleton lines={1} widths={[44]} seed={490 + row} />
            <AsciiSkeleton lines={1} widths={['80%']} seed={495 + row} />
          </div>
        ))}
      </div>
    </div>
  );
}

function AccessSkeleton() {
  return (
    <div className="access-page">
      <SkeletonHeader
        seed={500}
        titleWidth={250}
        subtitleWidth={400}
        right={<div className="state-sk-pill state-sk-pill--xl" />}
      />
      <div className="access-page__grid">
        {[1, 2].map((card) => (
          <div className="state-skeleton-card state-skeleton-card--access" data-ascii="skip" key={card}>
            <div className="state-sk-row-between">
              <div className="state-sk-pill state-sk-pill--sm" />
              <AsciiSkeleton lines={1} widths={[70]} seed={510 + card} />
            </div>
            <AsciiSkeleton lines={1} widths={['56%']} seed={520 + card} />
            <div className="state-sk-two-col">
              <AsciiSkeleton rows={2} width="100%" seed={530 + card} />
              <AsciiSkeleton rows={2} width="100%" seed={535 + card} />
              <AsciiSkeleton rows={2} width="100%" seed={540 + card} />
              <AsciiSkeleton rows={2} width="100%" seed={545 + card} />
              <AsciiSkeleton rows={2} width="100%" seed={550 + card} />
              <AsciiSkeleton rows={2} width="100%" seed={555 + card} />
            </div>
            <AsciiSkeleton lines={1} widths={['100%']} seed={560 + card} />
          </div>
        ))}
      </div>
    </div>
  );
}

function DatabaseBackupsSkeleton() {
  return (
    <div className="database-backups-page">
      <SkeletonHeader
        seed={600}
        titleWidth={250}
        subtitleWidth={370}
        right={<div className="state-sk-pill state-sk-pill--lg" />}
      />
      <div className="database-backups ht-card state-sk-stack" data-ascii="skip">
        <AsciiSkeleton lines={1} widths={[160]} seed={610} />
        <AsciiSkeleton rows={2} width="100%" seed={611} />
        <div className="database-backups__choices">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <div className="state-skeleton-card state-skeleton-card--choice" key={item}>
              <AsciiSkeleton lines={1} widths={['52%']} seed={620 + item} />
              <AsciiSkeleton lines={1} widths={['78%']} seed={630 + item} />
            </div>
          ))}
        </div>
        <div className="state-sk-pill state-sk-pill--cta" />
      </div>
      <div className="database-backups__history">
        {[1, 2, 3].map((row) => (
          <div className="state-skeleton-card state-skeleton-card--archive" data-ascii="skip" key={row}>
            <AsciiSkeleton lines={1} widths={['58%']} seed={640 + row} />
            <div className="state-sk-pill state-sk-pill--md" />
          </div>
        ))}
      </div>
    </div>
  );
}

function AlertsSkeleton() {
  return (
    <div className="alerts-page">
      <SkeletonHeader
        seed={700}
        titleWidth={160}
        subtitleWidth={330}
        right={<div className="state-sk-pill state-sk-pill--md" />}
      />
      <div className="ht-card notify-card state-sk-stack" data-ascii="skip">
        <AsciiSkeleton lines={1} widths={[180]} seed={710} />
        <div className="state-sk-two-col">
          <AsciiSkeleton rows={2} width="100%" seed={711} />
          <AsciiSkeleton rows={2} width="100%" seed={712} />
        </div>
        {[1, 2, 3].map((row) => (
          <AsciiSkeleton rows={2} width="100%" seed={720 + row} key={row} />
        ))}
      </div>
      <div className="ht-card notification-history state-sk-stack" data-ascii="skip">
        <AsciiSkeleton lines={1} widths={[200]} seed={730} />
        {[1, 2, 3, 4].map((row) => (
          <AsciiSkeleton rows={2} width="100%" seed={740 + row} key={row} />
        ))}
      </div>
    </div>
  );
}

// Page-specific ASCII skeletons match each route's actual layout so loading states mirror
// the real grid, header actions, and card footprint without layout jump when data arrives.
export function ConsoleLoadingState({ section = 'overview' }: { section?: ConsoleSection }) {
  let content: ReactNode;
  switch (section) {
    case 'services':
      content = <ServicesSkeleton />;
      break;
    case 'deployments':
      content = <DeploymentsSkeleton />;
      break;
    case 'health':
      content = <HealthSkeleton />;
      break;
    case 'access':
      content = <AccessSkeleton />;
      break;
    case 'database-backups':
      content = <DatabaseBackupsSkeleton />;
      break;
    case 'alerts':
      content = <AlertsSkeleton />;
      break;
    case 'overview':
    default:
      content = <OverviewSkeleton />;
      break;
  }

  return (
    <section className="console-state console-state--page" aria-live="polite" aria-label="Loading console data">
      {content}
    </section>
  );
}

export function ConsoleErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <section className="console-state console-state--error" role="alert">
    <div className="console-error-card"><div className="console-error-card__icon">!</div><div><p className="overview-kicker overview-kicker--danger">SYSTEM ALERT · DATA SYNC</p><h2>Data synchronization halted</h2><p>{message || 'Could not load console data. Check your connection and try again.'}</p></div><button className="ht-btn ht-btn--secondary" type="button" onClick={onRetry}>↻ Retry</button></div>
  </section>;
}

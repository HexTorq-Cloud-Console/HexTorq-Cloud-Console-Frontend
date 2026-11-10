'use client';

import { AsciiSkeleton } from 'ascii-reveal';

export function ConsoleLoadingState() {
  return (
    <section className="console-state" aria-live="polite" aria-label="Loading console data">
      <div className="console-state__heading" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <AsciiSkeleton variant="dither" lines={1} widths={['20%']} />
        <AsciiSkeleton variant="dither" lines={1} widths={['40%']} />
        <AsciiSkeleton variant="dither" lines={1} widths={['60%']} />
      </div>
      <div className="console-state__metrics">
        {[1, 2, 3, 4].map((item) => (
          <div className="state-skeleton-card" key={item} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <AsciiSkeleton variant="dither" lines={1} widths={['45%']} />
            <AsciiSkeleton variant="dither" rows={2} width="50%" height={28} />
            <AsciiSkeleton variant="dither" lines={1} widths={['80%']} />
          </div>
        ))}
      </div>
      <div className="console-state__body">
        <div className="state-skeleton-card state-skeleton-card--large" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <AsciiSkeleton variant="dither" lines={1} widths={['30%']} />
          <AsciiSkeleton variant="dither" lines={4} widths={['95%', '85%', '90%', '70%']} />
        </div>
        <div className="state-skeleton-card state-skeleton-card--large" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <AsciiSkeleton variant="dither" lines={1} widths={['35%']} />
          <AsciiSkeleton variant="dither" lines={3} widths={['90%', '80%', '60%']} />
        </div>
      </div>
    </section>
  );
}

export function ConsoleErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <section className="console-state console-state--error" role="alert">
      <div className="console-error-card">
        <div className="console-error-card__icon">!</div>
        <div>
          <p className="overview-kicker overview-kicker--danger">SYSTEM ALERT · DATA SYNC</p>
          <h2>Data synchronization halted</h2>
          <p>{message || 'Could not load console data. Check your connection and try again.'}</p>
        </div>
        <button className="ht-btn ht-btn--secondary" type="button" onClick={onRetry}>↻ Retry</button>
      </div>
    </section>
  );
}

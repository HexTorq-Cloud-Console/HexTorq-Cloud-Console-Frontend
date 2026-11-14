'use client';

import { AsciiSkeleton } from 'ascii-reveal';

// Loading placeholders drawn in shimmering glyphs. The surrounding card markup and class
// names are unchanged, so the footprint matches the real content and nothing jumps when
// the data lands.
export function ConsoleLoadingState() {
  return <section className="console-state" aria-live="polite" aria-label="Loading console data">
    <div className="console-state__heading"><AsciiSkeleton lines={1} widths={[180]} seed={1} /><AsciiSkeleton rows={2} width="min(420px,70%)" seed={2} /><AsciiSkeleton lines={1} widths={[280]} seed={3} /></div>
    <div className="console-state__metrics">{[1, 2, 3, 4].map((item) => <div className="state-skeleton-card" data-ascii="skip" key={item}><AsciiSkeleton lines={1} widths={[100]} seed={item * 10} /><AsciiSkeleton rows={2} width={72} seed={item * 10 + 1} /><AsciiSkeleton lines={1} widths={['52%']} seed={item * 10 + 2} /></div>)}</div>
    <div className="console-state__body"><div className="state-skeleton-card state-skeleton-card--large" data-ascii="skip"><AsciiSkeleton lines={1} widths={['52%']} seed={51} /><AsciiSkeleton rows={3} width="100%" seed={52} /><AsciiSkeleton rows={3} width="100%" seed={53} /><AsciiSkeleton rows={3} width="100%" seed={54} /></div><div className="state-skeleton-card state-skeleton-card--large" data-ascii="skip"><AsciiSkeleton lines={1} widths={['52%']} seed={61} /><AsciiSkeleton rows={3} width="100%" seed={62} /><AsciiSkeleton rows={3} width="100%" seed={63} /></div></div>
  </section>;
}

export function ConsoleErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <section className="console-state console-state--error" role="alert">
    <div className="console-error-card"><div className="console-error-card__icon">!</div><div><p className="overview-kicker overview-kicker--danger">SYSTEM ALERT · DATA SYNC</p><h2>Data synchronization halted</h2><p>{message || 'Could not load console data. Check your connection and try again.'}</p></div><button className="ht-btn ht-btn--secondary" type="button" onClick={onRetry}>↻ Retry</button></div>
  </section>;
}

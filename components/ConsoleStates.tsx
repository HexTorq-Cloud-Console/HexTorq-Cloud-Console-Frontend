'use client';

export function ConsoleLoadingState() {
  return <section className="console-state" aria-live="polite" aria-label="Loading console data">
    <div className="console-state__heading"><span className="state-skeleton state-skeleton--eyebrow" /><span className="state-skeleton state-skeleton--title" /><span className="state-skeleton state-skeleton--copy" /></div>
    <div className="console-state__metrics">{[1, 2, 3, 4].map((item) => <div className="state-skeleton-card" key={item}><span className="state-skeleton state-skeleton--small" /><span className="state-skeleton state-skeleton--metric" /><span className="state-skeleton state-skeleton--line" /></div>)}</div>
    <div className="console-state__body"><div className="state-skeleton-card state-skeleton-card--large"><span className="state-skeleton state-skeleton--line" /><span className="state-skeleton state-skeleton--wide" /><span className="state-skeleton state-skeleton--wide" /><span className="state-skeleton state-skeleton--wide" /></div><div className="state-skeleton-card state-skeleton-card--large"><span className="state-skeleton state-skeleton--line" /><span className="state-skeleton state-skeleton--wide" /><span className="state-skeleton state-skeleton--wide" /></div></div>
  </section>;
}

export function ConsoleErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <section className="console-state console-state--error" role="alert">
    <div className="console-error-card"><div className="console-error-card__icon">!</div><div><p className="overview-kicker overview-kicker--danger">SYSTEM ALERT · DATA SYNC</p><h2>Data synchronization halted</h2><p>{message || 'Could not load console data. Check your connection and try again.'}</p></div><button className="ht-btn ht-btn--secondary" type="button" onClick={onRetry}>↻ Retry</button></div>
  </section>;
}

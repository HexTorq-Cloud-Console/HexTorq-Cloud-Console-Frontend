'use client';

import React from 'react';
import { AsciiSkeleton } from 'ascii-reveal';
import { useAscii } from './AsciiContext';

export function AsciiServiceCardSkeleton() {
  const { skeletonVariant } = useAscii();
  return (
    <article className="service-tile is-skeleton" style={{ pointerEvents: 'none' }}>
      <div className="service-tile__head">
        <AsciiSkeleton variant={skeletonVariant} rows={2} width={28} height={28} style={{ borderRadius: '6px' }} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <AsciiSkeleton variant={skeletonVariant} lines={1} widths={['55%']} />
          <AsciiSkeleton variant={skeletonVariant} lines={1} widths={['35%']} />
        </div>
        <AsciiSkeleton variant={skeletonVariant} lines={1} widths={[65]} style={{ borderRadius: '999px' }} />
      </div>
      <div className="service-tile__meta" style={{ padding: '8px 0' }}>
        <AsciiSkeleton variant={skeletonVariant} lines={1} widths={['45%']} />
      </div>
      <div className="service-tile__commit" style={{ padding: '10px', background: 'rgba(7, 8, 13, 0.4)', borderRadius: '6px' }}>
        <AsciiSkeleton variant={skeletonVariant} lines={2} widths={['30%', '85%']} />
      </div>
      <div className="service-tile__runtime" style={{ padding: '6px 0' }}>
        <AsciiSkeleton variant={skeletonVariant} lines={1} widths={['75%']} />
      </div>
      <div className="service-tile__actions" style={{ display: 'flex', gap: '8px', paddingTop: '8px' }}>
        <AsciiSkeleton variant={skeletonVariant} lines={1} widths={[95]} height={32} style={{ borderRadius: '6px' }} />
        <AsciiSkeleton variant={skeletonVariant} lines={1} widths={[60]} height={32} style={{ borderRadius: '6px' }} />
      </div>
    </article>
  );
}

export function AsciiMetricCardSkeleton() {
  const { skeletonVariant } = useAscii();
  return (
    <article className="overview-metric is-skeleton">
      <AsciiSkeleton variant={skeletonVariant} lines={1} widths={['45%']} />
      <div style={{ margin: '8px 0' }}>
        <AsciiSkeleton variant={skeletonVariant} rows={2} width="40%" height={32} />
      </div>
      <AsciiSkeleton variant={skeletonVariant} lines={1} widths={['75%']} />
      <div style={{ marginTop: '12px' }}>
        <AsciiSkeleton variant={skeletonVariant} rows={1} width="100%" height={4} />
      </div>
    </article>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { PeakChart } from '@/components/ui/peak-chart';
import type { Bucket } from '../lib/metrics';
import type { MetricRange, Service } from '../types/api';

type RuntimeSummary = {
  online: number;
  total: number;
  errored: number;
  stopped: number;
  unknown: number;
  staticTotal: number;
  entries: Array<{ service: Service; status: string }>;
};

type DashboardPeakCardsProps = {
  range: MetricRange;
  compareLabel: string;
  currentTotal: number;
  currentSuccessful: number;
  currentFailed: number;
  currentRunning: number;
  completed: number;
  totalChange: number | null;
  successRate: number | null;
  rateChange: number | null;
  currentBuckets: Bucket[];
  formatBucketLabel: (value: string) => string;
  totalServices: number;
  enabledServices: number;
  pm2Count: number;
  staticCount: number;
  runtime: RuntimeSummary;
  agents: Service['agent'][];
  onlineAgents: number;
};

function useConsoleTheme(): 'light' | 'dark' {
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
  );

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setTheme(root.dataset.theme === 'dark' ? 'dark' : 'light');
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mo.disconnect();
  }, []);

  return theme;
}

function PeakSlot({ children }: { children: (width: number) => React.ReactNode }) {
  const slotRef = useRef<HTMLDivElement>(null);
  const [cardWidth, setCardWidth] = useState(215);

  useEffect(() => {
    const el = slotRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      if (w > 0) setCardWidth(Math.max(160, Math.floor(w)));
    };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={slotRef} className="kpi-peak-slot" data-ascii="surface">
      {children(cardWidth)}
    </div>
  );
}

/** Ensures PeakChart always receives >= 2 points so the curve and hover readout render cleanly. */
function ensureSeries(values: number[], labels: string[], fallback = 0): { data: number[]; labels: string[] } {
  if (values.length >= 2) return { data: values, labels };
  if (values.length === 1) return { data: [values[0], values[0]], labels: [labels[0] ?? 'Start', labels[0] ?? 'Now'] };
  return { data: [fallback, fallback], labels: ['Start', 'Now'] };
}

export default function DashboardPeakCards({
  range,
  compareLabel,
  currentTotal,
  currentSuccessful,
  currentFailed,
  currentRunning,
  completed,
  totalChange,
  successRate,
  rateChange,
  currentBuckets,
  formatBucketLabel,
  totalServices,
  enabledServices,
  pm2Count,
  staticCount,
  runtime,
  agents,
  onlineAgents,
}: DashboardPeakCardsProps) {
  const surfaceTheme = useConsoleTheme();

  // 1. Deployments card
  const deploySeries = ensureSeries(
    currentBuckets.map((b) => b.total),
    currentBuckets.map((b) => formatBucketLabel(b.date)),
    currentTotal,
  );
  const deployDelta =
    totalChange === null ? '' : `${totalChange >= 0 ? '+' : ''}${totalChange.toFixed(1)}% ${compareLabel}`;
  const deployWindowTag = range === 'custom' ? 'Custom' : range;

  // 2. Success rate card
  const rateSeries = ensureSeries(
    currentBuckets.map((b) => (b.total ? Math.round((b.successful / b.total) * 100) : 100)),
    currentBuckets.map((b) => formatBucketLabel(b.date)),
    successRate ?? 100,
  );
  const rateDelta =
    rateChange === null ? '' : `${rateChange >= 0 ? '+' : ''}${rateChange.toFixed(1)} pts ${compareLabel}`;

  // 3. Services card
  const serviceSeries = {
    data: [pm2Count, staticCount, enabledServices, totalServices],
    labels: ['PM2', 'Static', 'Enabled', 'Total'],
  };

  // 4. Service health card
  const healthSeries = ensureSeries(
    runtime.entries.slice(0, 12).map((e) => (e.status === 'online' ? 100 : e.status === 'stopped' ? 25 : 0)),
    runtime.entries.slice(0, 12).map((e) => e.service.name),
    runtime.online ? 100 : 0,
  );
  const healthCaption = `${runtime.errored ? `${runtime.errored} erroring · ` : ''}${runtime.stopped ? `${runtime.stopped} stopped · ` : ''}${runtime.unknown ? `${runtime.unknown} awaiting status` : 'all processes reporting'}${runtime.staticTotal ? ` · ${runtime.staticTotal} static` : ''}`;

  // 5. Agents online card
  const agentSeries =
    agents.length >= 2
      ? {
          data: agents.map((a) => (a.status === 'online' ? 100 : 15)),
          labels: agents.map((a) => a.name),
        }
      : {
          data: [0, agents.length ? (onlineAgents ? 100 : 25) : 0, agents.length ? (onlineAgents ? 100 : 25) : 0],
          labels: ['Idle', agents[0]?.name ?? 'Node', 'Live'],
        };

  return (
    <div className="kpi-peak-stage">
      <section className="kpi-grid kpi-grid--peak" aria-label="Workspace metrics">
        <PeakSlot>
          {(w) => (
            <PeakChart
              width={w}
              height={224}
              theme={surfaceTheme}
              accent="#4f8ef7"
              title={`Deployments (${deployWindowTag})`}
              value={currentTotal}
              valueSuffix=""
              data={deploySeries.data}
              labels={deploySeries.labels}
              updatedText={deployDelta}
              caption={`${currentSuccessful} successful · ${currentFailed} failed${currentRunning ? ` · ${currentRunning} running` : ''}`}
              trend={totalChange === null ? 'none' : totalChange >= 0 ? 'up' : 'down'}
              showPeriodFilter={false}
              formatValue={(v) => `${Math.round(v)}`}
            />
          )}
        </PeakSlot>

        <PeakSlot>
          {(w) => (
            <PeakChart
              width={w}
              height={224}
              theme={surfaceTheme}
              accent="#2ec99a"
              title="Success rate"
              value={successRate ?? 0}
              valueSuffix="%"
              data={rateSeries.data}
              labels={rateSeries.labels}
              updatedText={rateDelta}
              caption={`${currentSuccessful} of ${completed} completed deployments`}
              trend={rateChange === null ? 'none' : rateChange >= 0 ? 'up' : 'down'}
              showPeriodFilter={false}
              formatValue={(v) => `${Math.round(v)}%`}
            />
          )}
        </PeakSlot>

        <PeakSlot>
          {(w) => (
            <PeakChart
              width={w}
              height={224}
              theme={surfaceTheme}
              accent="#7c5cff"
              title="Services"
              value={totalServices}
              valueSuffix=""
              data={serviceSeries.data}
              labels={serviceSeries.labels}
              updatedText={`${enabledServices} enabled`}
              caption={`${pm2Count} PM2 · ${staticCount} static frontend`}
              trend={enabledServices > 0 ? 'up' : 'none'}
              showPeriodFilter={false}
              formatValue={(v) => `${Math.round(v)}`}
            />
          )}
        </PeakSlot>

        <PeakSlot>
          {(w) => (
            <PeakChart
              width={w}
              height={224}
              theme={surfaceTheme}
              accent="#14b8a6"
              title="Service health"
              value={runtime.online}
              valueSuffix=""
              data={healthSeries.data}
              labels={healthSeries.labels}
              updatedText={runtime.total ? `of ${runtime.total} running` : 'no services yet'}
              caption={healthCaption}
              trend={runtime.errored || runtime.stopped ? 'down' : runtime.online > 0 ? 'up' : 'none'}
              showPeriodFilter={false}
              formatValue={(v) => (v >= 80 ? 'Online' : v >= 20 ? 'Stopped' : 'Offline')}
            />
          )}
        </PeakSlot>

        <PeakSlot>
          {(w) => (
            <PeakChart
              width={w}
              height={224}
              theme={surfaceTheme}
              accent="#f59e0b"
              title="Agents online"
              value={onlineAgents}
              valueSuffix=""
              data={agentSeries.data}
              labels={agentSeries.labels}
              updatedText={agents.length ? `of ${agents.length} reporting` : 'no agents assigned'}
              caption={agents.length ? 'Live heartbeat status across managed VPS nodes' : 'Add an agent to manage runtime services'}
              trend={agents.length && onlineAgents === agents.length ? 'up' : agents.length ? 'down' : 'none'}
              showPeriodFilter={false}
              formatValue={(v) => (v >= 50 ? 'Online' : 'Offline')}
            />
          )}
        </PeakSlot>
      </section>
    </div>
  );
}

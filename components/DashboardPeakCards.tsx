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
  onRangeChange: (range: MetricRange) => void;
  rangeLabel: string;
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

function PeakSlot({ children }: { children: (width: number) => React.ReactNode }) {
  const slotRef = useRef<HTMLDivElement>(null);
  const [cardWidth, setCardWidth] = useState(210);

  useEffect(() => {
    const el = slotRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      if (w > 0) setCardWidth(Math.max(185, Math.min(340, Math.floor(w))));
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
  onRangeChange,
  rangeLabel,
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
  const [serviceView, setServiceView] = useState<'All' | 'PM2' | 'Static'>('All');
  const [healthView, setHealthView] = useState<'Online' | 'All'>('Online');
  const [agentView, setAgentView] = useState<'Online' | 'Total'>('Online');

  // 1. Deployments card
  const deploySeries = ensureSeries(
    currentBuckets.map((b) => b.total),
    currentBuckets.map((b) => formatBucketLabel(b.date)),
    currentTotal,
  );
  const deployDelta = totalChange === null ? rangeLabel : `${totalChange >= 0 ? '+' : ''}${totalChange.toFixed(1)}% ${compareLabel}`;

  // 2. Success rate card
  const rateSeries = ensureSeries(
    currentBuckets.map((b) => (b.total ? Math.round((b.successful / b.total) * 100) : 100)),
    currentBuckets.map((b) => formatBucketLabel(b.date)),
    successRate ?? 100,
  );
  const rateDelta =
    rateChange === null ? 'No prior window' : `${rateChange >= 0 ? '+' : ''}${rateChange.toFixed(1)} pts ${compareLabel}`;

  // 3. Services card
  const serviceValue = serviceView === 'PM2' ? pm2Count : serviceView === 'Static' ? staticCount : totalServices;
  const serviceSeries =
    serviceView === 'PM2'
      ? { data: [0, Math.round(pm2Count * 0.65), pm2Count], labels: ['Base', 'Active', 'PM2'] }
      : serviceView === 'Static'
        ? { data: [0, Math.round(staticCount * 0.7), staticCount], labels: ['Base', 'Edge', 'Static'] }
        : {
            data: [pm2Count, staticCount, enabledServices, totalServices],
            labels: ['PM2', 'Static', 'Enabled', 'Total'],
          };

  // 4. Service health card
  const healthValue = healthView === 'All' ? runtime.total : runtime.online;
  const healthSeries = ensureSeries(
    runtime.entries.slice(0, 12).map((e) => (e.status === 'online' ? 100 : e.status === 'stopped' ? 25 : 0)),
    runtime.entries.slice(0, 12).map((e) => e.service.name),
    runtime.online ? 100 : 0,
  );
  const healthCaption = `${runtime.errored ? `${runtime.errored} erroring · ` : ''}${runtime.stopped ? `${runtime.stopped} stopped · ` : ''}${runtime.unknown ? `${runtime.unknown} awaiting` : 'all reporting'}${runtime.staticTotal ? ` · ${runtime.staticTotal} static` : ''}`;

  // 5. Agents online card
  const agentValue = agentView === 'Total' ? agents.length : onlineAgents;
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
              accent="#4f8ef7"
              title={`Deployments (${range})`}
              value={currentTotal}
              valueSuffix=""
              data={deploySeries.data}
              labels={deploySeries.labels}
              updatedText={deployDelta}
              caption={`${currentSuccessful} ok · ${currentFailed} fail${currentRunning ? ` · ${currentRunning} run` : ''}`}
              trend={totalChange === null ? 'none' : totalChange >= 0 ? 'up' : 'down'}
              periods={['24h', '7d', '30d']}
              period={range}
              onPeriodChange={(p) => onRangeChange(p as MetricRange)}
              formatValue={(v) => `${Math.round(v)}`}
            />
          )}
        </PeakSlot>

        <PeakSlot>
          {(w) => (
            <PeakChart
              width={w}
              accent="#2ec99a"
              title="Success rate"
              value={successRate ?? 0}
              valueSuffix="%"
              data={rateSeries.data}
              labels={rateSeries.labels}
              updatedText={rateDelta}
              caption={`${currentSuccessful} of ${completed} completed`}
              trend={rateChange === null ? 'none' : rateChange >= 0 ? 'up' : 'down'}
              periods={['24h', '7d', '30d']}
              period={range}
              onPeriodChange={(p) => onRangeChange(p as MetricRange)}
              formatValue={(v) => `${Math.round(v)}%`}
            />
          )}
        </PeakSlot>

        <PeakSlot>
          {(w) => (
            <PeakChart
              width={w}
              accent="#7c5cff"
              title="Services"
              value={serviceValue}
              valueSuffix=""
              data={serviceSeries.data}
              labels={serviceSeries.labels}
              updatedText={`${enabledServices} enabled`}
              caption={`${pm2Count} PM2 · ${staticCount} static`}
              trend={enabledServices > 0 ? 'up' : 'none'}
              periods={['All', 'PM2', 'Static']}
              period={serviceView}
              onPeriodChange={(p) => setServiceView(p as 'All' | 'PM2' | 'Static')}
              formatValue={(v) => `${Math.round(v)}`}
            />
          )}
        </PeakSlot>

        <PeakSlot>
          {(w) => (
            <PeakChart
              width={w}
              accent="#14b8a6"
              title="Service health"
              value={healthValue}
              valueSuffix=""
              data={healthSeries.data}
              labels={healthSeries.labels}
              updatedText={runtime.total ? `of ${runtime.total} running` : 'no services'}
              caption={healthCaption}
              trend={runtime.errored || runtime.stopped ? 'down' : runtime.online > 0 ? 'up' : 'none'}
              periods={['Online', 'All']}
              period={healthView}
              onPeriodChange={(p) => setHealthView(p as 'Online' | 'All')}
              formatValue={(v) => (v >= 80 ? 'Online' : v >= 20 ? 'Stopped' : 'Offline')}
            />
          )}
        </PeakSlot>

        <PeakSlot>
          {(w) => (
            <PeakChart
              width={w}
              accent="#f59e0b"
              title="Agents online"
              value={agentValue}
              valueSuffix=""
              data={agentSeries.data}
              labels={agentSeries.labels}
              updatedText={agents.length ? `of ${agents.length} reporting` : 'no agents'}
              caption={agents.length ? 'VPS node heartbeats' : 'Assign an agent'}
              trend={agents.length && onlineAgents === agents.length ? 'up' : agents.length ? 'down' : 'none'}
              periods={['Online', 'Total']}
              period={agentView}
              onPeriodChange={(p) => setAgentView(p as 'Online' | 'Total')}
              formatValue={(v) => (v >= 50 ? 'Online' : 'Offline')}
            />
          )}
        </PeakSlot>
      </section>
    </div>
  );
}

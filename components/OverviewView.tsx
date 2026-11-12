'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import type { AnalyticsData, Deployment, Incident, MetricRange, Pm2Status, Service, WebhookHealthData } from '../types/api';
import {
  bucketSum,
  buildBuckets,
  buildHourlyBuckets,
  changeFor,
  fleetHealth,
  formatUptime,
  LIVE_INCIDENT_WINDOW_MS,
  successRateFor,
  type Bucket,
} from '../lib/metrics';
import WebhookHealthPanel from './WebhookHealthPanel';

type OverviewViewProps = {
  services: Service[];
  deployments: Deployment[];
  pm2Status: Record<string, Pm2Status>;
  health: WebhookHealthData | null;
  healthLoading: boolean;
  healthError: string;
  healthRunLoading: boolean;
  analytics: AnalyticsData | null;
  email?: string;
  role: string;
  range: MetricRange;
  onRangeChange: (range: MetricRange) => void;
  incidents: Incident[];
  failureAlerts: Array<{ id: string; title: string; timestamp: string; details: string }>;
  onDeploy: (serviceId: string, force?: boolean) => void;
  onForceDeploy: (serviceId: string) => void;
  deploying: string | null;
  onHealthSettings: () => void;
  onRunHealth: () => void;
  onDeployment: (deploymentId: string) => void;
};

type ChartMetric = 'total' | 'successful' | 'failed';
type Point = { x: number; y: number };
type Granularity = 'hour' | 'day';

const METRIC_CONFIG: Record<ChartMetric, { label: string; color: string }> = {
  total: { label: 'Total', color: 'var(--ht-chart-1)' },
  successful: { label: 'Successful', color: 'var(--ht-chart-2)' },
  failed: { label: 'Failed', color: 'var(--ht-danger)' },
};

const RANGE_CONFIG: Record<MetricRange, { label: string; short: string; granularity: Granularity; compare: string }> = {
  '24h': { label: 'Last 24 hours', short: '24h', granularity: 'hour', compare: 'vs prev 24h' },
  '7d': { label: 'Last 7 days', short: '7d', granularity: 'day', compare: 'vs prev 7d' },
  '30d': { label: 'Last 30 days', short: '30d', granularity: 'day', compare: 'vs prev 30d' },
};

const RANGE_KEYS: MetricRange[] = ['24h', '7d', '30d'];

function shortHash(value?: string | null) {
  return value ? value.slice(0, 8) : '—';
}

function relativeTime(value: string) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function displayDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function weekdayLabel(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short' });
}

/** Axis label for a bucket: the hour for hourly windows, the weekday for daily ones. */
function bucketLabel(value: string, granularity: Granularity) {
  if (granularity === 'hour') {
    return new Date(value).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  return weekdayLabel(value);
}

/** Full label used in the chart tooltip. */
function bucketFullLabel(value: string, granularity: Granularity) {
  if (granularity === 'hour') {
    return new Date(value).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }
  return displayDate(value);
}

function serviceTypeLabel(service: Service) {
  return service.type === 'STATIC_FRONTEND' ? 'STATIC' : 'PM2';
}

function displayNameFor(email?: string, role = '') {
  if (role === 'SUPER_ADMIN') return 'Administrator';
  if (!email) return 'your workspace';
  const local = email.split('@')[0] || '';
  const name = local.replace(/[._-]+/g, ' ').trim();
  return name || 'your workspace';
}

function smoothPath(points: Point[]) {
  if (!points.length) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  return points.reduce((path, point, index, list) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const previous = list[index - 1];
    const middle = (previous.x + point.x) / 2;
    return `${path} C ${middle} ${previous.y}, ${middle} ${point.y}, ${point.x} ${point.y}`;
  }, '');
}

function MetricIcon({ name }: { name: 'deployments' | 'success' | 'services' | 'agents' | 'health' }) {
  if (name === 'deployments') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91 0Z" />
        <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2Z" />
      </svg>
    );
  }
  if (name === 'success') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="m8.5 12.5 2.5 2.5 4.5-5.5" />
      </svg>
    );
  }
  if (name === 'services') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8Z" />
        <path d="m3.3 7 8.7 5 8.7-5M12 22V12" />
      </svg>
    );
  }
  if (name === 'health') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 12h3l2.5-6 4 13 2.5-7H21" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="3" width="20" height="8" rx="2" />
      <rect x="2" y="13" width="20" height="8" rx="2" />
      <path d="M6 7h.01M6 17h.01" />
    </svg>
  );
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const gradientId = useId().replace(/:/g, '');
  if (!values.length) return <div className="kpi-spark kpi-spark--empty" />;
  const width = 120;
  const height = 40;
  const max = Math.max(1, ...values);
  const points = values.map((value, index) => ({
    x: values.length === 1 ? width / 2 : (index / (values.length - 1)) * width,
    y: height - 4 - (value / max) * (height - 10),
  }));
  const line = smoothPath(points);
  return (
    <svg className="kpi-spark" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.26" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L ${width} ${height} L 0 ${height} Z`} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function ActivityChart({ buckets, metric, granularity }: { buckets: Bucket[]; metric: ChartMetric; granularity: Granularity }) {
  const gradientId = useId().replace(/:/g, '');
  const [hovered, setHovered] = useState<number | null>(null);
  const config = METRIC_CONFIG[metric];
  const values = buckets.map((bucket) => bucket[metric]);
  const width = 720;
  const height = 250;
  const padLeft = 38;
  const padRight = 14;
  const padTop = 14;
  const padBottom = 34;
  const innerWidth = width - padLeft - padRight;
  const innerHeight = height - padTop - padBottom;
  const max = Math.max(4, Math.ceil(Math.max(1, ...values) / 4) * 4);
  const points = values.map((value, index) => ({
    x: padLeft + (values.length === 1 ? innerWidth / 2 : (index / Math.max(1, values.length - 1)) * innerWidth),
    y: padTop + innerHeight - (value / max) * innerHeight,
  }));
  const line = smoothPath(points);
  const area = `${line} L ${padLeft + innerWidth} ${padTop + innerHeight} L ${padLeft} ${padTop + innerHeight} Z`;
  const ticks = [0, 1, 2, 3, 4];
  const empty = values.every((value) => value === 0);
  // Hourly windows carry 24 labels — show every third one so the axis stays readable.
  const labelStep = granularity === 'hour' ? 3 : 1;
  const slot = innerWidth / Math.max(1, values.length);
  const hoveredPoint = hovered !== null ? points[hovered] : null;
  const hoveredBucket = hovered !== null ? buckets[hovered] : null;

  return (
    <div className="chart-wrap" onMouseLeave={() => setHovered(null)}>
      <svg className="activity-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${config.label} deployments per ${granularity}`}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={config.color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={config.color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((tick) => {
          const y = padTop + innerHeight - (tick / 4) * innerHeight;
          return (
            <g key={tick}>
              <line x1={padLeft} y1={y} x2={padLeft + innerWidth} y2={y} stroke="var(--ht-line)" strokeDasharray="3 5" />
              <text x={padLeft - 8} y={y + 3} textAnchor="end" className="chart-axis-text">{Math.round((max / 4) * tick)}</text>
            </g>
          );
        })}
        <path d={area} fill={`url(#${gradientId})`} />
        <path d={line} fill="none" stroke={config.color} strokeWidth="2.4" strokeLinecap="round" />
        {hoveredPoint && (
          <g className="chart-hover" aria-hidden="true">
            <line className="chart-hover-line" x1={hoveredPoint.x} y1={padTop} x2={hoveredPoint.x} y2={padTop + innerHeight} />
            <circle cx={hoveredPoint.x} cy={hoveredPoint.y} r="5" fill="var(--ht-card)" stroke={config.color} strokeWidth="2.5" />
          </g>
        )}
        {points.map((point, index) => (
          <g key={buckets[index]?.date || index}>
            <rect
              className="chart-hit"
              x={point.x - slot / 2}
              y={padTop}
              width={slot}
              height={innerHeight}
              onMouseEnter={() => setHovered(index)}
              onFocus={() => setHovered(index)}
            />
            <circle cx={point.x} cy={point.y} r="3.4" fill="var(--ht-card)" stroke={config.color} strokeWidth="2">
              <title>{`${bucketFullLabel(buckets[index].date, granularity)}: ${values[index]} ${config.label.toLowerCase()}`}</title>
            </circle>
            {(index % labelStep === 0 || index === points.length - 1) && (
              <text x={point.x} y={height - 10} textAnchor="middle" className="chart-axis-text">
                {bucketLabel(buckets[index].date, granularity)}
              </text>
            )}
          </g>
        ))}
        {empty && <text x={padLeft + innerWidth / 2} y={padTop + innerHeight / 2} textAnchor="middle" className="chart-empty-text">No deployments in this window</text>}
      </svg>
      {hoveredPoint && hoveredBucket && (
        <div className="chart-tooltip" style={{ left: `${(hoveredPoint.x / width) * 100}%` }} role="status">
          <strong>{bucketFullLabel(hoveredBucket.date, granularity)}</strong>
          <span>Total <b>{hoveredBucket.total}</b></span>
          <span className="is-success">Successful <b>{hoveredBucket.successful}</b></span>
          <span className="is-danger">Failed <b>{hoveredBucket.failed}</b></span>
          {hoveredBucket.running > 0 && <span className="is-warning">Running <b>{hoveredBucket.running}</b></span>}
        </div>
      )}
    </div>
  );
}

function OutcomeDonut({ successful, failed, running }: { successful: number; failed: number; running: number }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const total = successful + failed + running;
  const radius = 52;
  const stroke = 15;
  const circumference = 2 * Math.PI * radius;
  const segments = [
    { label: 'Successful', value: successful, color: 'var(--ht-chart-2)' },
    { label: 'Failed', value: failed, color: 'var(--ht-danger)' },
    { label: 'Running', value: running, color: 'var(--ht-chart-4)' },
  ];
  let offset = 0;

  return (
    <div className="outcome">
      <svg className="donut" viewBox="0 0 140 140" role="img" aria-label={`${total} deployments in the selected window`}>
        <circle cx="70" cy="70" r={radius} fill="none" stroke="var(--ht-line)" strokeWidth={stroke} />
        {segments.map((segment) => {
          const length = total ? (segment.value / total) * circumference : 0;
          const arc = (
            <circle
              key={segment.label}
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={hovered === segment.label ? stroke + 4 : stroke}
              strokeDasharray={`${length} ${circumference}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 70 70)"
              className="donut-segment"
              onMouseEnter={() => setHovered(segment.label)}
              onMouseLeave={() => setHovered(null)}
            >
              <title>{`${segment.label}: ${segment.value} (${total ? Math.round((segment.value / total) * 100) : 0}%)`}</title>
            </circle>
          );
          offset += length;
          return arc;
        })}
        <text x="70" y="66" textAnchor="middle" className="donut-total">{total}</text>
        <text x="70" y="84" textAnchor="middle" className="donut-label">deployments</text>
      </svg>
      <ul className="donut-legend">
        {segments.map((segment) => (
          <li key={segment.label}>
            <span className="donut-dot" style={{ background: segment.color }} />
            <span>{segment.label}</span>
            <strong>{segment.value}</strong>
            <small>{total ? Math.round((segment.value / total) * 100) : 0}%</small>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChangeBadge({ value, suffix = '%', compare = 'vs prev 7d' }: { value: number | null; suffix?: string; compare?: string }) {
  if (value === null) return <span className="kpi-change kpi-change--muted">no prior window</span>;
  const up = value >= 0;
  return (
    <span className={`kpi-change ${up ? 'is-up' : 'is-down'}`}>
      {up ? '↑' : '↓'} {Math.abs(value).toFixed(1)}{suffix} <small>{compare}</small>
    </span>
  );
}

function GoalBar({ label, description, value, color }: { label: string; description: string; value: number; color: string }) {
  const width = Math.max(0, Math.min(100, Math.round(value * 100)));
  return (
    <div className="goal">
      <div className="goal__head">
        <span>{label}</span>
        <strong>{description}</strong>
      </div>
      <div className="goal__bar">
        <span style={{ width: `${width}%`, background: color }} />
      </div>
    </div>
  );
}

export default function OverviewView({
  services,
  deployments,
  pm2Status,
  health,
  healthLoading,
  healthError,
  healthRunLoading,
  analytics,
  email,
  role,
  range,
  onRangeChange,
  incidents,
  failureAlerts,
  onDeploy,
  onForceDeploy,
  deploying,
  onHealthSettings,
  onRunHealth,
  onDeployment,
}: OverviewViewProps) {
  const [metric, setMetric] = useState<ChartMetric>('total');
  const isClient = role === 'CLIENT';
  const rangeConfig = RANGE_CONFIG[range];

  const analyticsBuckets: Bucket[] = analytics?.daily?.length
    ? analytics.daily
    : buildBuckets(deployments, range === '30d' ? 30 : 14);

  // Hourly windows are counted from the deployment history; daily windows come from
  // the buckets the backend already aggregates.
  let currentBuckets: Bucket[];
  let previousBuckets: Bucket[];
  if (range === '24h') {
    currentBuckets = buildHourlyBuckets(deployments, 24);
    previousBuckets = buildHourlyBuckets(deployments, 24, 24);
  } else if (range === '30d') {
    currentBuckets = analyticsBuckets.slice(-30);
    // The backend caps its window at 30 days, so there is no earlier window to compare against.
    previousBuckets = [];
  } else {
    currentBuckets = analyticsBuckets.slice(-7);
    previousBuckets = analyticsBuckets.length > 7 ? analyticsBuckets.slice(0, -7) : [];
  }
  const currentTotal = bucketSum(currentBuckets, 'total');
  const currentSuccessful = bucketSum(currentBuckets, 'successful');
  const currentFailed = bucketSum(currentBuckets, 'failed');
  const currentRunning = bucketSum(currentBuckets, 'running');
  const completed = currentSuccessful + currentFailed;
  const successRate = successRateFor(currentBuckets);
  const previousTotal = bucketSum(previousBuckets, 'total');
  const previousRate = successRateFor(previousBuckets);
  const totalChange = previousBuckets.length ? changeFor(currentTotal, previousTotal) : null;
  const rateChange = previousBuckets.length && successRate !== null && previousRate !== null ? successRate - previousRate : null;
  const bestBucket = currentBuckets.reduce((best, bucket) => (bucket.total > best.total ? bucket : best), currentBuckets[0]);

  const analyticsServices = analytics?.services;
  const totalServices = analyticsServices?.total ?? services.length;
  const enabledServices = analyticsServices?.enabled ?? services.filter((service) => service.enabled).length;
  const pm2Count = analyticsServices?.pm2 ?? services.filter((service) => service.type === 'PM2').length;
  const staticCount = analyticsServices?.static ?? services.filter((service) => service.type === 'STATIC_FRONTEND').length;
  const enabledServiceRecords = services.filter((service) => service.enabled);
  const shownServices = enabledServiceRecords.slice(0, 3);
  const recentDeployments = deployments.slice(0, 6);
  const latestHealth = health?.activeRun || health?.latestRun || null;
  const healthCompleted = latestHealth ? latestHealth.successfulServices + latestHealth.failedServices : 0;

  const agentMap = new Map<string, Service['agent']>();
  for (const service of services) {
    if (service.agent?.id) agentMap.set(service.agent.id, service.agent);
  }
  const agents = [...agentMap.values()];
  const onlineAgents = agents.filter((agent) => agent.status === 'online').length;
  const onlineRatio = agents.length ? onlineAgents / agents.length : 0;

  // Runtime health of every service the console tracks (PM2 status is polled live).
  const runtime = fleetHealth(services, pm2Status);

  // Live feed: only problems that happen right now are listed here. The console raises
  // them as they occur; older failures stay in the alert history.
  const liveIncidents = incidents.filter(
    (incident) => Date.now() - new Date(incident.at).getTime() < LIVE_INCIDENT_WINDOW_MS,
  );

  const rangeLabel = currentBuckets.length
    ? range === '24h'
      ? bucketFullLabel(currentBuckets[0].date, 'hour')
      : `${displayDate(currentBuckets[0].date)} – ${displayDate(currentBuckets[currentBuckets.length - 1].date)}`
    : rangeConfig.label;
  const averagePerBucket = currentBuckets.length ? Math.round((currentTotal / currentBuckets.length) * 10) / 10 : 0;
  const latestRun = health?.latestRun;

  const activity = [
    ...deployments.slice(0, 4).map((deployment) => ({
      id: `deployment-${deployment.id}`,
      title: deployment.service.name,
      detail: `${deployment.status.toLowerCase()} · ${deployment.branch || 'origin/HEAD'}`,
      at: deployment.completedAt || deployment.startedAt,
      tone: deployment.status === 'SUCCESS' ? 'success' : deployment.status === 'FAILED' || deployment.status === 'ERROR' ? 'danger' : 'warning',
    })),
    ...(isClient && latestRun
      ? [{
          id: `health-${latestRun.id}`,
          title: 'Webhook health run',
          detail: `${latestRun.successfulServices}/${latestRun.totalServices} checks passed`,
          at: latestRun.startedAt,
          tone: latestRun.status === 'SUCCESS' ? 'success' : latestRun.status === 'FAILED' ? 'danger' : 'warning',
        }]
      : []),
  ]
    .sort((first, second) => new Date(second.at).getTime() - new Date(first.at).getTime())
    .slice(0, 5);

  return (
    <div className="overview-page">
      <header className="dash-header">
        <div>
          <p className="dash-kicker"><span className="dash-kicker__dot" /> {isClient ? 'Production runtime' : 'Control plane · All tenants'}</p>
          <h1>Dashboard</h1>
          <p className="dash-sub">Welcome back, {displayNameFor(email, role)}. Here&apos;s what&apos;s happening across your deployments today.</p>
        </div>
        <div className="dash-actions">
          <div className="chart-tabs chart-tabs--range" role="tablist" aria-label="Metrics time range">
            {RANGE_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={range === key}
                title={RANGE_CONFIG[key].label}
                className={`chart-tab${range === key ? ' is-active' : ''}`}
                onClick={() => onRangeChange(key)}
              >
                {RANGE_CONFIG[key].short}
              </button>
            ))}
          </div>
          <span className="dash-chip">{rangeLabel}</span>
          {isClient ? (
            <button className="ht-btn ht-btn--primary" type="button" onClick={onRunHealth} disabled={healthRunLoading || !services.length}>
              {healthRunLoading ? 'Running checks...' : 'Run health checks'}
            </button>
          ) : (
            <Link className="ht-btn ht-btn--primary" href="/admin/services">New service</Link>
          )}
        </div>
      </header>

      <section className="kpi-grid" aria-label="Workspace metrics">
        <article className="kpi-card">
          <div className="kpi-card__top">
            <span className="kpi-label">Deployments ({rangeConfig.short})</span>
            <span className="kpi-icon kpi-icon--orange"><MetricIcon name="deployments" /></span>
          </div>
          <div className="kpi-value-row">
            <strong>{currentTotal}</strong>
            <ChangeBadge value={totalChange} compare={rangeConfig.compare} />
          </div>
          <p className="kpi-meta">{currentSuccessful} successful · {currentFailed} failed{currentRunning ? ` · ${currentRunning} running` : ''}</p>
          <Sparkline values={currentBuckets.map((bucket) => bucket.total)} color="var(--ht-chart-1)" />
        </article>

        <article className="kpi-card">
          <div className="kpi-card__top">
            <span className="kpi-label">Success rate</span>
            <span className="kpi-icon kpi-icon--teal"><MetricIcon name="success" /></span>
          </div>
          <div className="kpi-value-row">
            <strong>{successRate === null ? '—' : `${successRate}%`}</strong>
            <ChangeBadge value={rateChange} suffix=" pts" compare={rangeConfig.compare} />
          </div>
          <p className="kpi-meta">{currentSuccessful} of {completed} completed deployments</p>
          <Sparkline values={currentBuckets.map((bucket) => bucket.successful)} color="var(--ht-chart-2)" />
        </article>

        <article className="kpi-card">
          <div className="kpi-card__top">
            <span className="kpi-label">Services</span>
            <span className="kpi-icon kpi-icon--navy"><MetricIcon name="services" /></span>
          </div>
          <div className="kpi-value-row">
            <strong>{totalServices}</strong>
            <span className="kpi-change kpi-change--muted">{enabledServices} enabled</span>
          </div>
          <p className="kpi-meta">{pm2Count} PM2 · {staticCount} static frontend</p>
          <div className="kpi-split">
            <span style={{ width: `${totalServices ? (pm2Count / totalServices) * 100 : 0}%`, background: 'var(--ht-chart-1)' }} />
            <span style={{ width: `${totalServices ? (staticCount / totalServices) * 100 : 0}%`, background: 'var(--ht-chart-3)' }} />
          </div>
          <div className="kpi-split-legend"><span><i style={{ background: 'var(--ht-chart-1)' }} />PM2</span><span><i style={{ background: 'var(--ht-chart-3)' }} />Static</span></div>
        </article>

        <article className="kpi-card">
          <div className="kpi-card__top">
            <span className="kpi-label">Service health</span>
            <span className="kpi-icon kpi-icon--teal"><MetricIcon name="health" /></span>
          </div>
          <div className="kpi-value-row">
            <strong>{runtime.online}</strong>
            <span className={`kpi-change ${runtime.stopped || runtime.errored ? 'is-down' : 'kpi-change--muted'}`}>
              {runtime.total ? `of ${runtime.total} running` : 'no services yet'}
            </span>
          </div>
          <p className="kpi-meta">
            {runtime.errored ? `${runtime.errored} erroring · ` : ''}{runtime.stopped ? `${runtime.stopped} stopped · ` : ''}
            {runtime.unknown ? `${runtime.unknown} awaiting status` : 'all processes reporting'}
            {runtime.staticTotal ? ` · ${runtime.staticTotal} static` : ''}
          </p>
          {runtime.entries.length ? (
            <div className="health-dots">
              {runtime.entries.slice(0, 10).map((entry) => (
                <span
                  key={entry.service.id}
                  className={`health-dot health-dot--${entry.status}`}
                  title={`${entry.service.name}: ${entry.status}${entry.uptime ? ` · up ${formatUptime(entry.uptime)}` : ''}`}
                />
              ))}
            </div>
          ) : (
            <div className="health-dots health-dots--empty" />
          )}
        </article>

        <article className="kpi-card">
          <div className="kpi-card__top">
            <span className="kpi-label">Agents online</span>
            <span className="kpi-icon kpi-icon--amber"><MetricIcon name="agents" /></span>
          </div>
          <div className="kpi-value-row">
            <strong>{agents.length ? onlineAgents : '—'}</strong>
            <span className={`kpi-change ${onlineAgents === agents.length && agents.length ? 'is-up' : 'kpi-change--muted'}`}>
              {agents.length ? `of ${agents.length} reporting` : 'no agents assigned'}
            </span>
          </div>
          <p className="kpi-meta">{agents.length ? 'Live heartbeat status across managed VPS nodes' : 'Add an agent to manage runtime services'}</p>
          {agents.length ? (
            <div className="agent-dots">
              {agents.slice(0, 8).map((agent) => (
                <span key={agent.id} className={`agent-dot agent-dot--${agent.status || 'unknown'}`} title={`${agent.name}: ${agent.status || 'unknown'}`} />
              ))}
            </div>
          ) : (
            <div className="agent-dots agent-dots--empty" />
          )}
        </article>
      </section>

      <section className="panel incident-panel" aria-labelledby="incident-title">
        <div className="panel__head">
          <div>
            <h2 className="panel__title" id="incident-title">
              Live incidents
              <span className="live-pill"><span className="live-pill__dot" />LIVE</span>
            </h2>
            <p className="panel__hint">Errors happening right now across your services</p>
          </div>
          <Link className="panel__link" href="/alerts">Alert history</Link>
        </div>
        {liveIncidents.length === 0 ? (
          <div className="attention-empty">
            <span className="attention-empty__icon" aria-hidden="true">✓</span>
            <div>
              <strong>No live incidents</strong>
              <span>Everything is deploying and reporting normally right now.</span>
            </div>
          </div>
        ) : (
          <div className="incident-list">
            {liveIncidents.map((incident) => (
              <article key={incident.id} className={`incident-item incident-item--${incident.severity}`}>
                <span className="incident-item__icon" aria-hidden="true">
                  {incident.severity === 'success' ? '✓' : incident.severity === 'danger' ? '!' : '⚠'}
                </span>
                <div className="incident-item__body">
                  <strong>{incident.title}</strong>
                  <span>{incident.detail}</span>
                </div>
                <time className="incident-item__time" dateTime={incident.at}>{relativeTime(incident.at)}</time>
                {incident.deploymentId ? (
                  <button type="button" className="incident-item__action" onClick={() => onDeployment(incident.deploymentId as string)}>
                    View logs
                  </button>
                ) : incident.serviceId ? (
                  <Link className="incident-item__action" href="/services">Open service</Link>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="dash-grid-main">
        <div className="dash-primary">
        <section className="panel chart-panel">
          <div className="panel__head">
            <div>
              <h2 className="panel__title">Deployment activity</h2>
              <p className="panel__hint">
                {range === '24h' ? 'Hourly deployments over the last 24 hours' : `Daily deployments over ${rangeConfig.label.toLowerCase()}`}
              </p>
            </div>
            <div className="chart-tabs" role="tablist" aria-label="Deployment activity metric">
              {(Object.keys(METRIC_CONFIG) as ChartMetric[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={metric === key}
                  className={`chart-tab${metric === key ? ' is-active' : ''}`}
                  onClick={() => setMetric(key)}
                >
                  {METRIC_CONFIG[key].label}
                </button>
              ))}
            </div>
          </div>
          <div className="chart-summary">
            <div><span>Total</span><strong>{bucketSum(currentBuckets, metric)}</strong></div>
            <div><span>{range === '24h' ? 'Hourly average' : 'Daily average'}</span><strong>{averagePerBucket}</strong></div>
            <div>
              <span>{range === '24h' ? 'Busiest hour' : 'Best day'}</span>
              <strong>{bestBucket && bestBucket.total ? `${bucketLabel(bestBucket.date, rangeConfig.granularity)} · ${bestBucket.total}` : '—'}</strong>
            </div>
          </div>
          <ActivityChart buckets={currentBuckets} metric={metric} granularity={rangeConfig.granularity} />
        </section>

        <section className="panel recent-panel">
          <div className="panel__head">
            <div>
              <h2 className="panel__title">Recent deployments</h2>
              <p className="panel__hint">Latest rollout activity across services</p>
            </div>
            <Link className="panel__link" href="/deployments">View all</Link>
          </div>
          {recentDeployments.length === 0 ? (
            <div className="dash-empty">No deployments recorded yet.</div>
          ) : (
            <div className="recent-table">
              <div className="recent-head" aria-hidden="true">
                <span>Service</span><span>Commit</span><span>Branch</span><span>Status</span><span>When</span>
              </div>
              {recentDeployments.map((deployment) => {
                const failed = deployment.status === 'FAILED' || deployment.status === 'ERROR';
                return (
                  <button
                    className={`recent-row${failed ? ' recent-row--failed' : ''}`}
                    type="button"
                    key={deployment.id}
                    onClick={() => onDeployment(deployment.id)}
                    title={failed ? `Open the full deployment log for ${deployment.service.name}` : `Open deployment details for ${deployment.service.name}`}
                  >
                    <strong>{deployment.service.name}</strong>
                    <span className="recent-commit"><code>{shortHash(deployment.commitHash)}</code>{deployment.commitMessage || 'Message not reported'}</span>
                    <span className="recent-branch">{deployment.branch || 'origin/HEAD'}</span>
                    <span className={`status-pill status-pill--${deployment.status === 'SUCCESS' ? 'success' : failed ? 'danger' : 'warning'}`}>{deployment.status}</span>
                    <time>{relativeTime(deployment.startedAt)}</time>
                  </button>
                );
              })}
            </div>
          )}
        </section>
        </div>

        <div className="dash-side">
          <section className="panel">
            <div className="panel__head">
              <div>
                <h2 className="panel__title">Deployment outcomes</h2>
                <p className="panel__hint">{rangeConfig.label}</p>
              </div>
            </div>
            <OutcomeDonut successful={currentSuccessful} failed={currentFailed} running={currentRunning} />
          </section>

          <section className="panel">
            <div className="panel__head">
              <div>
                <h2 className="panel__title">Platform goals</h2>
                <p className="panel__hint">Live coverage across your workspace</p>
              </div>
            </div>
            <div className="goals">
              <GoalBar label="Success rate" description={successRate === null ? 'No completed runs' : `${successRate}%`} value={(successRate || 0) / 100} color="var(--ht-chart-2)" />
              <GoalBar label="Enabled services" description={`${enabledServices} / ${totalServices}`} value={totalServices ? enabledServices / totalServices : 0} color="var(--ht-chart-1)" />
              <GoalBar label="Agent coverage" description={`${onlineAgents} / ${agents.length}`} value={onlineRatio} color="var(--ht-chart-3)" />
              {isClient && (
                <GoalBar
                  label="Webhook health"
                  description={latestHealth ? `${latestHealth.successfulServices} / ${latestHealth.totalServices}` : 'Not run yet'}
                  value={latestHealth && latestHealth.totalServices ? latestHealth.successfulServices / latestHealth.totalServices : 0}
                  color="var(--ht-chart-4)"
                />
              )}
            </div>
            {isClient && (
              <div className="health-summary-line">
                <span className={`agent-dot agent-dot--${latestHealth?.status === 'SUCCESS' ? 'online' : latestHealth?.status === 'FAILED' ? 'offline' : latestHealth?.status === 'PARTIAL' ? 'warning' : 'unknown'}`} />
                {latestHealth ? `${healthCompleted} checks completed` : 'No webhook health run recorded'}
                {health?.schedule.nextRunAt ? <em>Next {relativeTime(health.schedule.nextRunAt)}</em> : null}
              </div>
            )}
          </section>

          <section className="panel activity-panel">
            <div className="panel__head">
              <div>
                <h2 className="panel__title">Recent activity</h2>
                <p className="panel__hint">Fleet and deployment events</p>
              </div>
            </div>
            {activity.length === 0 ? (
              <div className="dash-empty">No activity recorded yet.</div>
            ) : (
              <ul className="activity-list">
                {activity.map((item) => (
                  <li key={item.id}>
                    <span className={`activity-dot activity-dot--${item.tone}`} />
                    <div>
                      <strong>{item.title}</strong>
                      <span>{item.detail}</span>
                    </div>
                    <time>{relativeTime(item.at)}</time>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <div className="dash-grid-bottom">

      <section className="panel services-panel">
        <div className="panel__head">
          <div>
            <h2 className="panel__title">Active services</h2>
            <p className="panel__hint">{enabledServiceRecords.length} enabled across {agents.length} agent{agents.length === 1 ? '' : 's'}</p>
          </div>
          <Link className="panel__link" href="/services">View all services</Link>
        </div>
        {shownServices.length === 0 ? (
          <div className="dash-empty">No enabled services are configured yet.</div>
        ) : (
          <div className="service-list">
            {shownServices.map((service) => {
              const status = service.type === 'PM2' ? pm2Status[service.id] : undefined;
              const latest = deployments.find((deployment) => deployment.service.id === service.id);
              const isDeploying = deploying === service.id;
              const hasRuntime = status && typeof status === 'object' && Object.keys(status).length > 0;
              return (
                <article className="service-row" key={service.id}>
                  <span className={`service-row__icon ${service.type === 'PM2' ? 'is-pm2' : 'is-static'}`} aria-hidden="true">
                    {service.type === 'PM2' ? '◈' : '◇'}
                  </span>
                  <div className="service-row__main">
                    <div className="service-row__title">
                      <h3>{service.name}</h3>
                      <span className={`ht-badge ${service.type === 'PM2' ? 'ht-badge--pm2' : 'ht-badge--static'}`}>{serviceTypeLabel(service)}</span>
                      <span className="agent-pill"><span className={`agent-dot agent-dot--${service.agent.status === 'online' ? 'online' : service.agent.status === 'offline' ? 'offline' : 'unknown'}`} />{service.agent.status || 'unknown'}</span>
                    </div>
                    <p className="service-row__path">{service.type === 'PM2' ? service.pm2ProcessName || service.workingDirectory : service.deployDirectory || service.workingDirectory}</p>
                    <p className="service-row__meta">
                      {service.type === 'PM2' && hasRuntime ? (
                        <>{status?.status || 'unknown'}{typeof status?.cpu === 'number' ? ` · CPU ${status.cpu}%` : ''}{typeof status?.memory === 'number' ? ` · ${Math.round(status.memory / 1024 / 1024)} MB` : ''}</>
                      ) : service.type === 'PM2' ? (
                        <>Runtime telemetry unavailable</>
                      ) : (
                        <>Static frontend · {service.branch || 'origin/HEAD'}</>
                      )}
                    </p>
                    <p className="service-row__commit"><code>{shortHash(latest?.commitHash)}</code>{latest?.commitMessage || 'No deployment recorded yet'}</p>
                  </div>
                  <div className="service-row__actions">
                    <button className="ht-btn ht-btn--primary ht-btn--sm" type="button" onClick={() => onDeploy(service.id)} disabled={isDeploying || !service.enabled}>{isDeploying ? 'Deploying...' : 'Deploy'}</button>
                    <button className="ht-btn ht-btn--secondary ht-btn--sm" type="button" onClick={() => onForceDeploy(service.id)} disabled={isDeploying || !service.enabled}>Force</button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      </div>

      {isClient && (
        <div className="overview-health" id="health">
          <WebhookHealthPanel health={health} loading={healthLoading} error={healthError} runLoading={healthRunLoading} onSettings={onHealthSettings} onRun={onRunHealth} />
        </div>
      )}
    </div>
  );
}

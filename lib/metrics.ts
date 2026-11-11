import type { Deployment, Pm2Status, Service } from '../types/api';

/**
 * Shared metric helpers for the client dashboard: time bucketing (hourly and daily),
 * comparisons between windows, and the fleet-health rollup used by the service health
 * card and the "needs attention" list.
 */

export type Bucket = {
  /** ISO timestamp: midnight for daily buckets, the hour for hourly ones. */
  date: string;
  total: number;
  successful: number;
  failed: number;
  running: number;
};

export type BucketKey = 'total' | 'successful' | 'failed' | 'running';

/** Daily buckets for the last `days` days, counted from the deployment history. */
export function buildBuckets(deployments: Deployment[], days = 7): Bucket[] {
  const buckets = new Map<string, Bucket>();
  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - index);
    const key = date.toISOString().slice(0, 10);
    buckets.set(key, { date: key, total: 0, successful: 0, failed: 0, running: 0 });
  }
  for (const deployment of deployments) {
    const bucket = buckets.get(new Date(deployment.startedAt).toISOString().slice(0, 10));
    if (!bucket) continue;
    countDeployment(bucket, deployment);
  }
  return [...buckets.values()];
}

/**
 * Hourly buckets for the last `hours` hours. `offsetHours` shifts the window back, so
 * the previous hour-range can be counted for period-over-period comparisons.
 */
export function buildHourlyBuckets(deployments: Deployment[], hours: number, offsetHours = 0): Bucket[] {
  const buckets = new Map<string, Bucket>();
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() - (hours - 1) - offsetHours);
  for (let index = 0; index < hours; index += 1) {
    const hour = new Date(start);
    hour.setHours(start.getHours() + index);
    const key = hour.toISOString();
    buckets.set(key, { date: key, total: 0, successful: 0, failed: 0, running: 0 });
  }
  for (const deployment of deployments) {
    const started = new Date(deployment.startedAt);
    const key = new Date(started);
    key.setMinutes(0, 0, 0);
    const bucket = buckets.get(key.toISOString());
    if (!bucket) continue;
    countDeployment(bucket, deployment);
  }
  return [...buckets.values()];
}

function countDeployment(bucket: Bucket, deployment: Deployment): void {
  bucket.total += 1;
  if (deployment.status === 'SUCCESS') bucket.successful += 1;
  else if (deployment.status === 'FAILED' || deployment.status === 'ERROR') bucket.failed += 1;
  else bucket.running += 1;
}

export function bucketSum(buckets: Bucket[], key: BucketKey): number {
  return buckets.reduce((total, bucket) => total + bucket[key], 0);
}

export function successRateFor(buckets: Bucket[]): number | null {
  const successful = bucketSum(buckets, 'successful');
  const failed = bucketSum(buckets, 'failed');
  const completed = successful + failed;
  return completed ? Math.round((successful / completed) * 1000) / 10 : null;
}

export function changeFor(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

/* ------------------------------------------------------------------ fleet health */

export type RuntimeStatus = 'online' | 'stopped' | 'errored' | 'unknown';

export type ServiceHealth = {
  service: Service;
  status: RuntimeStatus;
  uptime?: number;
  restarts?: number;
  cpu?: number;
  memory?: number;
};

export type FleetHealth = {
  entries: ServiceHealth[];
  online: number;
  stopped: number;
  errored: number;
  unknown: number;
  total: number;
};

/** Rolls the per-service PM2 status up into the counters shown on the dashboard. */
export function fleetHealth(services: Service[], pm2Status: Record<string, Pm2Status>): FleetHealth {
  const entries: ServiceHealth[] = services.map((service) => {
    const status = pm2Status[service.id];
    return {
      service,
      status: runtimeStatus(status?.status),
      uptime: status?.uptime,
      restarts: status?.restarts,
      cpu: status?.cpu,
      memory: status?.memory,
    };
  });
  return {
    entries,
    online: entries.filter((entry) => entry.status === 'online').length,
    stopped: entries.filter((entry) => entry.status === 'stopped').length,
    errored: entries.filter((entry) => entry.status === 'errored').length,
    unknown: entries.filter((entry) => entry.status === 'unknown').length,
    total: entries.length,
  };
}

function runtimeStatus(status: string | undefined): RuntimeStatus {
  const value = (status || '').toLowerCase();
  if (value === 'online' || value === 'running') return 'online';
  if (value === 'errored' || value === 'error' || value === 'crashed') return 'errored';
  if (value === 'stopped' || value === 'stopped ' || value === 'exited') return 'stopped';
  return 'unknown';
}

/* ------------------------------------------------------------------ log scanning */

/** Log lines that describe a failure — highlighted in the deployment log viewer. */
const ERROR_PATTERN = /\b(error|failed|failure|fatal|exception|panic|denied|refused|timeout|timed out|cannot|unable|not found|ENOENT|EACCES|SIGSEGV)\b/i;

export function isErrorLogLine(message: string): boolean {
  return ERROR_PATTERN.test(message);
}

/** Human summary of a PM2 uptime value (epoch ms). */
export function formatUptime(uptime?: number): string {
  if (!uptime || uptime <= 0) return '—';
  const seconds = Math.floor((Date.now() - uptime) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

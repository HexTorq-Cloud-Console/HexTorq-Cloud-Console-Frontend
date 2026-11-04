import type { Pm2LogEntry } from '../types/api';

// Pure display helpers: slugs, labels, and log parsing.
function toSlug(value: string) {
  return value.toLowerCase().trim().replace(/(?:\.git|[^a-z0-9]+)+$/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function liveRepositorySlug(value: string) {
  const match = value.match(/github\.com\/[^/]+\/([^/#?]+)/i);
  return toSlug(match?.[1] || value);
}

function serviceWebhookUrl(agentBaseUrl: string, projectKey: string) {
  if (!agentBaseUrl || !projectKey) return '';
  const pipelineBase = agentBaseUrl.replace(/\/git-agent\/?$/i, '/git').replace(/\/$/, '');
  return `${pipelineBase}/webhook/${encodeURIComponent(projectKey)}`;
}function parseLogEvent(payload: string): Pm2LogEntry | null {
  try {
    const event = JSON.parse(payload) as {
      type?: string;
      message?: string;
      timestamp?: string;
      stream?: string;
      live?: boolean;
    };
    if (event.type === 'connected') return null;
    if (event.type === 'error') return { message: `ERROR: ${event.message || payload}`, error: true };
    if (event.type === 'pm2-log') {
      return { message: event.message || '', stream: event.stream, timestamp: event.timestamp, live: event.live, error: event.stream === 'stderr' };
    }
    if (typeof event.message === 'string') return { message: event.message };
  } catch {
    // Plain-text log line.
  }
  return { message: payload };
}function intervalLabel(days: number | null | undefined) {
  if (!days) return 'No interval';
  if (days === 1) return 'Every day';
  if (days === 7) return 'Every week';
  if (days === 30) return 'Every 30 days (monthly)';
  return `Every ${days} days`;
}

function scheduleHourLabel(hour: number) {
  const suffix = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 || 12}:00 ${suffix}`;
}

function scheduleDateTimeLabel(value: string, timeZone: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone,
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(new Date(value));
  } catch {
    return new Date(value).toLocaleString();
  }
}

function healthStatusClass(status: string) {
  if (status === 'SUCCESS') return 'success';
  if (status === 'FAILED') return 'failed';
  if (status === 'RUNNING') return 'deploying';
  if (status === 'PARTIAL') return 'partial';
  return 'queued';
}

function healthStatusLabel(status: string) {
  if (status === 'RUNNING') return 'In progress';
  if (status === 'PARTIAL') return 'Partial';
  return status.charAt(0) + status.slice(1).toLowerCase();
}
export {
  toSlug,
  liveRepositorySlug,
  serviceWebhookUrl,
  parseLogEvent,
  intervalLabel,
  scheduleHourLabel,
  scheduleDateTimeLabel,
  healthStatusClass,
  healthStatusLabel,
};

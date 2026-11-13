'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import AdminPanel from './AdminPanel';
import AppShell from './AppShell';
import CommandPalette from './CommandPalette';
import Modal from './Modal';
import OverviewView from './OverviewView';
import ServiceDetailDrawer from './ServiceDetailDrawer';
import ServicesView from './ServicesView';
import DeploymentsView from './DeploymentsView';
import WebhookHealthView from './WebhookHealthView';
import AccessView from './AccessView';
import AlertsView from './AlertsView';
import WebhookHealthPanel from './WebhookHealthPanel';
import { ConsoleErrorState, ConsoleLoadingState } from './ConsoleStates';
import { apiUrl, errorMessage, responseJson, TOKEN_KEY } from '../lib/api';
import { clearConsoleCache, readConsoleCache, writeConsoleCache } from '../lib/consoleCache';
import { intervalLabel, parseLogEvent, scheduleHourLabel } from '../lib/format';
import { emptyAccessForm } from '../lib/forms';
import { isErrorLogLine, LIVE_INCIDENT_WINDOW_MS } from '../lib/metrics';
import { FAILURE_ALERTS_KEY, FOCUS_SERVICE_KEY, isAdminSection, type ConsoleSection } from '../lib/sections';
import { clearSessionCache } from '../lib/sessionCache';
import { addNotification, loadNotifications } from '../lib/notificationStore';
import type {
  AnalyticsData,
  ClientAccess,
  Deployment,
  DeploymentLog,
  FailureAlert,
  Incident,
  MetricRange,
  Pm2LogEntry,
  Pm2Status,
  Service,
  WebhookHealthData,
  WebhookHealthRun,
  WebhookSchedule,
} from '../types/api';
const LIVE_SEED_WINDOW_MS = 10 * 60 * 1000; // failures newer than this are shown on first load
const LIVE_DEPLOYMENT_POLL_MS = 15000;
const LIVE_SERVICE_POLL_MS = 30000;

function Dashboard({ token, role, email, section }: { token: string; role: string; email?: string; section: ConsoleSection }) {
  const [services, setServices] = useState<Service[]>(() => readConsoleCache(token)?.services ?? []);
  const [deployments, setDeployments] = useState<Deployment[]>(() => readConsoleCache(token)?.deployments ?? []);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(() => readConsoleCache(token)?.analytics ?? null);
  const [deploymentHasMore, setDeploymentHasMore] = useState(() => readConsoleCache(token)?.deploymentHasMore ?? false);
  const [deploymentNextCursor, setDeploymentNextCursor] = useState<string | null>(() => readConsoleCache(token)?.deploymentNextCursor ?? null);
  const [deploymentLoadingMore, setDeploymentLoadingMore] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [loading, setLoading] = useState(() => !readConsoleCache(token));
  const [error, setError] = useState('');
  const [deploying, setDeploying] = useState<string | null>(null);
  const [pm2Action, setPm2Action] = useState<string | null>(null);
  const [pm2Status, setPm2Status] = useState<Record<string, Pm2Status>>(() => readConsoleCache(token)?.pm2Status ?? {});
  const [pm2FetchedAt, setPm2FetchedAt] = useState<Record<string, string>>(() => readConsoleCache(token)?.pm2FetchedAt ?? {});
  const [selectedDeployment, setSelectedDeployment] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [pm2Confirm, setPm2Confirm] = useState<{ serviceId: string; action: string } | null>(null);
  const [forceDeployService, setForceDeployService] = useState<Service | null>(null);
  const [pm2LogFilter, setPm2LogFilter] = useState('');
  const [pm2LogPausedAt, setPm2LogPausedAt] = useState<number | null>(null);
  const [historyServiceId, setHistoryServiceId] = useState<string | null>(null);
  const [deploymentLogs, setDeploymentLogs] = useState<DeploymentLog[]>([]);
  const [deploymentLogFilter, setDeploymentLogFilter] = useState('');
  const [deploymentLogCopied, setDeploymentLogCopied] = useState<'all' | 'errors' | null>(null);
  const [range, setRange] = useState<MetricRange>('7d');
  const [deployMetrics, setDeployMetrics] = useState<AnalyticsData['summary'] | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [pm2LogService, setPm2LogService] = useState<Service | null>(null);
  const [pm2LogEntries, setPm2LogEntries] = useState<Pm2LogEntry[]>([]);
  const [pm2LogError, setPm2LogError] = useState('');
  const [pm2LogLoading, setPm2LogLoading] = useState(false);
  const [accessEntries, setAccessEntries] = useState<ClientAccess[]>(() => readConsoleCache(token)?.accessEntries ?? []);
  const [health, setHealth] = useState<WebhookHealthData | null>(() => readConsoleCache(token)?.health ?? null);
  const [healthLoading, setHealthLoading] = useState(() => !readConsoleCache(token)?.health);
  const [healthError, setHealthError] = useState('');
  const [healthSettingsOpen, setHealthSettingsOpen] = useState(false);
  const [healthForm, setHealthForm] = useState({ enabled: false, intervalDays: 7 });
  const [healthSaving, setHealthSaving] = useState(false);
  const [healthRunLoading, setHealthRunLoading] = useState(false);
  const [failureAlerts, setFailureAlerts] = useState<FailureAlert[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = window.sessionStorage.getItem(FAILURE_ALERTS_KEY);
      return stored ? (JSON.parse(stored) as FailureAlert[]) : [];
    } catch {
      return [];
    }
  });
  const pm2LogAbortRef = useRef<AbortController | null>(null);
  const healthRunStatusesRef = useRef<Record<string, string>>({});
  const pm2LogOutputRef = useRef<HTMLPreElement>(null);
  const deploymentLogOutputRef = useRef<HTMLPreElement>(null);
  const [pm2LogPinned, setPm2LogPinned] = useState(true);
  const [deploymentLogPinned, setDeploymentLogPinned] = useState(true);
  const seenIncidentDeployments = useRef<Set<string>>(new Set());
  const seenRuntimeStates = useRef<Map<string, string>>(new Map());
  const incidentBaselineReady = useRef(false);
  const servicesRef = useRef<Service[]>([]);
  const pm2StatusRef = useRef<Record<string, Pm2Status>>({});

  const loadDashboard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const accessRequest = role === 'CLIENT' ? fetch(`${apiUrl}/access`, { headers }) : Promise.resolve(null);
      const [serviceResponse, deploymentResponse, accessResponse] = await Promise.all([
        fetch(`${apiUrl}/services`, { headers }),
        fetch(`${apiUrl}/deployments?limit=100`, { headers }),
        accessRequest,
      ]);
      const serviceData = await responseJson<{ services?: Service[]; message?: string }>(serviceResponse);
      const deploymentData = await responseJson<{ deployments?: Deployment[]; message?: string; hasMore?: boolean; nextCursor?: string | null }>(deploymentResponse);
      const accessData = accessResponse
        ? await responseJson<{ access?: ClientAccess[]; message?: string }>(accessResponse)
        : {};
      if (!serviceResponse.ok) throw new Error(serviceData.message || 'Unable to load services');
      if (!deploymentResponse.ok) throw new Error(deploymentData.message || 'Unable to load deployments');
      setServices(serviceData.services || []);
      setDeployments(deploymentData.deployments || []);
      setDeploymentHasMore(Boolean(deploymentData.hasMore));
      setDeploymentNextCursor(deploymentData.nextCursor || null);
      setAccessEntries(accessResponse ? accessData.access || [] : []);
      setError(accessResponse && !accessResponse.ok ? accessData.message || 'Unable to load access credentials' : '');
    } catch (reason) {
      if (!silent) setError(errorMessage(reason, 'Unable to load console data'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [role, token]);

  // The metrics window drives which aggregate the backend returns: 14 days keeps a
  // comparison window for 7d, 30 days covers the long view, 2 days covers "today".
  useEffect(() => {
    let cancelled = false;
    const days = range === '30d' ? 30 : range === '24h' ? 2 : 14;
    const load = async () => {
      try {
        const response = await fetch(`${apiUrl}/analytics?days=${days}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;
        const data = await responseJson<AnalyticsData>(response);
        if (!cancelled) setAnalytics(data);
      } catch {
        // Keep the previous window — a failed metrics refresh must not blank the dashboard.
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [range, token]);

  /**
   * Live incident feed.
   *
   * Only problems that happen *now* are raised: a failed deployment, a PM2 process
   * that stops or starts erroring, an agent that goes offline — plus the recovery
   * events. The first pass only seeds failures from the last few minutes; anything
   * older is history (it stays in the Alerts view), not a live incident.
   */
  const trackIncidents = useCallback((
    deploymentList: Deployment[],
    serviceList: Service[],
    statusMap: Record<string, Pm2Status>,
  ) => {
    const now = Date.now();
    const created: Incident[] = [];

    for (const deployment of deploymentList) {
      if (deployment.status !== 'FAILED' && deployment.status !== 'ERROR') continue;
      if (seenIncidentDeployments.current.has(deployment.id)) continue;
      const at = deployment.completedAt || deployment.startedAt;
      const age = now - new Date(at).getTime();
      seenIncidentDeployments.current.add(deployment.id);
      // Before the feed is live, only very recent failures are worth surfacing.
      if (!incidentBaselineReady.current && age > LIVE_SEED_WINDOW_MS) continue;
      created.push({
        id: `deployment-${deployment.id}`,
        kind: 'deployment',
        severity: 'danger',
        title: `${deployment.service.name} deployment ${deployment.status === 'ERROR' ? 'errored' : 'failed'}`,
        detail: deployment.failureReason || 'The deployment pipeline reported a failure.',
        at,
        deploymentId: deployment.id,
        serviceId: deployment.service.id,
      });
    }

    for (const service of serviceList) {
      if (service.type !== 'PM2') continue;
      const status = statusMap[service.id]?.status?.toLowerCase();
      if (!status) continue;
      const previous = seenRuntimeStates.current.get(service.id);
      if (previous === undefined) {
        seenRuntimeStates.current.set(service.id, status);
        continue;
      }
      if (previous === status) continue;
      seenRuntimeStates.current.set(service.id, status);
      const at = new Date(now).toISOString();
      const process = service.pm2ProcessName || service.name;
      if (status === 'stopped' || status === 'errored') {
        created.push({
          id: `service-${service.id}-${status}-${now}`,
          kind: 'service',
          severity: status === 'errored' ? 'danger' : 'warning',
          title: `${service.name} is ${status}`,
          detail: `The PM2 process ${process} is ${status}.`,
          at,
          serviceId: service.id,
        });
      } else if (previous === 'stopped' || previous === 'errored') {
        created.push({
          id: `service-${service.id}-recovered-${now}`,
          kind: 'service',
          severity: 'success',
          title: `${service.name} is running again`,
          detail: `The PM2 process ${process} recovered.`,
          at,
          serviceId: service.id,
        });
      }
    }

    for (const service of serviceList) {
      const agent = service.agent;
      if (!agent?.id) continue;
      const key = `agent-${agent.id}`;
      const status = agent.status || 'unknown';
      const previous = seenRuntimeStates.current.get(key);
      if (previous === undefined) {
        seenRuntimeStates.current.set(key, status);
        continue;
      }
      if (previous === status) continue;
      seenRuntimeStates.current.set(key, status);
      const at = new Date(now).toISOString();
      if (status === 'offline') {
        created.push({
          id: `${key}-offline-${now}`,
          kind: 'agent',
          severity: 'danger',
          title: `${agent.name} is offline`,
          detail: 'The agent stopped reporting to the control plane.',
          at,
        });
      } else if (previous === 'offline') {
        created.push({
          id: `${key}-online-${now}`,
          kind: 'agent',
          severity: 'success',
          title: `${agent.name} is back online`,
          detail: 'The agent resumed reporting to the control plane.',
          at,
        });
      }
    }

    if (created.length) {
      setIncidents((current) => {
        const known = new Set(current.map((incident) => incident.id));
        const fresh = created.filter((incident) => !known.has(incident.id)).reverse();
        return [...fresh, ...current].slice(0, 30);
      });
    }
    incidentBaselineReady.current = true;
  }, []);

  const loadMoreDeployments = useCallback(async () => {    if (!deploymentNextCursor || deploymentLoadingMore) return;
    setDeploymentLoadingMore(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const response = await fetch(`${apiUrl}/deployments?limit=100&cursor=${encodeURIComponent(deploymentNextCursor)}`, { headers });
      const data = await responseJson<{ deployments?: Deployment[]; message?: string; hasMore?: boolean; nextCursor?: string | null }>(response);
      if (!response.ok) throw new Error(data.message || 'Unable to load more deployments');
      const existingIds = new Set(deployments.map((deployment) => deployment.id));
      const appended = (data.deployments || []).filter((deployment) => !existingIds.has(deployment.id));
      setDeployments((current) => [...current, ...appended]);
      setDeploymentHasMore(Boolean(data.hasMore));
      setDeploymentNextCursor(data.nextCursor || null);
    } catch {
      // Keep the already-loaded history; a failed background load must not
      // replace the current deployment list with an error screen.
    } finally {
      setDeploymentLoadingMore(false);
    }
  }, [deploymentNextCursor, deploymentLoadingMore, deployments, token]);

  useEffect(() => {
    function onPaletteKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((current) => !current);
      }
    }
    window.addEventListener('keydown', onPaletteKey);
    return () => window.removeEventListener('keydown', onPaletteKey);
  }, []);

  const seenStatusRef = useRef<Map<string, string> | null>(null);
  useEffect(() => {
    loadNotifications(email || role);
  }, [email, role]);
  useEffect(() => {
    if (loading) return;
    const seen = seenStatusRef.current;
    const next = new Map(deployments.map((deployment) => [deployment.id, deployment.status] as const));
    seenStatusRef.current = next;
    if (!seen) return;
    for (const deployment of deployments) {
      const previous = seen.get(deployment.id);
      if (previous === deployment.status) continue;
      const name = deployment.service?.name || 'Service';
      const status = deployment.status.toUpperCase();
      const url = '/deployments?deployment=' + deployment.id;
      if (status === 'SUCCESS') {
        addNotification({ id: deployment.id + ':SUCCESS', kind: 'success', title: name + ' deployed', body: deployment.commitMessage || 'Deployment completed successfully.', url });
      } else if (status === 'FAILED' || status === 'ERROR') {
        addNotification({ id: deployment.id + ':FAILED', kind: 'failed', title: name + ' deployment failed', body: deployment.failureReason || 'Deployment failed.', url });
      } else if (previous === undefined && (status === 'RUNNING' || status === 'QUEUED' || status === 'PENDING')) {
        addNotification({ id: deployment.id + ':STARTED', kind: 'running', title: name + ' deployment started', body: deployment.commitMessage || 'Deployment is in progress.', url });
      }
    }
  }, [deployments, loading]);

  function addFailureAlert(alert: FailureAlert) {
    setFailureAlerts((current) => current.some((item) => item.id === alert.id) ? current : [alert, ...current].slice(0, 10));
  }

  function deploymentLogLines(): string[] {
    return deploymentLogs.map((log) => `[${new Date(log.timestamp).toLocaleString()}] ${log.message}`);
  }

  async function copyDeploymentLogs(errorsOnly = false) {
    const all = deploymentLogLines();
    const lines = errorsOnly ? all.filter((line) => isErrorLogLine(line)) : all;
    if (!lines.length) return;
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setDeploymentLogCopied(errorsOnly ? 'errors' : 'all');
      window.setTimeout(() => setDeploymentLogCopied(null), 2000);
    } catch {
      // Clipboard blocked (insecure context or denied permission) — leave the log visible.
    }
  }

  async function deploymentFailureLogs(deploymentId: string | undefined) {    if (!deploymentId) return '';
    try {
      const response = await fetch(`${apiUrl}/deployments/${deploymentId}/logs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return '';
      const data = await responseJson<{ logs?: DeploymentLog[] }>(response);
      return (data.logs || []).map((log) => `[${new Date(log.timestamp).toLocaleString()}] ${log.message}`).join('\n');
    } catch {
      return '';
    }
  }

  async function alertHealthRunFailure(run: WebhookHealthRun) {
    const failedChecks = run.checks.filter((check) => check.status === 'FAILED');
    const sections = await Promise.all(failedChecks.map(async (check) => {
      const deploymentLogs = await deploymentFailureLogs(check.deployment?.id);
      return [
        `Service: ${check.service.name}`,
        `Time: ${new Date(check.completedAt || check.startedAt || run.completedAt || run.startedAt).toLocaleString()}`,
        `Webhook HTTP status: ${check.httpStatus ?? 'not received'}`,
        `Webhook error: ${check.message || 'Webhook check failed'}`,
        deploymentLogs ? `Full deployment log:\n${deploymentLogs}` : 'Full deployment log: unavailable (webhook was rejected before deployment started)',
      ].join('\n');
    }));
    addFailureAlert({
      id: `health-${run.id}`,
      title: `${run.source === 'MANUAL' ? 'Manual' : 'Scheduled'} webhook test failed (${run.failedServices} service${run.failedServices === 1 ? '' : 's'})`,
      timestamp: run.completedAt || new Date().toISOString(),
      details: sections.join('\n\n'),
    });
  }

  const loadHealth = useCallback(async (silent = false) => {
    if (role !== 'CLIENT') return;
    if (!silent) setHealthLoading(true);
    try {
      const response = await fetch(`${apiUrl}/webhook-health`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await responseJson<WebhookHealthData & { message?: string }>(response);
      if (!response.ok || !data.schedule) throw new Error(data.message || 'Unable to load webhook health');
      setHealth(data);
      const latestRun = data.latestRun;
      if (latestRun) {
        const previousStatus = healthRunStatusesRef.current[latestRun.id];
        healthRunStatusesRef.current[latestRun.id] = latestRun.status;
        if (previousStatus === 'RUNNING' && (latestRun.status === 'FAILED' || latestRun.status === 'PARTIAL')) {
          void alertHealthRunFailure(latestRun);
        }
      }
      setHealthError('');
    } catch (reason) {
      setHealthError(errorMessage(reason, 'Unable to load webhook health'));
    } finally {
      if (!silent) setHealthLoading(false);
    }
  }, [role, token]);

  useEffect(() => {
    if (section === 'admin') return;
    void loadDashboard(Boolean(readConsoleCache(token)));
  }, [loadDashboard, section, token]);

  useEffect(() => {
    if (section !== 'services' || services.length === 0) return;
    const focusId = window.sessionStorage.getItem(FOCUS_SERVICE_KEY);
    if (!focusId) return;
    window.sessionStorage.removeItem(FOCUS_SERVICE_KEY);
    const match = services.find((service) => service.id === focusId);
    if (match) setSelectedService(match);
  }, [section, services]);

  // Deep link from a browser notification: /deployments?deployment=<id> opens
  // the full deployment record once the history has loaded.
  useEffect(() => {
    if (section !== 'deployments' || deployments.length === 0) return;
    const requested = new URLSearchParams(window.location.search).get('deployment');
    if (!requested) return;
    if (!deployments.some((deployment) => deployment.id === requested)) return;
    setSelectedDeployment(requested);
    const url = new URL(window.location.href);
    url.searchParams.delete('deployment');
    window.history.replaceState({}, '', url.toString());
  }, [deployments, section]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(FAILURE_ALERTS_KEY, JSON.stringify(failureAlerts));
    } catch {
      // Alerts still work in memory when session storage is unavailable.
    }
  }, [failureAlerts]);

  useEffect(() => {
    void loadHealth(Boolean(readConsoleCache(token)?.health));
  }, [loadHealth, token]);

  useEffect(() => {
    writeConsoleCache({
      token,
      services,
      deployments,
      analytics,
      deploymentHasMore,
      deploymentNextCursor,
      accessEntries,
      health,
      pm2Status,
      pm2FetchedAt,
    });
  }, [accessEntries, analytics, deploymentHasMore, deploymentNextCursor, deployments, health, pm2FetchedAt, pm2Status, services, token]);

  useEffect(() => {
    if (role !== 'CLIENT') return;
    const timer = window.setInterval(() => {
      void loadHealth(true);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [loadHealth, role]);

  // The live polls read the latest services/status through refs so their timers are not
  // restarted every time the runtime status refreshes.
  useEffect(() => {
    servicesRef.current = services;
  }, [services]);

  useEffect(() => {
    pm2StatusRef.current = pm2Status;
  }, [pm2Status]);

  // The deployment metrics are aggregated by the server over the full 30 day window,
  // so the numbers are not limited to the 100 records loaded into the browser.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(`${apiUrl}/analytics?days=30`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;
        const data = await responseJson<AnalyticsData>(response);
        if (!cancelled && data.summary) setDeployMetrics(data.summary);
      } catch {
        // Keep the previous aggregate.
      }
    };
    void load();
    const timer = window.setInterval(() => { void load(); }, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [token]);

  /**
   * Live polling: new deployments are merged in as they finish, so a failure that
   * happens while the client is on the console raises an incident immediately.
   */
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const response = await fetch(`${apiUrl}/deployments?limit=50`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;
        const data = await responseJson<{ deployments?: Deployment[] }>(response);
        if (cancelled || !data.deployments) return;
        setDeployments((current) => {
          const known = new Set(current.map((deployment) => deployment.id));
          const fresh = data.deployments!.filter((deployment) => !known.has(deployment.id));
          return fresh.length ? [...fresh, ...current].slice(0, 300) : current;
        });
        trackIncidents(data.deployments, servicesRef.current, pm2StatusRef.current);
      } catch {
        // A failed poll must never interrupt the console.
      }
    };
    void poll();
    const timer = window.setInterval(() => { void poll(); }, LIVE_DEPLOYMENT_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [token, trackIncidents]);

  // Agents heartbeat every 30s — refresh the service list at the same pace so an
  // agent going offline is noticed.
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const response = await fetch(`${apiUrl}/services`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;
        const data = await responseJson<{ services?: Service[] }>(response);
        if (cancelled || !data.services) return;
        setServices(data.services);
        trackIncidents([], data.services, pm2StatusRef.current);
      } catch {
        // Ignore transient failures.
      }
    };
    const timer = window.setInterval(() => { void poll(); }, LIVE_SERVICE_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [token, trackIncidents]);

  // Keep the live feed short: incidents older than the window drop out.
  useEffect(() => {
    const timer = window.setInterval(() => {
      setIncidents((current) => {
        const now = Date.now();
        return current.filter((incident) => now - new Date(incident.at).getTime() < LIVE_INCIDENT_WINDOW_MS);
      });
    }, 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadPm2Statuses = async () => {
      const collected: Record<string, Pm2Status> = {};
      await Promise.all(services
        .filter((service) => service.type === 'PM2')
        .map(async (service) => {
          try {
            const response = await fetch(`${apiUrl}/services/${service.id}/pm2/status`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (!response.ok) return;
            const data = await responseJson<Pm2Status>(response);
            collected[service.id] = data;
            if (!cancelled) {
              setPm2Status((current) => ({ ...current, [service.id]: data }));
              setPm2FetchedAt((current) => ({ ...current, [service.id]: new Date().toISOString() }));
            }
          } catch {
            // Status is supplementary; the service card still works without it.
          }
        }));
      if (!cancelled) trackIncidents([], services, collected);
    };
    void loadPm2Statuses();
    const timer = window.setInterval(() => { void loadPm2Statuses(); }, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [services, token, trackIncidents]);

  /**
   * Terminal behaviour for both log viewers: the newest line stays in view, and the
   * user can scroll up to read history without being yanked back down.
   */
  useEffect(() => {
    const node = pm2LogOutputRef.current;
    if (!node || !pm2LogPinned) return;
    node.scrollTop = node.scrollHeight;
  }, [pm2LogEntries, pm2LogPinned]);

  useEffect(() => {
    const node = deploymentLogOutputRef.current;
    if (!node || !deploymentLogPinned) return;
    node.scrollTop = node.scrollHeight;
  }, [deploymentLogs, deploymentLogPinned]);

  function trackLogPinned(node: HTMLElement | null, setPinned: (value: boolean) => void) {
    if (!node) return;
    const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
    setPinned(distance < 48);
  }

  useEffect(() => {
    if (!selectedDeployment) {
      setDeploymentLogs([]);
      setDeploymentLogFilter('');
      return;
    }
    let active = true;
    const load = async () => {
      try {
        const response = await fetch(`${apiUrl}/deployments/${selectedDeployment}/logs`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;
        const data = await responseJson<{ logs?: DeploymentLog[] }>(response);
        if (active) setDeploymentLogs(data.logs || []);
      } catch {
        // Keep the last successful log snapshot if polling fails temporarily.
      }
    };
    void load();
    const timer = window.setInterval(load, 2000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [selectedDeployment, token]);

  useEffect(
    () => () => {
      pm2LogAbortRef.current?.abort();
    },
    [],
  );

  function signOut() {
    clearSessionCache();
    clearConsoleCache();
    window.localStorage.removeItem(TOKEN_KEY);
    window.sessionStorage.removeItem(FAILURE_ALERTS_KEY);
    window.location.reload();
  }

  async function deploy(serviceId: string, force = false) {
    setDeploying(serviceId);
    setError('');
    try {
      const response = await fetch(`${apiUrl}/services/${serviceId}/deploy`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      });
      const data = await responseJson<{ runId?: string; message?: string; upstreamStatus?: number; upstreamBody?: string }>(response);
      if (!response.ok) {
        addFailureAlert({
          id: `manual-webhook-${serviceId}-${Date.now()}`,
          title: `Manual webhook trigger failed for ${services.find((service) => service.id === serviceId)?.name || 'service'}`,
          timestamp: new Date().toISOString(),
          details: [`Webhook HTTP status: ${data.upstreamStatus ?? response.status}`, `Error: ${data.message || 'Webhook trigger failed'}`, data.upstreamBody ? `Full webhook response:\n${data.upstreamBody}` : ''].filter(Boolean).join('\n'),
        });
        throw new Error(data.message || 'Webhook trigger failed');
      }
      await loadDashboard(true);

      if (data.runId) {
        let finishedDeployment: Deployment | undefined;
        for (let attempt = 0; attempt < 60; attempt += 1) {
          const deploymentResponse = await fetch(`${apiUrl}/deployments`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (deploymentResponse.ok) {
            const deploymentData = await responseJson<{ deployments?: Deployment[] }>(deploymentResponse);
            const currentDeployments = deploymentData.deployments || [];
            setDeployments(currentDeployments);
            const deployment = currentDeployments.find((item) => item.runId === data.runId);
            if (deployment) {
              setSelectedDeployment(deployment.id);
              finishedDeployment = deployment.status === 'DEPLOYING' ? undefined : deployment;
              if (finishedDeployment) break;
            }
          }
          await new Promise((resolve) => window.setTimeout(resolve, 500));
        }
        if (finishedDeployment && (finishedDeployment.status === 'FAILED' || finishedDeployment.status === 'ERROR')) {
          const logs = await deploymentFailureLogs(finishedDeployment.id);
          addFailureAlert({
            id: `deployment-${finishedDeployment.id}`,
            title: `Manual deployment failed for ${finishedDeployment.service.name}`,
            timestamp: finishedDeployment.completedAt || new Date().toISOString(),
            details: [
              `Time: ${new Date(finishedDeployment.completedAt || finishedDeployment.startedAt).toLocaleString()}`,
              `Status: ${finishedDeployment.status}`,
              logs || 'No deployment log was recorded.',
            ].join('\n'),
          });
        }
      }
    } catch (reason) {
      setError(errorMessage(reason, 'Webhook trigger failed'));
    } finally {
      setDeploying(null);
    }
  }

  function openHealthSettings() {
    setHealthError('');
    setHealthForm({
      enabled: health?.schedule.enabled ?? false,
      intervalDays: health?.schedule.intervalDays ?? 7,
    });
    setHealthSettingsOpen(true);
  }

  async function saveHealthSchedule(event: FormEvent) {
    event.preventDefault();
    setHealthSaving(true);
    setHealthError('');
    try {
      const response = await fetch(`${apiUrl}/webhook-health/schedule`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(healthForm),
      });
      const data = await responseJson<{ schedule?: WebhookSchedule; message?: string }>(response);
      if (!response.ok || !data.schedule) throw new Error(data.message || 'Unable to save webhook schedule');
      setHealth((current) => current ? { ...current, schedule: data.schedule as WebhookSchedule } : current);
      setHealthSettingsOpen(false);
      await loadHealth(true);
    } catch (reason) {
      setHealthError(errorMessage(reason, 'Unable to save webhook schedule'));
    } finally {
      setHealthSaving(false);
    }
  }

  async function runWebhookHealth() {
    setHealthRunLoading(true);
    setHealthError('');
    try {
      const response = await fetch(`${apiUrl}/webhook-health/run`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await responseJson<{ run?: WebhookHealthRun; message?: string }>(response);
      if (!response.ok) throw new Error(data.message || 'Unable to start webhook health check');
      if (data.run) healthRunStatusesRef.current[data.run.id] = data.run.status;
      await loadHealth(true);
    } catch (reason) {
      setHealthError(errorMessage(reason, 'Unable to start webhook health check'));
    } finally {
      setHealthRunLoading(false);
    }
  }

  async function controlPm2(serviceId: string, action: string) {
    setPm2Action(`${serviceId}:${action}`);
    setError('');
    try {
      const response = await fetch(`${apiUrl}/services/${serviceId}/pm2/${action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await responseJson<{ message?: string }>(response);
      if (!response.ok) throw new Error(data.message || 'PM2 action failed');
      const statusResponse = await fetch(`${apiUrl}/services/${serviceId}/pm2/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (statusResponse.ok) {
        const status = await responseJson<Pm2Status>(statusResponse);
        setPm2Status((current) => ({ ...current, [serviceId]: status }));
      }
    } catch (reason) {
      setError(errorMessage(reason, 'PM2 action failed'));
    } finally {
      setPm2Action(null);
    }
  }

  function closePm2Logs() {
    pm2LogAbortRef.current?.abort();
    pm2LogAbortRef.current = null;
    setPm2LogService(null);
    setPm2LogEntries([]);
    setPm2LogError('');
    setPm2LogLoading(false);
    setPm2LogFilter('');
    setPm2LogPausedAt(null);
  }

  async function openPm2Logs(service: Service) {
    pm2LogAbortRef.current?.abort();
    const controller = new AbortController();
    pm2LogAbortRef.current = controller;
    setPm2LogService(service);
    setPm2LogEntries([]);
    setPm2LogError('');
    setPm2LogLoading(true);
    setPm2LogFilter('');
    setPm2LogPausedAt(null);

    try {
      const response = await fetch(`${apiUrl}/services/${service.id}/pm2/logs/stream?lines=200`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
        signal: controller.signal,
      });
      if (!response.ok) {
        const data = await responseJson<{ message?: string }>(response);
        throw new Error(data.message || 'Unable to open PM2 logs');
      }
      if (!response.body) throw new Error('The PM2 log stream returned no data');

      setPm2LogLoading(false);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const append = (chunk: string, flush = false) => {
        buffer += chunk;
        const lines = buffer.split(/\r?\n/);
        buffer = flush ? '' : lines.pop() || '';
        const entries = lines
          .filter((line) => line && !line.startsWith(':') && !line.startsWith('event:') && !line.startsWith('id:') && !line.startsWith('retry:'))
          .map((line) => parseLogEvent(line.startsWith('data:') ? line.slice(5).replace(/^ /, '') : line))
          .filter((entry): entry is Pm2LogEntry => Boolean(entry));
        // Terminal order: oldest first, newest last — the view stays anchored to the bottom.
        if (entries.length) setPm2LogEntries((current) => [...current, ...entries].slice(-500));
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        append(decoder.decode(value, { stream: true }));
      }
      append(decoder.decode(), true);
    } catch (reason) {
      if (controller.signal.aborted) return;
      setPm2LogError(errorMessage(reason, 'Unable to open PM2 logs'));
    } finally {
      if (pm2LogAbortRef.current === controller) setPm2LogLoading(false);
    }
  }

  function requestPm2Action(serviceId: string, action: string) {
    setPm2Confirm({ serviceId, action });
  }

  function requestForceDeploy(serviceId: string) {
    setForceDeployService(services.find((service) => service.id === serviceId) || null);
  }

  function onCloseServiceDetails() {
    setSelectedService(null);
  }

  const selectedDeploymentRecord = deployments.find((deployment) => deployment.id === selectedDeployment);
  const visibleDeploymentLogs = deploymentLogFilter
    ? deploymentLogs.filter((log) => log.message.toLowerCase().includes(deploymentLogFilter.toLowerCase()))
    : deploymentLogs;

  return (
      <AppShell role={role} email={email} alertCount={failureAlerts.length} onSignOut={signOut} onOpenPalette={() => setPaletteOpen(true)}>
      {isAdminSection(section) && role === 'SUPER_ADMIN' && <AdminPanel token={token} section={section} onChanged={loadDashboard} />}

      {!isAdminSection(section) && (loading ? <ConsoleLoadingState /> : error ? <ConsoleErrorState message={error} onRetry={() => void loadDashboard()} /> : <>
      {section === 'overview' && <OverviewView
        services={services}
        deployments={deployments}
        pm2Status={pm2Status}
        health={health}
        healthLoading={healthLoading}
        healthError={healthError}
        healthRunLoading={healthRunLoading}
        analytics={analytics}
        email={email}
        role={role}
        range={range}
        onRangeChange={setRange}
        incidents={incidents}
        failureAlerts={failureAlerts}
        onDeploy={deploy}
        onForceDeploy={requestForceDeploy}
        deploying={deploying}
        onHealthSettings={openHealthSettings}
        onRunHealth={runWebhookHealth}
        onDeployment={setSelectedDeployment}
      />}

      {section === 'services' && <ServicesView
        services={services}
        deployments={deployments}
        pm2Status={pm2Status}
        deploying={deploying}
        pm2Action={pm2Action}
        onDeploy={deploy}
        onForceDeploy={requestForceDeploy}
        onPm2={requestPm2Action}
        onLogs={openPm2Logs}
        onDetails={setSelectedService}
      />}

      {section === 'deployments' && <DeploymentsView deployments={deployments} services={services} metrics={deployMetrics} hasMore={deploymentHasMore} loadingMore={deploymentLoadingMore} onLoadMore={() => void loadMoreDeployments()} onOpen={setSelectedDeployment} />}

      {section === 'health' && role === 'CLIENT' && <WebhookHealthView health={health} loading={healthLoading} error={healthError} runLoading={healthRunLoading} onSettings={openHealthSettings} onRun={runWebhookHealth} />}

      {section === 'access' && role === 'CLIENT' && <AccessView entries={accessEntries} token={token} />}
      {section === 'alerts' && role === 'CLIENT' && <AlertsView alerts={failureAlerts} onDismiss={(id) => setFailureAlerts((current) => current.filter((alert) => alert.id !== id))} onDismissAll={() => setFailureAlerts([])} />}
      </>)}

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} role={role} services={services} />

      {pm2Confirm && (() => {
        const service = services.find((item) => item.id === pm2Confirm.serviceId);
        if (!service) return null;
        return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPm2Confirm(null); }}>
          <section className="confirm-card" role="dialog" aria-modal="true" aria-labelledby="pm2-confirm-title">
            <div className="confirm-card__icon">↻</div>
            <p className="confirm-card__eyebrow">PM2 INSTANCE ACTION</p>
            <h2 id="pm2-confirm-title">{pm2Confirm.action.charAt(0).toUpperCase() + pm2Confirm.action.slice(1)} {service.pm2ProcessName || service.name}?</h2>
            <p>This will send the {pm2Confirm.action} action to the selected PM2 process.</p>
            <div className="confirm-card__actions"><button className="ht-btn ht-btn--ghost" type="button" onClick={() => setPm2Confirm(null)}>Cancel</button><button className="ht-btn ht-btn--primary" type="button" onClick={() => { const current = pm2Confirm; setPm2Confirm(null); void controlPm2(current.serviceId, current.action); }}>{pm2Confirm.action.charAt(0).toUpperCase() + pm2Confirm.action.slice(1)} process</button></div>
          </section>
        </div>;
      })()}

      {forceDeployService && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setForceDeployService(null); }}>
        <section className="confirm-card confirm-card--warning" role="dialog" aria-modal="true" aria-labelledby="force-confirm-title">
          <div className="confirm-card__icon confirm-card__icon--warning">⚡</div>
          <p className="confirm-card__eyebrow">PIPELINE OVERRIDE</p>
          <h2 id="force-confirm-title">Force deploy {forceDeployService.name}?</h2>
          <p>This runs the full deployment pipeline even if no application files or Git commits changed since the last release.</p>
          <div className="confirm-card__warning">⚠ Force deployment may restart the service.</div>
          <div className="confirm-card__actions"><button className="ht-btn ht-btn--ghost" type="button" onClick={() => setForceDeployService(null)}>Cancel</button><button className="ht-btn ht-btn--primary" type="button" onClick={() => { const service = forceDeployService; setForceDeployService(null); void deploy(service.id, true); }}>⚡ Force deploy</button></div>
        </section>
      </div>}

      {selectedService && (
        <ServiceDetailDrawer
          service={selectedService}
          deployments={deployments}
          pm2Status={pm2Status[selectedService.id]}
          pm2FetchedAt={pm2FetchedAt[selectedService.id] || null}
          deploying={deploying === selectedService.id}
          onDeploy={(serviceId) => { onCloseServiceDetails(); void deploy(serviceId); }}
          onForceDeploy={(serviceId) => { onCloseServiceDetails(); requestForceDeploy(serviceId); }}
          onLogs={(service) => { onCloseServiceDetails(); void openPm2Logs(service); }}
          onDeployment={setSelectedDeployment}
          onClose={onCloseServiceDetails}
        />
      )}
      {selectedDeploymentRecord && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedDeployment(null);
          }}
        >
          <section className="modal-card deployment-modal" role="dialog" aria-modal="true" aria-label={`Deployment details for ${selectedDeploymentRecord.service.name}`}>
            <button className="modal-close" aria-label="Close" onClick={() => setSelectedDeployment(null)}>x</button>
            <p className="eyebrow">DEPLOYMENT DETAILS</p>
            <h2>{selectedDeploymentRecord.service.name}</h2>
            <div className="deployment-metadata">
              <div><span>Status</span><strong className={`badge ${selectedDeploymentRecord.status.toLowerCase()}`}>{selectedDeploymentRecord.status}</strong></div>
              <div><span>Trigger</span><strong>{selectedDeploymentRecord.triggerSource}</strong></div>
              <div><span>Started</span><strong>{new Date(selectedDeploymentRecord.startedAt).toLocaleString()}</strong></div>
              <div><span>Completed</span><strong>{selectedDeploymentRecord.completedAt ? new Date(selectedDeploymentRecord.completedAt).toLocaleString() : 'Running'}</strong></div>
              <div><span>Duration</span><strong>{selectedDeploymentRecord.durationMs ? `${Math.round(selectedDeploymentRecord.durationMs / 1000)}s` : 'Running'}</strong></div>
              <div><span>Branch</span><strong>{selectedDeploymentRecord.branch || 'Not reported'}</strong></div>
              <div><span>Commit</span><strong>{selectedDeploymentRecord.commitHash || 'Not reported'}</strong></div>
              <div><span>Commit message</span><strong>{selectedDeploymentRecord.commitMessage || 'Message not reported'}</strong></div>
              <div><span>Run ID</span><code>{selectedDeploymentRecord.runId}</code></div>
            </div>
            {selectedDeploymentRecord.failureReason && (
              <div className="deployment-failure-reason">
                <strong>Failure reason</strong>
                <p>{selectedDeploymentRecord.failureReason}</p>
              </div>
            )}
            <div className="detail-header deployment-log-heading">
              <h3>Full deployment log</h3>
              <span className="muted">{deploymentLogs.length} log entries</span>
            </div>
            <div className="deployment-log-toolbar">
              <label className="deployment-log-search">
                ⌕<input
                  value={deploymentLogFilter}
                  onChange={(event) => setDeploymentLogFilter(event.target.value)}
                  placeholder="Filter log lines…"
                  aria-label="Filter log lines"
                />
              </label>
              <button type="button" onClick={() => void copyDeploymentLogs(false)}>
                {deploymentLogCopied === 'all' ? '✓ Copied' : '▣ Copy logs'}
              </button>
              <button type="button" onClick={() => void copyDeploymentLogs(true)}>
                {deploymentLogCopied === 'errors' ? '✓ Copied' : '⚠ Copy errors'}
              </button>
            </div>
            <div className="deployment-log-output-wrap">
              <pre className="deployment-detail-log" ref={deploymentLogOutputRef} onScroll={(event) => trackLogPinned(event.currentTarget, setDeploymentLogPinned)}>
                {visibleDeploymentLogs.length
                  ? visibleDeploymentLogs.map((log, index) => (
                      <span
                        key={`${log.timestamp}-${index}`}
                        className={`deployment-log-line${isErrorLogLine(log.message) ? ' is-error' : ''}`}
                      >{`[${new Date(log.timestamp).toLocaleString()}] ${log.message}`}</span>
                    ))
                  : deploymentLogs.length
                    ? 'No log lines match the filter.'
                    : 'Waiting for deployment logs.'}
              </pre>
              {!deploymentLogPinned && (
                <button
                  type="button"
                  className="log-latest-button"
                  onClick={() => {
                    const node = deploymentLogOutputRef.current;
                    if (!node) return;
                    node.scrollTop = node.scrollHeight;
                    setDeploymentLogPinned(true);
                  }}
                >
                  ↓ Latest logs
                </button>
              )}
            </div>
            <div className="modal-actions">
              <button className="secondary" onClick={() => setSelectedDeployment(null)}>Close</button>
            </div>
          </section>
        </div>
      )}

      {pm2LogService && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closePm2Logs();
          }}
        >
          <section className="modal-card pm2-log-card" role="dialog" aria-modal="true" aria-label={`PM2 logs for ${pm2LogService.name}`}>
            <button className="modal-close" aria-label="Close" onClick={closePm2Logs}>
              x
            </button>
            <p className="eyebrow">LIVE PM2 LOGS</p>
            <h2>{pm2LogService.name}</h2>
            <p className="modal-subtitle">
              Process {pm2LogService.pm2ProcessName} on {pm2LogService.agent.name}
            </p>
            {pm2LogError && <p className="error">{pm2LogError}</p>}
            <div className="pm2-log-toolbar">
              <span className="pm2-live-pill"><span className="ht-dot ht-dot--live" /> {pm2LogLoading ? 'CONNECTING' : 'STREAMING'}</span>
              <span className="pm2-log-count">Last {pm2LogEntries.length}</span>
              <button type="button" onClick={() => setPm2LogPausedAt((current) => current === null ? pm2LogEntries.length : null)}>{pm2LogPausedAt === null ? 'Ⅱ Pause' : '▶ Resume'}</button>
              <button type="button" onClick={() => setPm2LogEntries([])}>⌫ Clear</button>
              <label className="pm2-log-search">⌕<input value={pm2LogFilter} onChange={(event) => setPm2LogFilter(event.target.value)} placeholder="Filter logs…" aria-label="Filter logs" /></label>
              <button type="button" onClick={() => { const text = pm2LogEntries.map((entry) => entry.message).join('\n'); void navigator.clipboard?.writeText(text); }}>▣ Copy</button>
            </div>
            <div className="pm2-log-output-wrap">
              <pre className="pm2-log-output" ref={pm2LogOutputRef} onScroll={(event) => trackLogPinned(event.currentTarget, setPm2LogPinned)}>
                {pm2LogEntries.length ? pm2LogEntries.slice(0, pm2LogPausedAt ?? pm2LogEntries.length).filter((entry) => !pm2LogFilter || entry.message.toLowerCase().includes(pm2LogFilter.toLowerCase())).map((entry, index) => (
                  <span className={`pm2-log-line${entry.error ? ' error' : ''}`} key={`${index}-${entry.message}`}>
                    <span className="pm2-line-number">{String(index + 1).padStart(3, '0')}</span>
                    <span className="pm2-line-time">{entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : '—'}</span>
                    <span className={`pm2-line-stream pm2-line-stream--${entry.stream || 'stdout'}`}>{entry.error ? 'stderr' : entry.stream || 'stdout'}</span>
                    {entry.error ? 'ERR ' : ''}{entry.message}
                  </span>
                )) : (pm2LogLoading ? 'Connecting to log stream...' : 'Waiting for log output...')}
              </pre>
              {!pm2LogPinned && (
                <button
                  type="button"
                  className="log-latest-button"
                  onClick={() => {
                    const node = pm2LogOutputRef.current;
                    if (!node) return;
                    node.scrollTop = node.scrollHeight;
                    setPm2LogPinned(true);
                  }}
                >
                  ↓ Latest logs
                </button>
              )}
            </div>
            <div className="pm2-log-footer"><span><span className="ht-dot" /> Connected · stream closes when this window closes</span></div>
            <div className="modal-actions">
              <button className="secondary" onClick={closePm2Logs}>
                Close
              </button>
            </div>
          </section>
        </div>
      )}

      <Modal
        open={healthSettingsOpen}
        className="health-schedule-modal"
        title="Webhook health settings"
        subtitle="Run every enabled service webhook on a recurring schedule."
        onClose={() => setHealthSettingsOpen(false)}
      >
        <form className="modal-form" onSubmit={saveHealthSchedule}>
          <label>
            Automatic checks
            <select
              value={healthForm.enabled ? 'true' : 'false'}
              onChange={(event) => setHealthForm({ ...healthForm, enabled: event.target.value === 'true' })}
            >
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>
          </label>
          <label>
            Interval
            <select
              value={healthForm.intervalDays}
              onChange={(event) => setHealthForm({ ...healthForm, intervalDays: Number(event.target.value) })}
            >
              {![1, 3, 7, 14, 30, 90].includes(healthForm.intervalDays) && (
                <option value={healthForm.intervalDays}>{intervalLabel(healthForm.intervalDays)}</option>
              )}
              <option value={1}>Every day</option>
              <option value={3}>Every 3 days</option>
              <option value={7}>Every week</option>
              <option value={14}>Every 2 weeks</option>
              <option value={30}>Every 30 days (monthly)</option>
              <option value={90}>Every 90 days</option>
            </select>
          </label>
          <p className="form-hint">
            {health?.schedule.enabled
              ? `Checks run at ${scheduleHourLabel(health.schedule.hour)} ${health.schedule.timeZone} on the selected interval. Every enabled service is called one by one, and each webhook result is paired with its pipeline deployment.`
              : `Enabling the schedule runs the first check at the next ${scheduleHourLabel(health?.schedule.hour ?? 3)} ${health?.schedule.timeZone || 'Asia/Kolkata'}, then at the end of each interval. Every enabled service is called one by one, and each webhook result is paired with its pipeline deployment.`}
          </p>
          {healthError && <p className="error">{healthError}</p>}
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={() => setHealthSettingsOpen(false)}>
              Cancel
            </button>
            <button type="submit" disabled={healthSaving}>
              {healthSaving ? 'Saving...' : 'Save settings'}
            </button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}

export default Dashboard;

'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Script from 'next/script';

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const TOKEN_KEY = 'hextorq_token';

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
}

type ServiceType = 'PM2' | 'STATIC_FRONTEND';

type Service = {
  id: string;
  name: string;
  slug: string;
  type: ServiceType;
  repositoryUrl: string;
  branch: string;
  projectKey: string;
  webhookUrl?: string | null;
  workingDirectory: string;
  deployDirectory?: string | null;
  pm2ProcessName?: string | null;
  templateKey?: string | null;
  customCommands?: Record<string, string> | null;
  enabled: boolean;
  client: { id: string; name: string; email: string };
  agent: { id: string; name: string; baseUrl: string; enabled: boolean };
};

type Deployment = {
  id: string;
  runId: string;
  status: string;
  triggerSource: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  service: { id: string; name: string };
  commitHash?: string | null;
  commitMessage?: string | null;
  branch?: string | null;
};

type DeploymentLog = { timestamp: string; message: string };

type Pm2Status = { status?: string; cpu?: number; memory?: number; restarts?: number };

type WebhookHealthService = {
  id: string;
  name: string;
  slug: string;
  type: ServiceType;
  pm2ProcessName?: string | null;
  enabled: boolean;
};

type WebhookDeployment = {
  id: string;
  runId: string;
  status: string;
  triggerSource: string;
  startedAt: string;
  completedAt?: string | null;
  durationMs?: number | null;
  failureReason?: string | null;
};

type WebhookHealthCheck = {
  id: string;
  serviceId: string;
  service: WebhookHealthService;
  status: 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAILED';
  httpStatus?: number | null;
  message?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  durationMs?: number | null;
  deployment?: WebhookDeployment | null;
};

type WebhookHealthRun = {
  id: string;
  clientId?: string;
  source: 'MANUAL' | 'SCHEDULED';
  status: 'RUNNING' | 'SUCCESS' | 'PARTIAL' | 'FAILED';
  requestedBy?: string | null;
  totalServices: number;
  successfulServices: number;
  failedServices: number;
  startedAt: string;
  completedAt?: string | null;
  checks: WebhookHealthCheck[];
};

type WebhookSchedule = {
  clientId: string;
  enabled: boolean;
  intervalDays: number | null;
  nextRunAt?: string | null;
  lastRunAt?: string | null;
  timeZone: string;
  hour: number;
};

type WebhookRunSummary = {
  id: string;
  source: 'MANUAL' | 'SCHEDULED';
  status: 'RUNNING' | 'SUCCESS' | 'PARTIAL' | 'FAILED';
  totalServices: number;
  successfulServices: number;
  failedServices: number;
  startedAt: string;
  completedAt?: string | null;
};

type WebhookHealthData = {
  schedule: WebhookSchedule;
  latestRun?: WebhookHealthRun | null;
  activeRun?: WebhookHealthRun | null;
  recentRuns: WebhookRunSummary[];
};

type FailureAlert = {
  id: string;
  title: string;
  timestamp: string;
  details: string;
};

type AccessType = 'SFTP' | 'DATABASE';
type ClientAccess = {
  id: string;
  clientId: string;
  type: AccessType;
  label: string;
  host: string;
  port: number;
  username: string;
  password: string | null;
  path?: string | null;
  databaseName?: string | null;
  sslMode?: string | null;
  notes?: string | null;
  enabled: boolean;
  client?: { id: string; name: string; email: string };
  createdAt: string;
  updatedAt: string;
};
type AccessForm = {
  clientId: string;
  type: AccessType;
  label: string;
  host: string;
  port: number;
  username: string;
  password: string;
  path: string;
  databaseName: string;
  sslMode: string;
  notes: string;
  enabled: boolean;
};
type Client = { id: string; name: string; email: string; _count: { services: number; accessEntries: number } };
type Agent = { id: string; name: string; baseUrl: string; enabled: boolean };
type Pm2Process = { name: string; id: number; status?: string };
type Template = { key: string; name: string; type: ServiceType };
type ServiceForm = {
  name: string;
  slug: string;
  type: ServiceType;
  repositoryUrl: string;
  branch: string;
  projectKey: string;
  webhookUrl: string;
  workingDirectory: string;
  deployDirectory: string;
  pm2ProcessName: string;
  templateKey: string;
  clientId: string;
  agentId: string;
};
type ServiceEditForm = {
  name: string;
  branch: string;
  enabled: boolean;
  templateKey: string;
  pm2ProcessName: string;
  deployDirectory: string;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void;
          renderButton: (element: HTMLElement, options: Record<string, string>) => void;
        };
      };
    };
  }
}

async function responseJson<T>(response: Response): Promise<T> {
  return (await response.json().catch(() => ({}))) as T;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

type Pm2LogEntry = { message: string; stream?: string; timestamp?: string; live?: boolean; error?: boolean };

function parseLogEvent(payload: string): Pm2LogEntry | null {
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
}

function emptyAccessForm(): AccessForm {
  return {
    clientId: '',
    type: 'SFTP',
    label: '',
    host: '',
    port: 22,
    username: '',
    password: '',
    path: '',
    databaseName: '',
    sslMode: 'Prefer',
    notes: '',
    enabled: true,
  };
}

function AccessEntryCard({ entry }: { entry: ClientAccess }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState('');

  const fields: Array<{ label: string; value: string }> = [
    { label: 'Host', value: entry.host },
    { label: 'Port', value: String(entry.port) },
  ];

  if (entry.type === 'SFTP') {
    fields.push(
      { label: 'Protocol', value: 'SFTP' },
      { label: 'Username', value: entry.username },
      { label: 'Path', value: entry.path || '/' },
    );
  } else {
    fields.push(
      { label: 'Maintenance database', value: entry.databaseName || '' },
      { label: 'Username', value: entry.username },
      { label: 'SSL mode', value: entry.sslMode || 'Prefer' },
    );
  }

  async function copyField(label: string, value: string) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(''), 1500);
    } catch {
      // Clipboard access can be blocked by the browser; the value remains selectable.
    }
  }

  return (
    <article className={`access-card ${entry.type === 'DATABASE' ? 'database' : 'sftp'}`}>
      <div className="access-card-head">
        <span className={`access-type-badge ${entry.type === 'DATABASE' ? 'database' : 'sftp'}`}>
          {entry.type === 'DATABASE' ? 'POSTGRESQL' : 'SFTP'}
        </span>
        <span className={`access-state ${entry.enabled ? 'enabled' : 'disabled'}`}>
          {entry.enabled ? 'Active' : 'Disabled'}
        </span>
      </div>
      <h3>{entry.label}</h3>
      {entry.client && <p className="access-client">{entry.client.name}</p>}
      <div className="access-fields">
        {fields.map((field) => (
          <div className="access-field" key={field.label}>
            <span className="access-label">{field.label}</span>
            <div className="access-value-row">
              <code>{field.value || 'Not set'}</code>
              {field.value && (
                <button type="button" className="mini-button" onClick={() => copyField(field.label, field.value)}>
                  {copied === field.label ? 'Copied' : 'Copy'}
                </button>
              )}
            </div>
          </div>
        ))}
        <div className="access-field">
          <span className="access-label">Password</span>
          <div className="access-value-row">
            <code>{entry.password ? (revealed ? entry.password : '••••••••') : 'Unavailable'}</code>
            {entry.password && (
              <>
                <button type="button" className="mini-button" onClick={() => setRevealed((current) => !current)}>
                  {revealed ? 'Hide' : 'Show'}
                </button>
                <button type="button" className="mini-button" onClick={() => copyField('Password', entry.password || '')}>
                  {copied === 'Password' ? 'Copied' : 'Copy'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      {entry.notes && <p className="access-notes">{entry.notes}</p>}
    </article>
  );
}

function intervalLabel(days: number | null | undefined) {
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

function WebhookHealthPanel({
  health,
  loading,
  error,
  runLoading,
  onSettings,
  onRun,
}: {
  health: WebhookHealthData | null;
  loading: boolean;
  error: string;
  runLoading: boolean;
  onSettings: () => void;
  onRun: () => void;
}) {
  const run = health?.latestRun || null;
  const active = health?.activeRun || run?.status === 'RUNNING';
  const completedChecks = run
    ? run.checks.filter((check) => check.status === 'SUCCESS' || check.status === 'FAILED').length
    : 0;

  return (
    <section className="health-panel">
      <div className="health-panel-head">
        <div>
          <p className="eyebrow">WEBHOOK HEALTH</p>
          <h2>Service health checks</h2>
          <p className="muted">
            {health?.schedule.enabled
              ? `${intervalLabel(health.schedule.intervalDays)} at ${scheduleHourLabel(health.schedule.hour)} ${health.schedule.timeZone}.`
              : 'Automatic checks are off. Enable a schedule or run every webhook now.'}
          </p>
        </div>
        <div className="health-panel-actions">
          <button className="secondary" type="button" onClick={onSettings}>
            Settings
          </button>
          <button type="button" onClick={onRun} disabled={runLoading || Boolean(active)}>
            {runLoading ? 'Starting...' : active ? 'Check running...' : 'Run all now'}
          </button>
        </div>
      </div>

      <div className="health-schedule-meta">
        <span>{health?.schedule.enabled ? `Next check: ${health.schedule.nextRunAt ? scheduleDateTimeLabel(health.schedule.nextRunAt, health.schedule.timeZone) : 'Waiting for schedule'}` : 'Schedule disabled'}</span>
        <span>{health?.schedule.lastRunAt ? `Last check: ${scheduleDateTimeLabel(health.schedule.lastRunAt, health.schedule.timeZone)}` : 'No health check has run yet'}</span>
        {health?.schedule.timeZone && <span>Time zone: {health.schedule.timeZone}</span>}
      </div>

      {error && <p className="error">{error}</p>}
      {loading && !health && <p className="muted">Loading webhook health...</p>}
      {!loading && !run && !error && (
        <p className="muted health-empty">
          No health checks have run yet. Use Run all now to verify every enabled service webhook.
        </p>
      )}

      {run && (
        <div className="health-run">
          <div className="health-run-head">
            <div>
              <span className={`badge ${healthStatusClass(run.status)}`}>{healthStatusLabel(run.status)}</span>
              <strong>{run.source === 'SCHEDULED' ? 'Automatic check' : 'Manual check'}</strong>
              <span className="row-meta">
                {completedChecks} / {run.totalServices} services checked
              </span>
            </div>
            <span className="row-meta">
              {run.completedAt ? `Finished ${new Date(run.completedAt).toLocaleString()}` : `Started ${new Date(run.startedAt).toLocaleString()}`}
            </span>
          </div>
          <div className="health-check-grid">
            {run.checks.map((check) => {
              const deployment = check.deployment;
              const webhookAccepted = check.httpStatus !== null && check.httpStatus !== undefined && check.httpStatus >= 200 && check.httpStatus < 300;
              return (
                <article className={`health-check ${healthStatusClass(check.status)}`} key={check.id}>
                  <div className="health-check-head">
                    <div>
                      <strong>{check.service.name}</strong>
                      <small>{check.service.type.replace('_', ' ')}</small>
                    </div>
                    <span className={`badge ${healthStatusClass(check.status)}`}>{healthStatusLabel(check.status)}</span>
                  </div>
                  <div className="health-chips">
                    <span className={`health-chip ${webhookAccepted ? 'ok' : check.status === 'FAILED' ? 'bad' : ''}`}>
                      Webhook {check.httpStatus ? `HTTP ${check.httpStatus}` : 'pending'}
                    </span>
                    <span className={`health-chip ${deployment?.status === 'SUCCESS' ? 'ok' : deployment && ['FAILED', 'ERROR'].includes(deployment.status) ? 'bad' : ''}`}>
                      Deployment {deployment ? deployment.status.toLowerCase() : 'waiting'}
                    </span>
                  </div>
                  <p className="health-message">{check.message || 'Waiting for the pipeline.'}</p>
                  <small className="health-check-time">
                    {check.completedAt
                      ? `Completed ${new Date(check.completedAt).toLocaleString()}`
                      : check.startedAt
                        ? `Started ${new Date(check.startedAt).toLocaleTimeString()}`
                        : 'Queued'}
                  </small>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState('');
  const [forcePasswordChange, setForcePasswordChange] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    const storedToken = window.localStorage.getItem(TOKEN_KEY);
    if (!storedToken) {
      setSessionChecked(true);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`${apiUrl}/auth/me`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        });
        const data = await responseJson<{ user?: { role?: string; forcePasswordChange?: boolean }; message?: string }>(response);
        if (!response.ok || !data.user) throw new Error(data.message || 'Session expired');
        if (cancelled) return;
        setToken(storedToken);
        setRole(data.user.role || '');
        setForcePasswordChange(Boolean(data.user.forcePasswordChange));
      } catch {
        window.localStorage.removeItem(TOKEN_KEY);
      } finally {
        if (!cancelled) setSessionChecked(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function signInWithGoogle(credential: string) {
    setMessage('Signing in...');
    try {
      const response = await fetch(`${apiUrl}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });
      const data = await responseJson<{ token?: string; user?: { role?: string; forcePasswordChange?: boolean }; message?: string }>(response);
      if (!response.ok || !data.token || !data.user) throw new Error(data.message || 'Google sign-in failed');
      window.localStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token);
      setRole(data.user.role || '');
      setForcePasswordChange(Boolean(data.user.forcePasswordChange));
    } catch (error) {
      setMessage(errorMessage(error, 'Google sign-in failed'));
    }
  }

  function initializeGoogle() {
    const element = document.getElementById('google-button');
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!element || !window.google || !clientId) return;
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: ({ credential }) => signInWithGoogle(credential),
    });
    window.google.accounts.id.renderButton(element, { theme: 'outline', size: 'large', width: '330' });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage('Signing in...');
    try {
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await responseJson<{ token?: string; user?: { role?: string; forcePasswordChange?: boolean }; message?: string }>(response);
      if (!response.ok || !data.token || !data.user) throw new Error(data.message || 'Unable to sign in');
      window.localStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token);
      setRole(data.user.role || '');
      setForcePasswordChange(Boolean(data.user.forcePasswordChange));
    } catch (error) {
      setMessage(errorMessage(error, 'Unable to sign in'));
    }
  }

  if (!sessionChecked) {
    return (
      <main className="login-shell">
        <section className="login-card">
          <p className="eyebrow">HEX TORQ CLOUD</p>
          <h1>Cloud Console</h1>
          <p className="muted">Checking your session...</p>
        </section>
      </main>
    );
  }

  if (token) {
    return forcePasswordChange ? (
      <PasswordChange token={token} onComplete={() => setForcePasswordChange(false)} />
    ) : (
      <Dashboard token={token} role={role} />
    );
  }

  return (
    <main className="login-shell">
      <Script src="https://accounts.google.com/gsi/client" onLoad={initializeGoogle} />
      <section className="login-card">
        <p className="eyebrow">HEX TORQ CLOUD</p>
        <h1>Cloud Console</h1>
        <p className="muted">Manage deployments across every connected VPS.</p>
        <form onSubmit={submit}>
          <label>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          <button type="submit">Sign in</button>
        </form>
        <div id="google-button" className="google-button" />
        {message && <p className="message">{message}</p>}
        <p className="help">Need access? Contact your HexTorq administrator.</p>
      </section>
    </main>
  );
}

function PasswordChange({ token, onComplete }: { token: string; onComplete: () => void }) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8 || password !== confirmation) {
      setMessage('Passwords must match and contain at least 8 characters.');
      return;
    }
    try {
      const response = await fetch(`${apiUrl}/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ password }),
      });
      const data = await responseJson<{ message?: string }>(response);
      if (!response.ok) throw new Error(data.message || 'Unable to change password');
      onComplete();
    } catch (error) {
      setMessage(errorMessage(error, 'Unable to change password'));
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <p className="eyebrow">FIRST LOGIN</p>
        <h1>Set your password</h1>
        <p className="muted">Your administrator provided a temporary password. Choose a private password before continuing.</p>
        <form onSubmit={submit}>
          <label>
            New password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} />
          </label>
          <label>
            Confirm password
            <input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required minLength={8} />
          </label>
          <button type="submit">Save password</button>
        </form>
        {message && <p className="error">{message}</p>}
      </section>
    </main>
  );
}

function Dashboard({ token, role }: { token: string; role: string }) {
  const [services, setServices] = useState<Service[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deploying, setDeploying] = useState<string | null>(null);
  const [pm2Action, setPm2Action] = useState<string | null>(null);
  const [pm2Status, setPm2Status] = useState<Record<string, Pm2Status>>({});
  const [selectedDeployment, setSelectedDeployment] = useState<string | null>(null);
  const [historyServiceId, setHistoryServiceId] = useState<string | null>(null);
  const [deploymentLogs, setDeploymentLogs] = useState<DeploymentLog[]>([]);
  const [pm2LogService, setPm2LogService] = useState<Service | null>(null);
  const [pm2LogEntries, setPm2LogEntries] = useState<Pm2LogEntry[]>([]);
  const [pm2LogError, setPm2LogError] = useState('');
  const [pm2LogLoading, setPm2LogLoading] = useState(false);
  const [accessEntries, setAccessEntries] = useState<ClientAccess[]>([]);
  const [accessOpen, setAccessOpen] = useState(false);
  const [health, setHealth] = useState<WebhookHealthData | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState('');
  const [healthSettingsOpen, setHealthSettingsOpen] = useState(false);
  const [healthForm, setHealthForm] = useState({ enabled: false, intervalDays: 7 });
  const [healthSaving, setHealthSaving] = useState(false);
  const [healthRunLoading, setHealthRunLoading] = useState(false);
  const [failureAlerts, setFailureAlerts] = useState<FailureAlert[]>([]);
  const pm2LogAbortRef = useRef<AbortController | null>(null);
  const healthRunStatusesRef = useRef<Record<string, string>>({});

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const accessRequest = role === 'CLIENT' ? fetch(`${apiUrl}/access`, { headers }) : Promise.resolve(null);
      const [serviceResponse, deploymentResponse, accessResponse] = await Promise.all([
        fetch(`${apiUrl}/services`, { headers }),
        fetch(`${apiUrl}/deployments`, { headers }),
        accessRequest,
      ]);
      const serviceData = await responseJson<{ services?: Service[]; message?: string }>(serviceResponse);
      const deploymentData = await responseJson<{ deployments?: Deployment[]; message?: string }>(deploymentResponse);
      const accessData = accessResponse
        ? await responseJson<{ access?: ClientAccess[]; message?: string }>(accessResponse)
        : {};
      if (!serviceResponse.ok) throw new Error(serviceData.message || 'Unable to load services');
      if (!deploymentResponse.ok) throw new Error(deploymentData.message || 'Unable to load deployments');
      setServices(serviceData.services || []);
      setDeployments(deploymentData.deployments || []);
      setAccessEntries(accessResponse ? accessData.access || [] : []);
      setError(accessResponse && !accessResponse.ok ? accessData.message || 'Unable to load access credentials' : '');
    } catch (reason) {
      setError(errorMessage(reason, 'Unable to load console data'));
    } finally {
      setLoading(false);
    }
  }, [role, token]);

  function addFailureAlert(alert: FailureAlert) {
    setFailureAlerts((current) => current.some((item) => item.id === alert.id) ? current : [alert, ...current].slice(0, 10));
  }

  async function deploymentFailureLogs(deploymentId: string | undefined) {
    if (!deploymentId) return '';
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
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    void loadHealth();
  }, [loadHealth]);

  useEffect(() => {
    if (role !== 'CLIENT') return;
    const timer = window.setInterval(() => {
      void loadHealth(true);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [loadHealth, role]);

  useEffect(() => {
    let cancelled = false;
    const loadPm2Statuses = async () => {
      await Promise.all(services
        .filter((service) => service.type === 'PM2')
        .map(async (service) => {
          try {
            const response = await fetch(`${apiUrl}/services/${service.id}/pm2/status`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (!response.ok) return;
            const data = await responseJson<Pm2Status>(response);
            if (!cancelled) setPm2Status((current) => ({ ...current, [service.id]: data }));
          } catch {
            // Status is supplementary; the service card still works without it.
          }
        }));
    };
    void loadPm2Statuses();
    const timer = window.setInterval(() => { void loadPm2Statuses(); }, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [services, token]);

  useEffect(() => {
    if (!selectedDeployment) {
      setDeploymentLogs([]);
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
    window.localStorage.removeItem(TOKEN_KEY);
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
      await loadDashboard();

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
    if (!window.confirm(`Confirm PM2 ${action}?`)) return;
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
  }

  async function openPm2Logs(service: Service) {
    pm2LogAbortRef.current?.abort();
    const controller = new AbortController();
    pm2LogAbortRef.current = controller;
    setPm2LogService(service);
    setPm2LogEntries([]);
    setPm2LogError('');
    setPm2LogLoading(true);

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
        if (entries.length) setPm2LogEntries((current) => [...entries.reverse(), ...current].slice(0, 500));
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

  return (
    <main className="console-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">HEX TORQ CLOUD</p>
          <h1>Cloud Console</h1>
        </div>
        <button className="secondary" onClick={signOut}>
          Sign out
        </button>
      </header>

      {role === 'SUPER_ADMIN' && <AdminPanel token={token} onChanged={loadDashboard} />}

      {failureAlerts.length > 0 && (
        <section className="failure-alert-panel" aria-live="assertive">
          <div className="failure-alert-heading">
            <div>
              <p className="eyebrow">DEPLOYMENT ALERTS</p>
              <h2>Action required</h2>
            </div>
            <button className="secondary" type="button" onClick={() => setFailureAlerts([])}>Dismiss all</button>
          </div>
          <div className="failure-alert-list">
            {failureAlerts.map((alert) => (
              <article className="failure-alert" key={alert.id}>
                <div className="failure-alert-meta">
                  <strong>{alert.title}</strong>
                  <span>{new Date(alert.timestamp).toLocaleString()}</span>
                </div>
                <pre>{alert.details}</pre>
              </article>
            ))}
          </div>
        </section>
      )}

      {role === 'CLIENT' && (
        <section className="access-banner">
          <div>
            <p className="eyebrow">CLIENT ACCESS</p>
            <h2>FileZilla & database credentials</h2>
            <p className="muted">
              {accessEntries.length === 0
                ? 'No access credentials have been assigned to your account yet.'
                : `${accessEntries.length} active access ${accessEntries.length === 1 ? 'entry is' : 'entries are'} available.`}
            </p>
          </div>
          <button className="secondary" onClick={() => setAccessOpen(true)}>
            View access
          </button>
        </section>
      )}

      {role === 'CLIENT' && (
        <WebhookHealthPanel
          health={health}
          loading={healthLoading}
          error={healthError}
          runLoading={healthRunLoading}
          onSettings={openHealthSettings}
          onRun={runWebhookHealth}
        />
      )}

      <section className="welcome">
        <p className="muted">Connected services</p>
        <h2>Service overview</h2>
        {error && <p className="error">{error}</p>}
        {loading ? (
          <p className="muted">Loading services...</p>
        ) : services.length === 0 && !error ? (
          <p className="muted">No services have been configured yet.</p>
        ) : (
          <div className="service-grid">
            {services.map((service) => (
              <article className="service-card" key={service.id}>
                <div className={`service-status ${service.enabled ? '' : 'offline'}`} />
                <h3>{service.name}</h3>
                <p>
                  {service.type.replace('_', ' ')} / {service.agent.name}
                  {service.enabled ? '' : ' / disabled'}
                </p>
                <small>{service.client.name}</small>
                {(() => {
                  const latestDeployment = deployments.find((deployment) => deployment.service.id === service.id);
                  return latestDeployment ? (
                    <div className="service-commit">
                      <small>
                        Latest commit: {latestDeployment.commitHash ? latestDeployment.commitHash.slice(0, 8) : 'not reported'}
                        {latestDeployment.commitMessage ? ` — ${latestDeployment.commitMessage}` : ''}
                      </small>
                      <a href={service.repositoryUrl} target="_blank" rel="noreferrer">View Git repository</a>
                    </div>
                  ) : (
                    <a className="service-repository-link" href={service.repositoryUrl} target="_blank" rel="noreferrer">View Git repository</a>
                  );
                })()}
                {service.type === 'PM2' && pm2Status[service.id] && (
                  <p className="pm2-status">
                    {pm2Status[service.id].status || 'unknown'} / CPU {pm2Status[service.id].cpu ?? 0}% /{' '}
                    {Math.round((pm2Status[service.id].memory || 0) / 1024 / 1024)} MB /{' '}
                    {pm2Status[service.id].restarts || 0} restarts
                  </p>
                )}
                <div className="deploy-actions">
                  <button className="deploy-button" onClick={() => deploy(service.id, false)} disabled={!service.enabled || deploying === service.id}>
                    {!service.enabled ? 'Disabled' : deploying === service.id ? 'Triggering...' : 'Normal deploy'}
                  </button>
                  <button className="secondary" onClick={() => deploy(service.id, true)} disabled={!service.enabled || deploying === service.id}>
                    Force deploy
                  </button>
                </div>
                <button className="secondary" onClick={() => setHistoryServiceId(historyServiceId === service.id ? null : service.id)}>
                  {historyServiceId === service.id ? 'Hide project history' : 'View project history'}
                </button>
                {historyServiceId === service.id && (
                  <div className="service-history">
                    {deployments.filter((deployment) => deployment.service.id === service.id).slice(0, 5).map((deployment) => (
                      <button className="service-history-row" key={deployment.id} onClick={() => setSelectedDeployment(deployment.id)}>
                        <span className={`badge ${deployment.status.toLowerCase()}`}>{deployment.status}</span>
                        <span>{deployment.triggerSource}</span>
                        <span>{new Date(deployment.startedAt).toLocaleString()}</span>
                      </button>
                    ))}
                    {deployments.filter((deployment) => deployment.service.id === service.id).length === 0 && (
                      <small className="muted">No deployments recorded for this project.</small>
                    )}
                  </div>
                )}
                {service.type === 'PM2' && (
                  <>
                    <button className="secondary pm2-log-button" onClick={() => openPm2Logs(service)} disabled={!service.enabled}>
                      View live PM2 logs
                    </button>
                    <div className="pm2-actions">
                      {['start', 'stop', 'restart', 'reload'].map((action) => (
                        <button
                          className="pm2-button"
                          key={action}
                          onClick={() => controlPm2(service.id, action)}
                          disabled={!service.enabled || pm2Action === `${service.id}:${action}`}
                        >
                          {pm2Action === `${service.id}:${action}` ? '...' : action}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </article>
            ))}
          </div>
        )}

        <div className="history-heading">
          <p className="muted">Permanent deployment metadata</p>
          <h2>Deployment history</h2>
        </div>
        {deployments.length === 0 ? (
          <p className="muted">No deployments recorded yet.</p>
        ) : (
          <div className="history-table">
            <div className="history-row history-header">
              <span>Service</span>
              <span>Status</span>
              <span>Trigger</span>
              <span>Started</span>
              <span>Duration</span>
              <span>Commit</span>
              <span>Commit message</span>
            </div>
            {deployments.map((deployment) => (
              <div className="history-row" key={deployment.id} onClick={() => setSelectedDeployment(deployment.id)}>
                <strong>{deployment.service.name}</strong>
                <span className={`badge ${deployment.status.toLowerCase()}`}>{deployment.status}</span>
                <span>{deployment.triggerSource}</span>
                <span>{new Date(deployment.startedAt).toLocaleString()}</span>
                <span>{deployment.durationMs ? `${Math.round(deployment.durationMs / 1000)}s` : 'Running'}</span>
                <span title={deployment.commitHash || undefined}>{deployment.commitHash ? deployment.commitHash.slice(0, 8) : '—'}</span>
                <span className="commit-message" title={deployment.commitMessage || undefined}>
                  {deployment.commitMessage || 'Message not reported'}
                </span>
              </div>
            ))}
          </div>
        )}
        {selectedDeployment && (
          <div className="deployment-detail">
            <div className="detail-header">
               <h3>Live deployment logs</h3>
              <button className="secondary" onClick={() => setSelectedDeployment(null)}>
                Close
              </button>
            </div>
            <pre>
              {deploymentLogs.map((log) => `[${new Date(log.timestamp).toLocaleTimeString()}] ${log.message}`).join('\n') ||
                'Waiting for deployment logs.'}
            </pre>
          </div>
        )}
      </section>

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
            <pre className="pm2-log-output">
              {pm2LogEntries.length ? pm2LogEntries.map((entry, index) => (
                <span className={`pm2-log-line${entry.error ? ' error' : ''}`} key={`${index}-${entry.message}`}>
                  {entry.live && entry.timestamp ? `[${new Date(entry.timestamp).toLocaleTimeString()}] ` : ''}
                  {entry.error ? 'ERR ' : ''}{entry.message}
                </span>
              )) : (pm2LogLoading ? 'Connecting to log stream...' : 'Waiting for log output...')}
            </pre>
            <div className="modal-actions">
              <button className="secondary" onClick={closePm2Logs}>
                Close
              </button>
            </div>
          </section>
        </div>
      )}

      <Modal
        open={accessOpen}
        title="Your access credentials"
        subtitle="FileZilla/SFTP and PostgreSQL connection details assigned to your account."
        onClose={() => setAccessOpen(false)}
      >
        {accessEntries.length === 0 ? (
          <p className="muted access-empty">No access credentials have been assigned to your account yet. Contact your administrator if you need access.</p>
        ) : (
          <div className="access-grid">
            {accessEntries.map((entry) => (
              <AccessEntryCard key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </Modal>

      <Modal
        open={healthSettingsOpen}
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
    </main>
  );
}

function AdminPanel({ token, onChanged }: { token: string; onChanged?: () => void }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [pm2Processes, setPm2Processes] = useState<Pm2Process[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [accessEntries, setAccessEntries] = useState<ClientAccess[]>([]);
  const [accessError, setAccessError] = useState('');
  const [accessForm, setAccessForm] = useState<AccessForm>(emptyAccessForm);
  const [editingAccess, setEditingAccess] = useState<ClientAccess | null>(null);
  const [viewingAccess, setViewingAccess] = useState<ClientAccess | null>(null);
  const [retention, setRetention] = useState(30);
  const [clientForm, setClientForm] = useState({ name: '', email: '', temporaryPassword: '' });
  const [agentForm, setAgentForm] = useState({ name: '', baseUrl: '' });
  const [serviceForm, setServiceForm] = useState<ServiceForm>({
    name: '',
    slug: '',
    type: 'PM2',
    repositoryUrl: '',
    branch: 'main',
     projectKey: '',
     webhookUrl: '',
     workingDirectory: '',
    deployDirectory: '',
    pm2ProcessName: '',
    templateKey: '',
    clientId: '',
    agentId: '',
  });
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [serviceEdit, setServiceEdit] = useState<ServiceEditForm>({
    name: '',
    branch: '',
    enabled: true,
    templateKey: '',
    pm2ProcessName: '',
    deployDirectory: '',
  });
  const [notice, setNotice] = useState('');
  const [modal, setModal] = useState<'client' | 'agent' | 'service' | 'edit-service' | 'access' | 'edit-access' | 'view-access' | 'settings' | null>(null);
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => {
    if (clients.length || agents.length) {
      setServiceForm((current) => ({
        ...current,
        clientId: current.clientId || clients[0]?.id || '',
        agentId: current.agentId || agents[0]?.id || '',
      }));
    }
  }, [clients, agents]);

  useEffect(() => {
    const agent = agents.find((item) => item.id === serviceForm.agentId);
    const webhookUrl = serviceWebhookUrl(agent?.baseUrl || '', serviceForm.projectKey);
    setServiceForm((current) => current.webhookUrl === webhookUrl ? current : { ...current, webhookUrl });
  }, [agents, serviceForm.agentId, serviceForm.projectKey]);

  useEffect(() => {
    if (!serviceForm.agentId) {
      setPm2Processes([]);
      return;
    }
    let cancelled = false;
    fetch(`${apiUrl}/admin/agents/${encodeURIComponent(serviceForm.agentId)}/pm2/processes`, { headers })
      .then((response) => responseJson<{ processes?: Pm2Process[] }>(response))
      .then((data) => { if (!cancelled) setPm2Processes(data.processes || []); })
      .catch(() => { if (!cancelled) setPm2Processes([]); });
    return () => { cancelled = true; };
  }, [serviceForm.agentId, token]);

  async function loadRepositoryMetadata(repositoryUrl: string) {
    if (!repositoryUrl) return;
    try {
      const response = await fetch(`${apiUrl}/admin/repository-metadata?url=${encodeURIComponent(repositoryUrl)}`, { headers });
      const data = await responseJson<{ slug?: string; branch?: string }>(response);
      if (!response.ok) return;
      setServiceForm((current) => ({ ...current, slug: data.slug || current.slug, branch: data.branch || current.branch || 'main' }));
    } catch { /* Manual values remain usable if repository metadata is unavailable. */ }
  }

  async function refresh() {
    const [clientResponse, agentResponse, templateResponse, settingsResponse, serviceResponse, accessResponse] = await Promise.all([
      fetch(`${apiUrl}/admin/clients`, { headers }),
      fetch(`${apiUrl}/admin/agents`, { headers }),
      fetch(`${apiUrl}/templates`, { headers }),
      fetch(`${apiUrl}/admin/settings`, { headers }),
      fetch(`${apiUrl}/services`, { headers }),
      fetch(`${apiUrl}/admin/access`, { headers }),
    ]);
    const clientData = await responseJson<{ clients?: Client[]; message?: string }>(clientResponse);
    const agentData = await responseJson<{ agents?: Agent[]; message?: string }>(agentResponse);
    const templateData = await responseJson<{ templates?: Template[]; message?: string }>(templateResponse);
    const settingsData = await responseJson<{ logRetentionDays?: number; message?: string }>(settingsResponse);
    const serviceData = await responseJson<{ services?: Service[]; message?: string }>(serviceResponse);
    const accessData = await responseJson<{ access?: ClientAccess[]; message?: string }>(accessResponse);
    if (!clientResponse.ok) throw new Error(clientData.message || 'Unable to load clients');
    if (!agentResponse.ok) throw new Error(agentData.message || 'Unable to load agents');
    if (!templateResponse.ok) throw new Error(templateData.message || 'Unable to load templates');
    if (!settingsResponse.ok) throw new Error(settingsData.message || 'Unable to load settings');
    if (!serviceResponse.ok) throw new Error(serviceData.message || 'Unable to load services');
    setClients(clientData.clients || []);
    setAgents(agentData.agents || []);
    setTemplates(templateData.templates || []);
    setRetention(settingsData.logRetentionDays || 30);
    setServices(serviceData.services || []);
    setAccessEntries(accessResponse.ok ? accessData.access || [] : []);
    setAccessError(accessResponse.ok ? '' : accessData.message || 'Unable to load access credentials');
  }

  useEffect(() => {
    void refresh().catch((reason) => setNotice(errorMessage(reason, 'Unable to load administration data')));
  }, []);

  async function createClient(event: FormEvent) {
    event.preventDefault();
    try {
      const response = await fetch(`${apiUrl}/admin/clients`, {
        method: 'POST',
        headers,
        body: JSON.stringify(clientForm),
      });
      const data = await responseJson<{ temporaryPassword?: string; message?: string }>(response);
      if (!response.ok) throw new Error(data.message || 'Unable to create client');
      setNotice(`Client created. Temporary password: ${data.temporaryPassword}`);
      setClientForm({ name: '', email: '', temporaryPassword: '' });
      setModal(null);
      await refresh();
      onChanged?.();
    } catch (reason) {
      setNotice(errorMessage(reason, 'Unable to create client'));
    }
  }

  async function createAgent(event: FormEvent) {
    event.preventDefault();
    try {
      const response = await fetch(`${apiUrl}/admin/agents`, {
        method: 'POST',
        headers,
        body: JSON.stringify(agentForm),
      });
      const data = await responseJson<{ agent?: { id?: string }; enrollmentToken?: string; message?: string }>(response);
      if (!response.ok) throw new Error(data.message || 'Unable to register agent');
      setNotice(`Agent created. Agent ID: ${data.agent?.id || 'unavailable'}. Enrollment token: ${data.enrollmentToken}`);
      setAgentForm({ name: '', baseUrl: '' });
      setModal(null);
      await refresh();
      onChanged?.();
    } catch (reason) {
      setNotice(errorMessage(reason, 'Unable to register agent'));
    }
  }

  async function regenerateAgentToken(agentId: string) {
    try {
      const response = await fetch(`${apiUrl}/admin/agents/${agentId}/enrollment-token`, {
        method: 'POST',
        headers,
      });
      const data = await responseJson<{ enrollmentToken?: string; message?: string }>(response);
      if (!response.ok || !data.enrollmentToken) throw new Error(data.message || 'Unable to generate enrollment token');
      setNotice(`Enrollment token regenerated for ${agentId}: ${data.enrollmentToken}`);
    } catch (reason) {
      setNotice(errorMessage(reason, 'Unable to generate enrollment token'));
    }
  }

  async function createService(event: FormEvent) {
    event.preventDefault();
    try {
      const response = await fetch(`${apiUrl}/admin/services`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
           ...serviceForm,
           webhookUrl: serviceForm.webhookUrl || undefined,
           deployDirectory: serviceForm.type === 'STATIC_FRONTEND' ? serviceForm.deployDirectory : undefined,
          pm2ProcessName: serviceForm.type === 'PM2' ? serviceForm.pm2ProcessName : undefined,
        }),
      });
      const data = await responseJson<{ service?: Service; message?: string }>(response);
      if (!response.ok || !data.service) throw new Error(data.message || 'Unable to create service');
      setNotice(`Service ${data.service.name} created.`);
      setServiceForm({
        ...serviceForm,
        name: '',
        slug: '',
         repositoryUrl: '',
         webhookUrl: '',
         projectKey: '',
        workingDirectory: '',
        deployDirectory: '',
        pm2ProcessName: '',
      });
      setModal(null);
      await refresh();
      onChanged?.();
    } catch (reason) {
      setNotice(errorMessage(reason, 'Unable to create service'));
    }
  }

  function openEditService(service: Service) {
    setEditingService(service);
    setServiceEdit({
      name: service.name,
      branch: service.branch,
      enabled: service.enabled,
      templateKey: service.templateKey || '',
      pm2ProcessName: service.pm2ProcessName || '',
      deployDirectory: service.deployDirectory || '',
    });
    setModal('edit-service');
  }

  function closeEditService() {
    setModal(null);
    setEditingService(null);
  }

  async function saveService(event: FormEvent) {
    event.preventDefault();
    if (!editingService) return;
    try {
      const payload: Record<string, unknown> = {
        name: serviceEdit.name,
        branch: serviceEdit.branch,
        enabled: serviceEdit.enabled,
        templateKey: serviceEdit.templateKey,
      };
      if (editingService.type === 'PM2') payload.pm2ProcessName = serviceEdit.pm2ProcessName;
      else payload.deployDirectory = serviceEdit.deployDirectory;

      const response = await fetch(`${apiUrl}/admin/services/${editingService.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload),
      });
      const data = await responseJson<{ service?: Service; message?: string }>(response);
      if (!response.ok) throw new Error(data.message || 'Unable to update service');
      setNotice(`Service ${data.service?.name || serviceEdit.name} updated.`);
      closeEditService();
      await refresh();
      onChanged?.();
    } catch (reason) {
      setNotice(errorMessage(reason, 'Unable to update service'));
    }
  }

  async function deleteService(service: Service) {
    if (!window.confirm(`Delete ${service.name}? Its deployment history will also be removed.`)) return;
    try {
      const response = await fetch(`${apiUrl}/admin/services/${service.id}`, { method: 'DELETE', headers });
      const data = await responseJson<{ message?: string }>(response);
      if (!response.ok) throw new Error(data.message || 'Unable to delete service');
      setNotice(`Service ${service.name} deleted.`);
      if (editingService?.id === service.id) closeEditService();
      await refresh();
      onChanged?.();
    } catch (reason) {
      setNotice(errorMessage(reason, 'Unable to delete service'));
    }
  }

  function openCreateAccess() {
    setEditingAccess(null);
    setAccessForm(emptyAccessForm());
    setModal('access');
  }

  function changeAccessType(type: AccessType) {
    setAccessForm((current) => ({
      ...current,
      type,
      port: type === 'SFTP' ? 22 : 5432,
      sslMode: type === 'DATABASE' ? current.sslMode || 'Prefer' : '',
    }));
  }

  function buildAccessPayload() {
    const payload: Record<string, unknown> = {
      clientId: accessForm.clientId,
      type: accessForm.type,
      label: accessForm.label,
      host: accessForm.host,
      port: accessForm.port,
      username: accessForm.username,
      notes: accessForm.notes,
      enabled: accessForm.enabled,
    };
    if (accessForm.type === 'SFTP') {
      payload.path = accessForm.path;
    } else {
      payload.databaseName = accessForm.databaseName;
      payload.sslMode = accessForm.sslMode || 'Prefer';
    }
    return payload;
  }

  async function createAccess(event: FormEvent) {
    event.preventDefault();
    try {
      const response = await fetch(`${apiUrl}/admin/access`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...buildAccessPayload(), password: accessForm.password }),
      });
      const data = await responseJson<{ access?: ClientAccess; message?: string }>(response);
      if (!response.ok || !data.access) throw new Error(data.message || 'Unable to create access credentials');
      setNotice(`Access ${data.access.label} created for ${data.access.client?.name || 'client'}.`);
      setModal(null);
      setAccessForm(emptyAccessForm());
      await refresh();
      onChanged?.();
    } catch (reason) {
      setNotice(errorMessage(reason, 'Unable to create access credentials'));
    }
  }

  function openEditAccess(access: ClientAccess) {
    setEditingAccess(access);
    setAccessForm({
      clientId: access.clientId,
      type: access.type,
      label: access.label,
      host: access.host,
      port: access.port,
      username: access.username,
      password: '',
      path: access.path || '',
      databaseName: access.databaseName || '',
      sslMode: access.sslMode || 'Prefer',
      notes: access.notes || '',
      enabled: access.enabled,
    });
    setModal('edit-access');
  }

  async function saveAccess(event: FormEvent) {
    event.preventDefault();
    if (!editingAccess) return;
    try {
      const payload = buildAccessPayload();
      delete payload.clientId;
      if (accessForm.password) payload.password = accessForm.password;
      const response = await fetch(`${apiUrl}/admin/access/${editingAccess.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload),
      });
      const data = await responseJson<{ access?: ClientAccess; message?: string }>(response);
      if (!response.ok || !data.access) throw new Error(data.message || 'Unable to update access credentials');
      setNotice(`Access ${data.access.label} updated.`);
      closeAccessModal();
      await refresh();
      onChanged?.();
    } catch (reason) {
      setNotice(errorMessage(reason, 'Unable to update access credentials'));
    }
  }

  function viewAccess(access: ClientAccess) {
    setViewingAccess(access);
    setModal('view-access');
  }

  function closeAccessModal() {
    setModal(null);
    setEditingAccess(null);
    setViewingAccess(null);
  }

  async function deleteAccess(access: ClientAccess) {
    if (!window.confirm(`Delete ${access.label} for ${access.client?.name || 'this client'}?`)) return;
    try {
      const response = await fetch(`${apiUrl}/admin/access/${access.id}`, { method: 'DELETE', headers });
      const data = await responseJson<{ message?: string }>(response);
      if (!response.ok) throw new Error(data.message || 'Unable to delete access credentials');
      setNotice(`Access ${access.label} deleted.`);
      if (editingAccess?.id === access.id) closeAccessModal();
      await refresh();
      onChanged?.();
    } catch (reason) {
      setNotice(errorMessage(reason, 'Unable to delete access credentials'));
    }
  }

  function renderAccessFields(mode: 'create' | 'edit') {
    const isCreate = mode === 'create';
    return (
      <div className="form-columns">
        <label>
          Client
          <select
            value={accessForm.clientId}
            onChange={(event) => setAccessForm({ ...accessForm, clientId: event.target.value })}
            required={isCreate}
            disabled={!isCreate}
          >
            <option value="">Choose client</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Access type
          <select value={accessForm.type} onChange={(event) => changeAccessType(event.target.value as AccessType)}>
            <option value="SFTP">FileZilla / SFTP</option>
            <option value="DATABASE">PostgreSQL database</option>
          </select>
        </label>
        <label>
          Label
          <input
            placeholder={accessForm.type === 'SFTP' ? 'FileZilla SFTP' : 'PostgreSQL read/write'}
            value={accessForm.label}
            onChange={(event) => setAccessForm({ ...accessForm, label: event.target.value })}
            required
          />
        </label>
        <label>
          Host
          <input placeholder="187.127.189.231" value={accessForm.host} onChange={(event) => setAccessForm({ ...accessForm, host: event.target.value })} required />
        </label>
        <label>
          Port
          <input
            type="number"
            min="1"
            max="65535"
            value={accessForm.port}
            onChange={(event) => setAccessForm({ ...accessForm, port: Number(event.target.value) })}
            required
          />
        </label>
        <label>
          Username
          <input
            placeholder={accessForm.type === 'SFTP' ? 'rathinam_client' : 'rathinam_pgadmin'}
            value={accessForm.username}
            onChange={(event) => setAccessForm({ ...accessForm, username: event.target.value })}
            required
          />
        </label>
        <label>
          Password {!isCreate && <span>(leave blank to keep current)</span>}
          <input
            type="password"
            placeholder={isCreate ? 'Set a password' : 'Keep the current password'}
            value={accessForm.password}
            onChange={(event) => setAccessForm({ ...accessForm, password: event.target.value })}
            required={isCreate}
          />
        </label>
        {accessForm.type === 'SFTP' ? (
          <label>
            Path
            <input
              placeholder="/rathinam-projects/"
              value={accessForm.path}
              onChange={(event) => setAccessForm({ ...accessForm, path: event.target.value })}
              required
            />
          </label>
        ) : (
          <>
            <label>
              Maintenance database
              <input
                placeholder="nextup_db"
                value={accessForm.databaseName}
                onChange={(event) => setAccessForm({ ...accessForm, databaseName: event.target.value })}
                required
              />
            </label>
            <label>
              SSL mode
              <input
                placeholder="Prefer"
                value={accessForm.sslMode}
                onChange={(event) => setAccessForm({ ...accessForm, sslMode: event.target.value })}
              />
            </label>
          </>
        )}
        <label>
          Status
          <select
            value={accessForm.enabled ? 'true' : 'false'}
            onChange={(event) => setAccessForm({ ...accessForm, enabled: event.target.value === 'true' })}
          >
            <option value="true">Enabled</option>
            <option value="false">Disabled</option>
          </select>
        </label>
        <label className="form-wide">
          Notes <span>(optional)</span>
          <textarea
            rows={3}
            placeholder="Read/write access to the client project folder."
            value={accessForm.notes}
            onChange={(event) => setAccessForm({ ...accessForm, notes: event.target.value })}
          />
        </label>
      </div>
    );
  }

  async function saveRetention(event: FormEvent) {
    event.preventDefault();
    try {
      const response = await fetch(`${apiUrl}/admin/settings`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ logRetentionDays: retention }),
      });
      const data = await responseJson<{ logRetentionDays?: number; message?: string }>(response);
      if (!response.ok) throw new Error(data.message || 'Unable to save settings');
      setNotice(`Log retention set to ${data.logRetentionDays} days.`);
      setModal(null);
    } catch (reason) {
      setNotice(errorMessage(reason, 'Unable to save settings'));
    }
  }

  return (
    <section className="admin-panel">
      <div className="admin-heading">
        <div>
          <p className="eyebrow">SUPER ADMIN</p>
          <h2>Administration</h2>
          <p className="muted">Manage your active clients, agents, and services from one place.</p>
        </div>
        <div className="admin-actions">
          <button onClick={() => setModal('client')}>+ Client</button>
          <button onClick={() => setModal('agent')}>+ VPS agent</button>
          <button onClick={() => setModal('service')}>+ Service</button>
          <button onClick={openCreateAccess}>+ Access</button>
          <button className="secondary" onClick={() => setModal('settings')}>
            Settings
          </button>
        </div>
      </div>
      {notice && <p className="message admin-notice">{notice}</p>}
      <div className="admin-lists">
        <div className="active-list">
          <div className="list-heading">
            <div>
              <span className="list-kicker">ACCOUNTS</span>
              <h3>Clients</h3>
            </div>
            <span className="list-count">{clients.length}</span>
          </div>
          {clients.length === 0 ? (
            <p className="muted">No clients yet.</p>
          ) : (
            clients.map((client) => (
              <div className="active-row" key={client.id}>
                <div className="avatar">{client.name.slice(0, 1).toUpperCase()}</div>
                <div>
                  <strong>{client.name}</strong>
                  <small>{client.email}</small>
                </div>
                <span className="row-meta">
                  {client._count.services} services / {client._count.accessEntries ?? 0} access
                </span>
              </div>
            ))
          )}
        </div>

        <div className="active-list">
          <div className="list-heading">
            <div>
              <span className="list-kicker">INFRASTRUCTURE</span>
              <h3>VPS agents</h3>
            </div>
            <span className="list-count">{agents.length}</span>
          </div>
          {agents.length === 0 ? (
            <p className="muted">No agents registered.</p>
          ) : (
            agents.map((agent) => (
              <div className="active-row" key={agent.id}>
                <div className={`status-dot ${agent.enabled ? 'online' : ''}`} />
                <div>
                  <strong>{agent.name}</strong>
                  <small>{agent.baseUrl}</small>
                  <small className="agent-id">Agent ID: {agent.id}</small>
                </div>
                <span className="row-meta">{agent.enabled ? 'Enabled' : 'Disabled'}</span>
                <button className="secondary row-action" onClick={() => regenerateAgentToken(agent.id)}>
                  New token
                </button>
              </div>
            ))
          )}
        </div>

        <div className="active-list admin-services">
          <div className="list-heading">
            <div>
              <span className="list-kicker">DEPLOYMENTS</span>
              <h3>Services</h3>
            </div>
            <span className="list-count">{services.length}</span>
          </div>
          {services.length === 0 ? (
            <p className="muted">No services registered.</p>
          ) : (
            services.map((service) => (
              <div className="active-row" key={service.id}>
                <div className={`status-dot ${service.enabled ? 'online' : ''}`} />
                <div>
                  <strong>{service.name}</strong>
                  <small>
                    {service.client?.name || 'No client'} / {service.agent?.name || 'No agent'} /{' '}
                    {service.type.replace('_', ' ')} / {service.branch}
                  </small>
                </div>
                <span className="row-meta">{service.enabled ? 'Enabled' : 'Disabled'}</span>
                <div className="row-actions">
                  <button onClick={() => openEditService(service)}>Edit</button>
                  <button onClick={() => deleteService(service)}>Delete</button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="active-list admin-access">
          <div className="list-heading">
            <div>
              <span className="list-kicker">CLIENT ACCESS</span>
              <h3>FileZilla & database credentials</h3>
            </div>
            <span className="list-count">{accessEntries.length}</span>
          </div>
          {accessError && <p className="error">{accessError}</p>}
          {accessEntries.length === 0 ? (
            <p className="muted">No client access credentials have been created.</p>
          ) : (
            accessEntries.map((access) => (
              <div className="active-row" key={access.id}>
                <span className={`access-type-badge ${access.type === 'DATABASE' ? 'database' : 'sftp'}`}>
                  {access.type === 'DATABASE' ? 'DB' : 'SFTP'}
                </span>
                <div>
                  <strong>{access.label}</strong>
                  <small>
                    {access.client?.name || 'Unknown client'} / {access.host}:{access.port} / {access.username}
                  </small>
                </div>
                <span className="row-meta">{access.enabled ? 'Enabled' : 'Disabled'}</span>
                <div className="row-actions">
                  <button onClick={() => viewAccess(access)}>View</button>
                  <button onClick={() => openEditAccess(access)}>Edit</button>
                  <button onClick={() => deleteAccess(access)}>Delete</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Modal open={modal === 'client'} title="Create client" subtitle="Issue a secure temporary login for a new client." onClose={() => setModal(null)}>
        <form className="modal-form" onSubmit={createClient}>
          <label>
            Client name
            <input placeholder="Rathinam College" value={clientForm.name} onChange={(event) => setClientForm({ ...clientForm, name: event.target.value })} required />
          </label>
          <label>
            Email address
            <input placeholder="admin@client.com" type="email" value={clientForm.email} onChange={(event) => setClientForm({ ...clientForm, email: event.target.value })} required />
          </label>
          <label>
            Temporary password <span>(optional)</span>
            <input placeholder="Auto-generate securely" value={clientForm.temporaryPassword} onChange={(event) => setClientForm({ ...clientForm, temporaryPassword: event.target.value })} />
          </label>
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={() => setModal(null)}>
              Cancel
            </button>
            <button type="submit">Create client</button>
          </div>
        </form>
      </Modal>

      <Modal open={modal === 'agent'} title="Register VPS agent" subtitle="Connect a managed VPS to the HexTorq control plane." onClose={() => setModal(null)}>
        <form className="modal-form" onSubmit={createAgent}>
          <label>
            Agent name
            <input placeholder="Production VPS 01" value={agentForm.name} onChange={(event) => setAgentForm({ ...agentForm, name: event.target.value })} required />
          </label>
          <label>
            Agent base URL
            <input placeholder="https://agent.example.com" type="url" value={agentForm.baseUrl} onChange={(event) => setAgentForm({ ...agentForm, baseUrl: event.target.value })} required />
          </label>
          <p className="form-hint">The enrollment token will be shown once after creation.</p>
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={() => setModal(null)}>
              Cancel
            </button>
            <button type="submit">Register agent</button>
          </div>
        </form>
      </Modal>

      <Modal open={modal === 'service'} title="Register service" subtitle="Assign a deployment service to a client and VPS agent." onClose={() => setModal(null)}>
        <form className="modal-form" onSubmit={createService}>
          <div className="form-columns">
            <label>
              Service name
              <input placeholder="CCTV Backend" value={serviceForm.name} onChange={(event) => {
                const name = event.target.value;
                setServiceForm((current) => ({ ...current, name, slug: current.repositoryUrl ? liveRepositorySlug(current.repositoryUrl) : toSlug(name) }));
              }} required />
            </label>
            <label>
              Slug
              <input placeholder="cctv-backend" value={serviceForm.slug} readOnly required />
            </label>
            <label>
              Service type
              <select value={serviceForm.type} onChange={(event) => setServiceForm({ ...serviceForm, type: event.target.value as ServiceType })}>
                <option value="PM2">PM2 backend</option>
                <option value="STATIC_FRONTEND">Static frontend</option>
              </select>
            </label>
            <label>
              Template
              <select value={serviceForm.templateKey} onChange={(event) => setServiceForm({ ...serviceForm, templateKey: event.target.value })}>
                <option value="">Custom commands</option>
                {templates
                  .filter((template) => template.type === serviceForm.type)
                  .map((template) => (
                    <option key={template.key} value={template.key}>
                      {template.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Project key / webhook
              <input placeholder="Rathinam_CCTV_Backend" value={serviceForm.projectKey} onChange={(event) => setServiceForm({ ...serviceForm, projectKey: event.target.value })} required />
            </label>
            <label>
              Repository URL
              <input placeholder="https://github.com/..." type="url" value={serviceForm.repositoryUrl} onChange={(event) => {
                const repositoryUrl = event.target.value;
                setServiceForm((current) => ({ ...current, repositoryUrl, slug: liveRepositorySlug(repositoryUrl) || toSlug(current.name) }));
              }} onBlur={(event) => void loadRepositoryMetadata(event.target.value)} required />
            </label>
            <label>
              Full webhook URL
              <input placeholder="Select an agent and enter a project key" type="url" value={serviceForm.webhookUrl} readOnly required />
            </label>
            <label>
              Working directory
              <input placeholder="/home/mohan/SERVER/app" value={serviceForm.workingDirectory} onChange={(event) => setServiceForm({ ...serviceForm, workingDirectory: event.target.value })} required />
            </label>
            <label>
              Branch
              <input placeholder="Detected default branch" value={serviceForm.branch} onChange={(event) => setServiceForm({ ...serviceForm, branch: event.target.value })} />
            </label>
            {serviceForm.type === 'PM2' ? (
              <label>
                PM2 process name
                <select value={serviceForm.pm2ProcessName} onChange={(event) => setServiceForm({ ...serviceForm, pm2ProcessName: event.target.value })} required>
                  <option value="">Choose PM2 process</option>
                  {pm2Processes.map((process) => <option key={process.name} value={process.name}>{process.name} ({process.status || 'unknown'})</option>)}
                </select>
              </label>
            ) : (
              <label>
                Static deploy directory
                <input placeholder="/usr/share/nginx/html/site" value={serviceForm.deployDirectory} onChange={(event) => setServiceForm({ ...serviceForm, deployDirectory: event.target.value })} required />
              </label>
            )}
            <label>
              Client
              <select value={serviceForm.clientId} onChange={(event) => setServiceForm({ ...serviceForm, clientId: event.target.value })} required>
                <option value="">Choose client</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              VPS agent
              <select value={serviceForm.agentId} onChange={(event) => setServiceForm({ ...serviceForm, agentId: event.target.value })} required>
                <option value="">Choose agent</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={() => setModal(null)}>
              Cancel
            </button>
            <button type="submit">Register service</button>
          </div>
        </form>
      </Modal>

      <Modal open={modal === 'edit-service'} title="Edit service" subtitle="Update the service metadata used for deployment." onClose={closeEditService}>
        <form className="modal-form" onSubmit={saveService}>
          <div className="form-columns">
            <label>
              Service name
              <input value={serviceEdit.name} onChange={(event) => setServiceEdit({ ...serviceEdit, name: event.target.value })} required minLength={2} />
            </label>
            <label>
              Branch
              <input value={serviceEdit.branch} onChange={(event) => setServiceEdit({ ...serviceEdit, branch: event.target.value })} required />
            </label>
            <label>
              Template
              <select value={serviceEdit.templateKey} onChange={(event) => setServiceEdit({ ...serviceEdit, templateKey: event.target.value })}>
                <option value="">Custom commands</option>
                {templates
                  .filter((template) => template.type === editingService?.type)
                  .map((template) => (
                    <option key={template.key} value={template.key}>
                      {template.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Status
              <select value={serviceEdit.enabled ? 'true' : 'false'} onChange={(event) => setServiceEdit({ ...serviceEdit, enabled: event.target.value === 'true' })}>
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </select>
            </label>
            {editingService?.type === 'PM2' ? (
              <label>
                PM2 process name
                <input value={serviceEdit.pm2ProcessName} onChange={(event) => setServiceEdit({ ...serviceEdit, pm2ProcessName: event.target.value })} required />
              </label>
            ) : (
              <label>
                Static deploy directory
                <input value={serviceEdit.deployDirectory} onChange={(event) => setServiceEdit({ ...serviceEdit, deployDirectory: event.target.value })} required />
              </label>
            )}
          </div>
          <p className="form-hint">Repository URL, project key, service type, client, and VPS agent are fixed after registration.</p>
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={closeEditService}>
              Cancel
            </button>
            <button type="submit">Save changes</button>
          </div>
        </form>
      </Modal>

      <Modal
        open={modal === 'access'}
        title="Add client access"
        subtitle="Create a FileZilla/SFTP or PostgreSQL credential entry for a client."
        onClose={closeAccessModal}
      >
        <form className="modal-form" onSubmit={createAccess}>
          {renderAccessFields('create')}
          <p className="form-hint">The client can view this entry from their console. Passwords are encrypted at rest.</p>
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={closeAccessModal}>
              Cancel
            </button>
            <button type="submit">Add access</button>
          </div>
        </form>
      </Modal>

      <Modal
        open={modal === 'edit-access'}
        title="Edit client access"
        subtitle="Update the connection details shown to this client."
        onClose={closeAccessModal}
      >
        <form className="modal-form" onSubmit={saveAccess}>
          {renderAccessFields('edit')}
          <p className="form-hint">Leave the password blank to keep the existing password. The client and access owner cannot be changed.</p>
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={closeAccessModal}>
              Cancel
            </button>
            <button type="submit">Save changes</button>
          </div>
        </form>
      </Modal>

      <Modal
        open={modal === 'view-access'}
        title="Client access credentials"
        subtitle="Connection details visible to this client."
        onClose={closeAccessModal}
      >
        {viewingAccess ? (
          <div className="access-grid single">
            <AccessEntryCard entry={viewingAccess} />
          </div>
        ) : (
          <p className="muted">Access entry not found.</p>
        )}
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={closeAccessModal}>
            Close
          </button>
        </div>
      </Modal>

      <Modal open={modal === 'settings'} title="Console settings" subtitle="Control deployment log retention for all services." onClose={() => setModal(null)}>
        <form className="modal-form" onSubmit={saveRetention}>
          <label>
            Deployment log retention <span>(days)</span>
            <input type="number" min="1" max="3650" value={retention} onChange={(event) => setRetention(Number(event.target.value))} required />
          </label>
          <p className="form-hint">Deployment metadata remains permanent. Only log entries are removed.</p>
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={() => setModal(null)}>
              Cancel
            </button>
            <button type="submit">Save settings</button>
          </div>
        </form>
      </Modal>
    </section>
  );
}

function Modal({ open, title, subtitle, onClose, children }: { open: boolean; title: string; subtitle: string; onClose: () => void; children: ReactNode }) {
  if (!open) return null;
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="modal-card" role="dialog" aria-modal="true" aria-label={title}>
        <button className="modal-close" aria-label="Close" onClick={onClose}>
          x
        </button>
        <p className="eyebrow">HEX TORQ CLOUD</p>
        <h2>{title}</h2>
        <p className="modal-subtitle">{subtitle}</p>
        {children}
      </section>
    </div>
  );
}

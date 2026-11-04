'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import AccessEntryCard from './AccessEntryCard';
import AdminPanel from './AdminPanel';
import AppShell from './AppShell';
import Modal from './Modal';
import OverviewView from './OverviewView';
import WebhookHealthPanel from './WebhookHealthPanel';
import { apiUrl, errorMessage, responseJson, TOKEN_KEY } from '../lib/api';
import { intervalLabel, parseLogEvent, scheduleHourLabel } from '../lib/format';
import { emptyAccessForm } from '../lib/forms';
import type {
  ClientAccess,
  Deployment,
  DeploymentLog,
  FailureAlert,
  Pm2LogEntry,
  Pm2Status,
  Service,
  WebhookHealthData,
  WebhookHealthRun,
  WebhookSchedule,
} from '../types/api';
function Dashboard({ token, role, email }: { token: string; role: string; email?: string }) {
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

  const selectedDeploymentRecord = deployments.find((deployment) => deployment.id === selectedDeployment);

  return (
    <AppShell role={role} email={email} alertCount={failureAlerts.length} onSignOut={signOut}>
      {role === 'SUPER_ADMIN' && <AdminPanel token={token} onChanged={loadDashboard} />}

      <OverviewView
        services={services}
        deployments={deployments}
        pm2Status={pm2Status}
        health={health}
        healthLoading={healthLoading}
        healthError={healthError}
        healthRunLoading={healthRunLoading}
        failureAlerts={failureAlerts}
        onDeploy={deploy}
        deploying={deploying}
        onHealthSettings={openHealthSettings}
        onRunHealth={runWebhookHealth}
        onAccess={() => setAccessOpen(true)}
      />
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
            <pre className="deployment-detail-log">
              {deploymentLogs.map((log) => `[${new Date(log.timestamp).toLocaleString()}] ${log.message}`).join('\n') ||
                'Waiting for deployment logs.'}
            </pre>
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
    </AppShell>
  );
}

export default Dashboard;

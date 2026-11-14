'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import type { Agent, Client, Service, AdminPm2Metrics } from '../../types/api';
import { apiUrl, errorMessage, responseJson } from '../../lib/api';
import Modal from '../Modal';

type AdminResourcesSectionProps = {
  token: string;
  agents: Agent[];
  services: Service[];
  clients: Client[];
  onOpenLogs?: (service: Service) => void;
};

type StatusFilter = 'ALL' | 'ONLINE' | 'STOPPED' | 'ERRORED' | 'UNAVAILABLE';

function formatMemory(bytes?: number | null, mb?: number | null): string {
  if (typeof mb === 'number' && Number.isFinite(mb)) {
    return `${mb.toFixed(1)} MB`;
  }
  if (typeof bytes === 'number' && Number.isFinite(bytes)) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
  return '—';
}

function formatCpu(cpu?: number | null): string {
  if (typeof cpu === 'number' && Number.isFinite(cpu)) {
    return `${cpu.toFixed(1)}%`;
  }
  return '—';
}

function formatUptime(uptimeMsOrTimestamp?: number | null): string {
  if (!uptimeMsOrTimestamp || uptimeMsOrTimestamp <= 0) return '—';
  // PM2 uptime can be an elapsed duration in ms or a start timestamp in ms
  const isTimestamp = uptimeMsOrTimestamp > 1000000000;
  const elapsedSeconds = isTimestamp
    ? Math.max(0, Math.floor((Date.now() - uptimeMsOrTimestamp) / 1000))
    : Math.max(0, Math.floor(uptimeMsOrTimestamp / 1000));

  if (elapsedSeconds < 60) return `${elapsedSeconds}s`;
  const minutes = Math.floor(elapsedSeconds / 60);
  if (minutes < 60) return `${minutes}m ${elapsedSeconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

function formatRelativeTime(dateString?: string | null): string {
  if (!dateString) return 'never';
  const elapsed = Math.max(0, Math.floor((Date.now() - new Date(dateString).getTime()) / 1000));
  if (elapsed < 10) return 'just now';
  if (elapsed < 60) return `${elapsed}s ago`;
  const minutes = Math.floor(elapsed / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export default function AdminResourcesSection({
  token,
  agents,
  services,
  clients,
  onOpenLogs,
}: AdminResourcesSectionProps) {
  const [metrics, setMetrics] = useState<Record<string, AdminPm2Metrics>>({});
  const [loading, setLoading] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('ALL');
  const [agentFilter, setAgentFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Agent inspection modal
  const [inspectAgent, setInspectAgent] = useState<Agent | null>(null);

  // PM2 process action confirmation
  const [pm2ActionTarget, setPm2ActionTarget] = useState<{
    service: Service;
    action: 'start' | 'stop' | 'restart' | 'reload';
  } | null>(null);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionNotice, setActionNotice] = useState('');

  const pm2Services = useMemo(() => services.filter((s) => s.type === 'PM2' && s.pm2ProcessName), [services]);

  const fetchMetrics = useCallback(async () => {
    if (pm2Services.length === 0) return;
    setLoading(true);
    const updated: Record<string, AdminPm2Metrics> = {};

    // Try batching per agent first if available, otherwise fetch per service
    const onlineAgents = agents.filter((a) => a.status === 'online');
    const agentBatchPromises = onlineAgents.map(async (agent) => {
      try {
        const res = await fetch(`${apiUrl}/admin/agents/${agent.id}/pm2/statuses`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await responseJson<{
            available: boolean;
            processes?: Array<{
              serviceId: string;
              processName: string;
              status: string | null;
              cpuPercent: number | null;
              memoryBytes: number | null;
              restarts: number | null;
              uptime: number | null;
            }>;
            reason?: string;
          }>(res);

          if (data.available && Array.isArray(data.processes)) {
            data.processes.forEach((proc) => {
              updated[proc.serviceId] = {
                serviceId: proc.serviceId,
                agentId: agent.id,
                processName: proc.processName,
                status: proc.status,
                cpuPercent: proc.cpuPercent,
                memoryBytes: proc.memoryBytes,
                memoryMb: proc.memoryBytes ? Math.round((proc.memoryBytes / 1024 / 1024) * 100) / 100 : null,
                restarts: proc.restarts,
                uptime: proc.uptime,
                available: true,
                collectedAt: new Date().toISOString(),
              };
            });
          }
        }
      } catch {
        // Fall back to individual fetches
      }
    });

    await Promise.all(agentBatchPromises);

    // For any PM2 services not resolved by agent batches, query individually
    const remainingServices = pm2Services.filter((s) => !updated[s.id]);
    const servicePromises = remainingServices.map(async (service) => {
      try {
        const res = await fetch(`${apiUrl}/admin/services/${service.id}/pm2/metrics`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await responseJson<AdminPm2Metrics>(res);
          updated[service.id] = data;
        } else {
          updated[service.id] = {
            serviceId: service.id,
            processName: service.pm2ProcessName || service.name,
            available: false,
            reason: service.agent?.status !== 'online' ? 'Agent offline' : 'Metrics endpoint unavailable',
          };
        }
      } catch {
        updated[service.id] = {
          serviceId: service.id,
          processName: service.pm2ProcessName || service.name,
          available: false,
          reason: 'Network error',
        };
      }
    });

    await Promise.all(servicePromises);
    setMetrics(updated);
    setLastRefreshedAt(new Date());
    setLoading(false);
  }, [pm2Services, agents, token]);

  useEffect(() => {
    void fetchMetrics();
  }, [fetchMetrics]);

  // Polling timer
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      void fetchMetrics();
    }, 12000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchMetrics]);

  // Execute PM2 action (Super Admin)
  async function executePm2Action() {
    if (!pm2ActionTarget) return;
    const { service, action } = pm2ActionTarget;
    setActionInProgress(true);
    setActionError('');
    setActionNotice('');

    try {
      const res = await fetch(`${apiUrl}/services/${service.id}/pm2/${action}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await responseJson<{ message?: string }>(res);
      if (!res.ok) {
        throw new Error(data.message || `Failed to ${action} process`);
      }
      setActionNotice(`Successfully signaled ${action} for ${service.pm2ProcessName || service.name}.`);
      setPm2ActionTarget(null);
      // Wait a moment for process state to update, then refresh
      setTimeout(() => {
        void fetchMetrics();
      }, 1500);
    } catch (err) {
      setActionError(errorMessage(err, `Failed to execute ${action}`));
    } finally {
      setActionInProgress(false);
    }
  }

  // Filtered PM2 services
  const filteredServices = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pm2Services.filter((service) => {
      const metric = metrics[service.id];
      const runtimeStatus = metric?.status?.toLowerCase() || (service.agent?.status === 'online' ? 'unknown' : 'offline');

      // Status filter
      if (statusFilter === 'ONLINE' && runtimeStatus !== 'online') return false;
      if (statusFilter === 'STOPPED' && runtimeStatus !== 'stopped') return false;
      if (statusFilter === 'ERRORED' && runtimeStatus !== 'errored') return false;
      if (statusFilter === 'UNAVAILABLE' && (metric?.available !== false && runtimeStatus !== 'offline')) return false;

      // Client filter
      if (clientFilter !== 'ALL' && service.client?.id !== clientFilter) return false;

      // Agent filter
      if (agentFilter !== 'ALL' && service.agent?.id !== agentFilter) return false;

      // Search query
      if (q) {
        const matchesName = service.name.toLowerCase().includes(q);
        const matchesProcess = (service.pm2ProcessName || '').toLowerCase().includes(q);
        const matchesClient = (service.client?.name || '').toLowerCase().includes(q);
        const matchesAgent = (service.agent?.name || '').toLowerCase().includes(q);
        if (!matchesName && !matchesProcess && !matchesClient && !matchesAgent) return false;
      }

      return true;
    });
  }, [pm2Services, metrics, search, statusFilter, clientFilter, agentFilter]);

  // Fleet summary KPIs
  const kpis = useMemo(() => {
    let onlineCount = 0;
    let stoppedCount = 0;
    let erroredCount = 0;
    let totalCpu = 0;
    let totalMemoryBytes = 0;
    let countedCpu = 0;

    pm2Services.forEach((s) => {
      const m = metrics[s.id];
      if (m?.status === 'online') onlineCount++;
      else if (m?.status === 'stopped') stoppedCount++;
      else if (m?.status === 'errored') erroredCount++;

      if (typeof m?.cpuPercent === 'number' && Number.isFinite(m.cpuPercent)) {
        totalCpu += m.cpuPercent;
        countedCpu++;
      }
      if (typeof m?.memoryBytes === 'number' && Number.isFinite(m.memoryBytes)) {
        totalMemoryBytes += m.memoryBytes;
      }
    });

    return {
      total: pm2Services.length,
      online: onlineCount,
      stopped: stoppedCount,
      errored: erroredCount,
      avgCpu: countedCpu > 0 ? (totalCpu / countedCpu).toFixed(1) + '%' : '—',
      totalRamMb: totalMemoryBytes > 0 ? `${(totalMemoryBytes / 1024 / 1024).toFixed(0)} MB` : '—',
    };
  }, [pm2Services, metrics]);

  return (
    <div className="active-list" id="admin-resources">
      {/* Heading */}
      <div className="list-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span className="list-kicker">INFRASTRUCTURE TELEMETRY (SUPER ADMIN ONLY)</span>
          <h3>Resource Monitoring & PM2 Fleet</h3>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            className="secondary row-action"
            onClick={() => setAutoRefresh(!autoRefresh)}
            title={autoRefresh ? 'Auto-refresh active (every 12s)' : 'Auto-refresh paused'}
          >
            {autoRefresh ? '● Auto-refreshing' : '○ Paused'}
          </button>
          <button
            type="button"
            className="secondary row-action"
            onClick={() => void fetchMetrics()}
            disabled={loading}
          >
            {loading ? 'Polling…' : '↻ Refresh'}
          </button>
        </div>
      </div>

      <p className="muted admin-section__intro">
        Live CPU utilization, RAM consumption, process lifecycles, and restart counters across all connected VPS agents.
        {lastRefreshedAt && (
          <span style={{ marginLeft: '8px', color: 'var(--ht-text-muted)' }}>
            Updated {lastRefreshedAt.toLocaleTimeString()}
          </span>
        )}
      </p>

      {actionNotice && <div className="admin-notice">{actionNotice}</div>}
      {actionError && <div className="admin-notice" style={{ borderColor: 'var(--ht-danger-line)', background: 'var(--ht-danger-fill)', color: 'var(--ht-danger)' }}>{actionError}</div>}

      {/* Overview Cards (KPIs) */}
      <div className="admin-metrics" style={{ marginBottom: '24px' }}>
        <div className="admin-metric">
          <div className="admin-metric__icon admin-metric__icon--blue">⚡</div>
          <div>
            <strong>{kpis.total}</strong>
            <span>PM2 Processes</span>
            <small>{kpis.online} running · {kpis.stopped} stopped</small>
          </div>
        </div>
        <div className="admin-metric">
          <div className="admin-metric__icon">✓</div>
          <div>
            <strong>{kpis.online}</strong>
            <span>Online Processes</span>
            <small>{kpis.errored > 0 ? `${kpis.errored} errored` : '0 errors across fleet'}</small>
          </div>
        </div>
        <div className="admin-metric">
          <div className="admin-metric__icon admin-metric__icon--amber">⚙</div>
          <div>
            <strong>{kpis.avgCpu}</strong>
            <span>Avg PM2 CPU</span>
            <small>Across reported processes</small>
          </div>
        </div>
        <div className="admin-metric">
          <div className="admin-metric__icon admin-metric__icon--purple">▦</div>
          <div>
            <strong>{kpis.totalRamMb}</strong>
            <span>Total PM2 RAM</span>
            <small>Across active runtimes</small>
          </div>
        </div>
      </div>

      {/* VPS Agent Fleet Health */}
      <div style={{ marginBottom: '28px' }}>
        <h4 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 600, color: 'var(--ht-text)' }}>
          VPS Agent Fleet Overview ({agents.length})
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
          {agents.map((agent) => {
            const agentServices = pm2Services.filter((s) => s.agent?.id === agent.id);
            const isOnline = agent.status === 'online';
            return (
              <div
                key={agent.id}
                style={{
                  border: '1px solid var(--ht-line)',
                  borderRadius: 'var(--ht-radius-md)',
                  padding: '14px',
                  background: 'var(--ht-card)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      className={`status-dot ${isOnline ? 'online' : agent.status === 'disabled' ? 'disabled' : ''}`}
                    />
                    <strong style={{ fontSize: '13px' }}>{agent.name}</strong>
                  </div>
                  <span className="admin-agent-status" data-status={agent.status || 'unknown'}>
                    {agent.status || 'unknown'}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--ht-text-muted)', fontFamily: 'var(--ht-font-mono)' }}>
                  {agent.baseUrl}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', fontSize: '11px', color: 'var(--ht-text-secondary)' }}>
                  <span>{agentServices.length} PM2 service{agentServices.length === 1 ? '' : 's'}</span>
                  <span>Seen {formatRelativeTime(agent.lastSeenAt)}</span>
                </div>
                <button
                  type="button"
                  className="secondary"
                  style={{ marginTop: '4px', height: '26px', fontSize: '10px' }}
                  onClick={() => setInspectAgent(agent)}
                >
                  Inspect VPS & Processes
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* PM2 Table Filters Toolbar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
          padding: '12px',
          border: '1px solid var(--ht-line)',
          borderRadius: 'var(--ht-radius-md)',
          background: 'var(--ht-nav)',
        }}
      >
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="search"
            placeholder="Search service or process..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: '6px 10px',
              fontSize: '12px',
              borderRadius: 'var(--ht-radius)',
              border: '1px solid var(--ht-line)',
              background: 'var(--ht-card)',
              color: 'var(--ht-text)',
              minWidth: '200px',
            }}
          />
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            style={{
              padding: '6px 10px',
              fontSize: '12px',
              borderRadius: 'var(--ht-radius)',
              border: '1px solid var(--ht-line)',
              background: 'var(--ht-card)',
              color: 'var(--ht-text)',
            }}
          >
            <option value="ALL">All Clients ({clients.length})</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
            style={{
              padding: '6px 10px',
              fontSize: '12px',
              borderRadius: 'var(--ht-radius)',
              border: '1px solid var(--ht-line)',
              background: 'var(--ht-card)',
              color: 'var(--ht-text)',
            }}
          >
            <option value="ALL">All Agents ({agents.length})</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '4px' }}>
          {(['ALL', 'ONLINE', 'STOPPED', 'ERRORED', 'UNAVAILABLE'] as StatusFilter[]).map((st) => (
            <button
              key={st}
              type="button"
              className={`row-action ${statusFilter === st ? 'is-active' : ''}`}
              style={statusFilter === st ? { background: 'var(--ht-primary)', color: 'var(--ht-primary-contrast)', borderColor: 'transparent' } : {}}
              onClick={() => setStatusFilter(st)}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* PM2 Resource Table */}
      <div className="ht-table-wrap" style={{ overflowX: 'auto', border: '1px solid var(--ht-line)', borderRadius: 'var(--ht-radius-md)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
          <thead>
            <tr style={{ background: 'var(--ht-elevated)', borderBottom: '1px solid var(--ht-line)', color: 'var(--ht-text-secondary)' }}>
              <th style={{ padding: '10px 14px', fontWeight: 600 }}>Service</th>
              <th style={{ padding: '10px 14px', fontWeight: 600 }}>Client</th>
              <th style={{ padding: '10px 14px', fontWeight: 600 }}>VPS Agent</th>
              <th style={{ padding: '10px 14px', fontWeight: 600 }}>PM2 Process</th>
              <th style={{ padding: '10px 14px', fontWeight: 600 }}>Status</th>
              <th style={{ padding: '10px 14px', fontWeight: 600 }}>CPU %</th>
              <th style={{ padding: '10px 14px', fontWeight: 600 }}>RAM (MB)</th>
              <th style={{ padding: '10px 14px', fontWeight: 600 }}>Restarts</th>
              <th style={{ padding: '10px 14px', fontWeight: 600 }}>Uptime</th>
              <th style={{ padding: '10px 14px', fontWeight: 600, textAlign: 'right' }}>Controls</th>
            </tr>
          </thead>
          <tbody>
            {filteredServices.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ padding: '24px', textAlign: 'center', color: 'var(--ht-text-muted)' }}>
                  No PM2 services match the current filters.
                </td>
              </tr>
            ) : (
              filteredServices.map((service) => {
                const metric = metrics[service.id];
                const runtimeStatus = metric?.status || (service.agent?.status === 'online' ? 'unknown' : 'offline');
                const isOnline = runtimeStatus === 'online';
                const isStopped = runtimeStatus === 'stopped';
                const isErrored = runtimeStatus === 'errored';
                const agentOffline = service.agent?.status !== 'online';

                return (
                  <tr
                    key={service.id}
                    style={{
                      borderBottom: '1px solid var(--ht-line-subtle)',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    {/* Service Name */}
                    <td style={{ padding: '10px 14px' }}>
                      <strong style={{ color: 'var(--ht-text)', display: 'block' }}>{service.name}</strong>
                      <span style={{ fontSize: '11px', color: 'var(--ht-text-muted)', fontFamily: 'var(--ht-font-mono)' }}>
                        {service.slug}
                      </span>
                    </td>

                    {/* Client */}
                    <td style={{ padding: '10px 14px', color: 'var(--ht-text-secondary)' }}>
                      {service.client?.name || '—'}
                    </td>

                    {/* VPS Agent */}
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span className={`status-dot ${service.agent?.status === 'online' ? 'online' : ''}`} />
                        {service.agent?.name || '—'}
                      </span>
                    </td>

                    {/* PM2 Process */}
                    <td style={{ padding: '10px 14px' }}>
                      <code style={{ fontSize: '11px', background: 'var(--ht-elevated)', padding: '2px 6px', borderRadius: '4px' }}>
                        {service.pm2ProcessName || '—'}
                      </code>
                    </td>

                    {/* Status */}
                    <td style={{ padding: '10px 14px' }}>
                      <span
                        className={`ht-pill ${isOnline ? 'ht-pill--success' : isStopped ? '' : isErrored ? 'ht-pill--danger' : ''}`}
                        style={{ fontSize: '10px', textTransform: 'uppercase' }}
                      >
                        <span className="ht-dot" />
                        {runtimeStatus}
                      </span>
                    </td>

                    {/* CPU % */}
                    <td style={{ padding: '10px 14px', fontFamily: 'var(--ht-font-mono)', fontWeight: 600, color: 'var(--ht-text)' }}>
                      {formatCpu(metric?.cpuPercent)}
                    </td>

                    {/* RAM */}
                    <td style={{ padding: '10px 14px', fontFamily: 'var(--ht-font-mono)', color: 'var(--ht-text)' }}>
                      {formatMemory(metric?.memoryBytes, metric?.memoryMb)}
                    </td>

                    {/* Restarts */}
                    <td style={{ padding: '10px 14px', fontFamily: 'var(--ht-font-mono)' }}>
                      {typeof metric?.restarts === 'number' ? (
                        <span style={metric.restarts > 5 ? { color: 'var(--ht-warning)' } : {}}>
                          {metric.restarts}
                        </span>
                      ) : '—'}
                    </td>

                    {/* Uptime */}
                    <td style={{ padding: '10px 14px', color: 'var(--ht-text-secondary)', whiteSpace: 'nowrap' }}>
                      {formatUptime(metric?.uptime)}
                    </td>

                    {/* Controls */}
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
                        <button
                          type="button"
                          className="row-action"
                          disabled={agentOffline || isOnline}
                          onClick={() => setPm2ActionTarget({ service, action: 'start' })}
                          title="Start PM2 process"
                        >
                          Start
                        </button>
                        <button
                          type="button"
                          className="row-action"
                          disabled={agentOffline || isStopped}
                          onClick={() => setPm2ActionTarget({ service, action: 'stop' })}
                          title="Stop PM2 process"
                        >
                          Stop
                        </button>
                        <button
                          type="button"
                          className="row-action"
                          disabled={agentOffline}
                          onClick={() => setPm2ActionTarget({ service, action: 'restart' })}
                          title="Restart PM2 process"
                        >
                          Restart
                        </button>
                        <button
                          type="button"
                          className="row-action"
                          disabled={agentOffline}
                          onClick={() => setPm2ActionTarget({ service, action: 'reload' })}
                          title="0-downtime cluster reload"
                        >
                          Reload
                        </button>
                        {onOpenLogs && (
                          <button
                            type="button"
                            className="row-action"
                            onClick={() => onOpenLogs(service)}
                            title="Open live logs"
                          >
                            Logs
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Inspect Agent Modal */}
      <Modal
        open={Boolean(inspectAgent)}
        title={`VPS Agent: ${inspectAgent?.name || ''}`}
        subtitle="Safe infrastructure metadata and assigned PM2 processes."
        onClose={() => setInspectAgent(null)}
      >
        {inspectAgent && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '18px' }}>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--ht-text-muted)', textTransform: 'uppercase' }}>Agent ID</span>
                <p style={{ margin: '2px 0 0', fontFamily: 'var(--ht-font-mono)', fontSize: '11px' }}>{inspectAgent.id}</p>
              </div>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--ht-text-muted)', textTransform: 'uppercase' }}>Connectivity</span>
                <p style={{ margin: '2px 0 0', fontWeight: 600 }}>
                  <span className={`status-dot ${inspectAgent.status === 'online' ? 'online' : ''}`} style={{ display: 'inline-block', marginRight: '6px' }} />
                  {inspectAgent.status || 'unknown'}
                </p>
              </div>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--ht-text-muted)', textTransform: 'uppercase' }}>Base URL</span>
                <p style={{ margin: '2px 0 0', fontFamily: 'var(--ht-font-mono)', fontSize: '11px' }}>{inspectAgent.baseUrl}</p>
              </div>
              <div>
                <span style={{ fontSize: '10px', color: 'var(--ht-text-muted)', textTransform: 'uppercase' }}>Last Heartbeat</span>
                <p style={{ margin: '2px 0 0', fontSize: '12px' }}>
                  {inspectAgent.lastSeenAt ? new Date(inspectAgent.lastSeenAt).toLocaleString() : 'Never'}
                </p>
              </div>
            </div>

            <h5 style={{ margin: '14px 0 8px', fontSize: '12px', fontWeight: 600, color: 'var(--ht-text)' }}>
              Assigned PM2 Services ({pm2Services.filter((s) => s.agent?.id === inspectAgent.id).length})
            </h5>
            <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--ht-line)', borderRadius: 'var(--ht-radius)' }}>
              {pm2Services.filter((s) => s.agent?.id === inspectAgent.id).map((s) => {
                const m = metrics[s.id];
                return (
                  <div
                    key={s.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      borderBottom: '1px solid var(--ht-line-subtle)',
                      fontSize: '11px',
                    }}
                  >
                    <div>
                      <strong>{s.name}</strong> <code>{s.pm2ProcessName}</code>
                    </div>
                    <div>
                      <span className={`ht-pill ${m?.status === 'online' ? 'ht-pill--success' : ''}`} style={{ fontSize: '9px' }}>
                        {m?.status || 'unknown'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="modal-actions" style={{ marginTop: '16px' }}>
              <button type="button" className="secondary" onClick={() => setInspectAgent(null)}>
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* PM2 Action Confirmation Modal */}
      <Modal
        open={Boolean(pm2ActionTarget)}
        title={pm2ActionTarget ? `Confirm PM2 ${pm2ActionTarget.action.toUpperCase()}?` : 'PM2 Action'}
        subtitle={pm2ActionTarget ? `Target: ${pm2ActionTarget.service.pm2ProcessName || pm2ActionTarget.service.name}` : ''}
        onClose={() => !actionInProgress && setPm2ActionTarget(null)}
      >
        {pm2ActionTarget && (
          <div>
            <p style={{ fontSize: '13px', lineHeight: '20px', color: 'var(--ht-text-secondary)', margin: '0 0 12px' }}>
              {pm2ActionTarget.action === 'stop'
                ? 'Stopping this process will terminate the running application immediately. Users will receive 502/503 errors until it is restarted.'
                : pm2ActionTarget.action === 'reload'
                ? 'Reload performs a 0-downtime cluster worker reload, replacing child processes sequentially.'
                : `Executing a ${pm2ActionTarget.action} signal will recycle the application process. Active sessions may briefly pause.`}
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary"
                disabled={actionInProgress}
                onClick={() => setPm2ActionTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={pm2ActionTarget.action === 'stop' ? 'danger-button' : ''}
                disabled={actionInProgress}
                onClick={() => void executePm2Action()}
              >
                {actionInProgress ? 'Sending signal…' : `Confirm ${pm2ActionTarget.action}`}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

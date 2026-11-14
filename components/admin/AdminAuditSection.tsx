'use client';

import { useEffect, useState, useCallback } from 'react';
import type { AuditLogEntry, AuditLogsResponse } from '../../types/api';
import { apiUrl, errorMessage, responseJson } from '../../lib/api';

type AdminAuditSectionProps = {
  token: string;
};

export default function AdminAuditSection({ token }: AdminAuditSectionProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [pageSize] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const fetchLogs = useCallback(async (targetPage = 1) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${apiUrl}/admin/audit-logs?page=${targetPage}&limit=${pageSize}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await responseJson<AuditLogsResponse & { message?: string }>(res);
      if (!res.ok) {
        throw new Error(data.message || 'Failed to load audit logs');
      }
      setLogs(data.logs || []);
      setTotal(data.total || 0);
      setPage(data.page || targetPage);
      setPageCount(data.pageCount || 1);
    } catch (err) {
      setError(errorMessage(err, 'Failed to retrieve audit log history'));
    } finally {
      setLoading(false);
    }
  }, [token, pageSize]);

  useEffect(() => {
    void fetchLogs(page);
  }, [fetchLogs, page]);

  const filteredLogs = logs.filter((log) => {
    if (actionFilter !== 'ALL' && !log.action.toLowerCase().includes(actionFilter.toLowerCase())) {
      return false;
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const matchActor = log.actorEmail.toLowerCase().includes(q);
      const matchAction = log.action.toLowerCase().includes(q);
      const matchTarget = (log.targetId || '').toLowerCase().includes(q) || (log.targetType || '').toLowerCase().includes(q);
      if (!matchActor && !matchAction && !matchTarget) return false;
    }
    return true;
  });

  function actionColor(action: string): string {
    const act = action.toUpperCase();
    if (act.includes('FAILED') || act.includes('DELETE') || act.includes('STOP')) return 'var(--ht-danger)';
    if (act.includes('PM2_START') || act.includes('SUCCESS') || act.includes('CREATE')) return 'var(--ht-success)';
    if (act.includes('RESTART') || act.includes('RELOAD') || act.includes('UPDATE')) return 'var(--ht-link)';
    return 'var(--ht-text-secondary)';
  }

  return (
    <div className="active-list" id="admin-audit-logs">
      <div className="list-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span className="list-kicker">GOVERNANCE & COMPLIANCE</span>
          <h3>Audit Log History</h3>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span className="list-count">{total} events</span>
          <button
            type="button"
            className="secondary row-action"
            onClick={() => void fetchLogs(page)}
            disabled={loading}
          >
            {loading ? 'Refreshing…' : '↻ Refresh'}
          </button>
        </div>
      </div>

      <p className="muted admin-section__intro">
        Cryptographically captured record of all deployment triggers, process controls, client access disclosures, and administrative configuration updates.
      </p>

      {error && (
        <div className="admin-notice" style={{ borderColor: 'var(--ht-danger-line)', background: 'var(--ht-danger-fill)', color: 'var(--ht-danger)' }}>
          {error}
        </div>
      )}

      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          gap: '10px',
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: '16px',
          padding: '12px',
          border: '1px solid var(--ht-line)',
          borderRadius: 'var(--ht-radius-md)',
          background: 'var(--ht-nav)',
        }}
      >
        <input
          type="search"
          placeholder="Filter by actor email, action, or target..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: '6px 10px',
            fontSize: '12px',
            borderRadius: 'var(--ht-radius)',
            border: '1px solid var(--ht-line)',
            background: 'var(--ht-card)',
            color: 'var(--ht-text)',
            minWidth: '260px',
          }}
        />

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          style={{
            padding: '6px 10px',
            fontSize: '12px',
            borderRadius: 'var(--ht-radius)',
            border: '1px solid var(--ht-line)',
            background: 'var(--ht-card)',
            color: 'var(--ht-text)',
          }}
        >
          <option value="ALL">All Actions</option>
          <option value="PM2">PM2 Process Actions</option>
          <option value="DEPLOY">Deployments</option>
          <option value="SERVICE">Services</option>
          <option value="ACCESS">Access Credentials</option>
          <option value="SETTINGS">System Settings</option>
        </select>
      </div>

      {/* Table */}
      <div className="ht-table-wrap" style={{ overflowX: 'auto', border: '1px solid var(--ht-line)', borderRadius: 'var(--ht-radius-md)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
          <thead>
            <tr style={{ background: 'var(--ht-elevated)', borderBottom: '1px solid var(--ht-line)', color: 'var(--ht-text-secondary)' }}>
              <th style={{ padding: '10px 14px', fontWeight: 600 }}>Timestamp</th>
              <th style={{ padding: '10px 14px', fontWeight: 600 }}>Actor</th>
              <th style={{ padding: '10px 14px', fontWeight: 600 }}>Action</th>
              <th style={{ padding: '10px 14px', fontWeight: 600 }}>Target</th>
              <th style={{ padding: '10px 14px', fontWeight: 600 }}>Details</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--ht-text-muted)' }}>
                  {loading ? 'Loading audit records…' : 'No audit log entries found.'}
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => {
                const isExpanded = expandedLogId === log.id;
                return (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--ht-line-subtle)' }}>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: 'var(--ht-text-muted)', fontFamily: 'var(--ht-font-mono)' }}>
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 500, color: 'var(--ht-text)' }}>
                      {log.actorEmail}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: 600,
                          fontFamily: 'var(--ht-font-mono)',
                          border: `1px solid ${actionColor(log.action)}33`,
                          color: actionColor(log.action),
                          background: `${actionColor(log.action)}15`,
                        }}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--ht-text-secondary)' }}>
                      <strong>{log.targetType}</strong>
                      {log.targetId && (
                        <code style={{ marginLeft: '6px', fontSize: '10px' }}>
                          {log.targetId.slice(0, 12)}…
                        </code>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {log.metadata ? (
                        <div>
                          <button
                            type="button"
                            className="secondary row-action"
                            style={{ fontSize: '10px', height: '22px', padding: '0 6px' }}
                            onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                          >
                            {isExpanded ? 'Hide payload' : 'Inspect JSON'}
                          </button>
                          {isExpanded && (
                            <pre
                              style={{
                                marginTop: '6px',
                                padding: '8px',
                                background: 'var(--ht-elevated)',
                                borderRadius: '4px',
                                fontSize: '10px',
                                maxHeight: '150px',
                                overflow: 'auto',
                              }}
                            >
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--ht-text-muted)' }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
        <span style={{ fontSize: '12px', color: 'var(--ht-text-secondary)' }}>
          Page {page} of {pageCount} ({total} total records)
        </span>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            className="secondary row-action"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ← Previous
          </button>
          <button
            type="button"
            className="secondary row-action"
            disabled={page >= pageCount || loading}
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}

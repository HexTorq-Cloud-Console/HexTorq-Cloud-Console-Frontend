'use client';

import { FormEvent, useEffect, useState } from 'react';
import type { PlatformSettings } from '../../types/api';
import { apiUrl, errorMessage, responseJson } from '../../lib/api';

type AdminSettingsSectionProps = {
  token: string;
};

export default function AdminSettingsSection({ token }: AdminSettingsSectionProps) {
  const [retentionDays, setRetentionDays] = useState(30);
  const [initialRetention, setInitialRetention] = useState(30);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${apiUrl}/admin/settings`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await responseJson<PlatformSettings & { message?: string }>(res);
        if (!res.ok) throw new Error(data.message || 'Failed to load system settings');
        if (!cancelled && typeof data.logRetentionDays === 'number') {
          setRetentionDays(data.logRetentionDays);
          setInitialRetention(data.logRetentionDays);
        }
      } catch (err) {
        if (!cancelled) setError(errorMessage(err, 'Failed to fetch settings'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`${apiUrl}/admin/settings`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ logRetentionDays: Number(retentionDays) }),
      });
      const data = await responseJson<PlatformSettings & { message?: string }>(res);
      if (!res.ok) {
        throw new Error(data.message || 'Failed to save settings');
      }
      setInitialRetention(data.logRetentionDays);
      setSuccess(`Platform log retention successfully updated to ${data.logRetentionDays} days.`);
    } catch (err) {
      setError(errorMessage(err, 'Failed to update system settings'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="active-list" id="admin-settings">
      <div className="list-heading">
        <div>
          <span className="list-kicker">SYSTEM CONFIGURATION</span>
          <h3>Platform Settings</h3>
        </div>
      </div>

      <p className="muted admin-section__intro">
        Configure global deployment log lifecycle rules and console telemetry options. Changes are written to the audit log.
      </p>

      {success && <div className="admin-notice">{success}</div>}
      {error && (
        <div className="admin-notice" style={{ borderColor: 'var(--ht-danger-line)', background: 'var(--ht-danger-fill)', color: 'var(--ht-danger)' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSave} style={{ maxWidth: '640px', marginTop: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ border: '1px solid var(--ht-line)', borderRadius: 'var(--ht-radius-md)', padding: '18px', background: 'var(--ht-card)' }}>
            <h4 style={{ margin: '0 0 6px', fontSize: '14px', fontWeight: 600, color: 'var(--ht-text)' }}>
              Deployment Log Retention
            </h4>
            <p style={{ margin: '0 0 14px', fontSize: '12px', lineHeight: '18px', color: 'var(--ht-text-secondary)' }}>
              Determines how many days raw terminal output logs are retained before automatic pruning. Deployment metadata, commit references, and audit logs are retained permanently.
            </p>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--ht-text)' }}>
                Retention Window (Days)
              </span>
              <input
                type="number"
                min="1"
                max="3650"
                value={retentionDays}
                onChange={(e) => setRetentionDays(Number(e.target.value))}
                disabled={loading || saving}
                required
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--ht-radius)',
                  border: '1px solid var(--ht-line)',
                  background: 'var(--ht-nav)',
                  color: 'var(--ht-text)',
                  fontSize: '13px',
                  maxWidth: '180px',
                }}
              />
            </label>
            <span style={{ display: 'block', marginTop: '6px', fontSize: '11px', color: 'var(--ht-text-muted)' }}>
              Recommended: 30 days. Maximum: 3650 days (10 years).
            </span>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              type="submit"
              disabled={loading || saving || retentionDays === initialRetention}
              style={{
                height: '34px',
                padding: '0 16px',
                borderRadius: 'var(--ht-radius)',
                border: 'none',
                background: 'var(--ht-primary)',
                color: 'var(--ht-primary-contrast)',
                fontWeight: 600,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            {retentionDays !== initialRetention && (
              <button
                type="button"
                className="secondary"
                onClick={() => setRetentionDays(initialRetention)}
                disabled={saving}
                style={{ height: '34px', padding: '0 12px', fontSize: '12px' }}
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

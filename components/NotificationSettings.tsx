'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  currentPushSubscription,
  pushPermission,
  pushSupported,
  registerPushWorker,
  subscribeToPush,
  unsubscribeFromPush,
  type PushPermission,
} from '../lib/push';
import { apiUrl, errorMessage, responseJson, TOKEN_KEY } from '../lib/api';

type NotificationPreferences = {
  emailAddress: string | null;
  pushEnabled: boolean;
  emailEnabled: boolean;
  notifyStarted: boolean;
  notifyCompleted: boolean;
  notifyFailed: boolean;
};

type NotificationConfig = {
  pushEnabled: boolean;
  emailEnabled: boolean;
  vapidPublicKey: string | null;
  scopeKey: string | null;
  preferences: NotificationPreferences;
  devices: Array<{ id: string; endpoint: string; createdAt: string; lastUsedAt: string | null }>;
  deviceCount: number;
};

const EMPTY_PREFERENCES: NotificationPreferences = {
  emailAddress: null,
  pushEnabled: true,
  emailEnabled: false,
  notifyStarted: true,
  notifyCompleted: true,
  notifyFailed: true,
};

export default function NotificationSettings() {
  const [config, setConfig] = useState<NotificationConfig | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreferences>(EMPTY_PREFERENCES);
  const [permission, setPermission] = useState<PushPermission>('default');
  const [deviceActive, setDeviceActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const token = window.localStorage.getItem(TOKEN_KEY);
      if (!token) return;
      const response = await fetch(`${apiUrl}/notifications/config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await responseJson<NotificationConfig & { message?: string }>(response);
      if (!response.ok) throw new Error(data.message || 'Unable to load notification settings');
      setConfig(data);
      setPreferences(data.preferences || EMPTY_PREFERENCES);
      setPermission(pushPermission());
      const subscription = await currentPushSubscription();
      setDeviceActive(Boolean(subscription));
    } catch (reason) {
      setError(errorMessage(reason, 'Unable to load notification settings'));
    }
  }, []);

  useEffect(() => {
    void load();
    void registerPushWorker();
  }, [load]);

  async function savePreferences(next: Partial<NotificationPreferences>) {
    setBusy(true);
    setError('');
    try {
      const token = window.localStorage.getItem(TOKEN_KEY);
      const response = await fetch(`${apiUrl}/notifications/preferences`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      const data = await responseJson<{ message?: string }>(response);
      if (!response.ok) throw new Error(data.message || 'Unable to save preferences');
      setPreferences((current) => ({ ...current, ...next }));
      setMessage('Notification preferences saved.');
    } catch (reason) {
      setError(errorMessage(reason, 'Unable to save preferences'));
    } finally {
      setBusy(false);
    }
  }

  async function enablePush() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const token = window.localStorage.getItem(TOKEN_KEY);
      const vapidKey = config?.vapidPublicKey;
      if (!vapidKey) throw new Error('Push notifications are not configured on the server yet');

      const result = await subscribeToPush(vapidKey);
      if (!result.ok) throw new Error(result.reason);

      const response = await fetch(`${apiUrl}/notifications/subscribe`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: result.subscription }),
      });
      const data = await responseJson<{ message?: string }>(response);
      if (!response.ok) throw new Error(data.message || 'Unable to register this device');

      setPermission(pushPermission());
      setDeviceActive(true);
      setMessage('This device now receives deployment notifications.');
      await load();
    } catch (reason) {
      setError(errorMessage(reason, 'Unable to enable notifications'));
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const token = window.localStorage.getItem(TOKEN_KEY);
      const subscription = await currentPushSubscription();
      if (subscription) {
        await fetch(`${apiUrl}/notifications/subscribe`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription }),
        });
      }
      await unsubscribeFromPush();
      setDeviceActive(false);
      setMessage('This device no longer receives deployment notifications.');
      await load();
    } catch (reason) {
      setError(errorMessage(reason, 'Unable to disable notifications'));
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const token = window.localStorage.getItem(TOKEN_KEY);
      const response = await fetch(`${apiUrl}/notifications/test`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data = await responseJson<{ message?: string; result?: { push?: { sent?: number }; email?: { sent?: number } } }>(response);
      if (!response.ok) throw new Error(data.message || 'Unable to send a test notification');
      const push = data.result?.push?.sent ?? 0;
      const email = data.result?.email?.sent ?? 0;
      setMessage(push || email
        ? `Test notification sent (${push} browser, ${email} email).`
        : 'No active channels — enable a channel above first.');
    } catch (reason) {
      setError(errorMessage(reason, 'Unable to send a test notification'));
    } finally {
      setBusy(false);
    }
  }

  if (!pushSupported()) {
    return (
      <section className="ht-card notify-card" aria-labelledby="notify-title">
        <div className="notify-card__head">
          <span className="notify-card__icon" aria-hidden="true">◈</span>
          <div>
            <h3 id="notify-title">Deployment notifications</h3>
            <p>This browser does not support push notifications. Use a current Chrome, Edge, Firefox, or Safari.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="ht-card notify-card" aria-labelledby="notify-title">
      <div className="notify-card__head">
        <span className="notify-card__icon" aria-hidden="true">◉</span>
        <div>
          <h3 id="notify-title">Deployment notifications</h3>
          <p>Get alerted on this device when a deployment starts, succeeds, or fails — even when the console tab is closed.</p>
        </div>
      </div>

      <div className="notify-card__channels">
        <div className="notify-channel">
          <div className="notify-channel__text">
            <strong>Browser push</strong>
            <span>
              {deviceActive
                ? `Active on this device${config?.deviceCount ? ` · ${config.deviceCount} device(s) registered` : ''}`
                : permission === 'denied'
                  ? 'Blocked by the browser. Re-enable notifications in site settings.'
                  : permission === 'granted'
                    ? 'Permission granted, but this device is not registered yet.'
                    : 'Not enabled on this device yet.'}
            </span>
          </div>
          {deviceActive ? (
            <button type="button" className="ht-btn ht-btn--secondary" onClick={disablePush} disabled={busy}>Disable</button>
          ) : (
            <button type="button" className="ht-btn ht-btn--primary" onClick={enablePush} disabled={busy || permission === 'denied' || !config?.pushEnabled}>
              Enable on this device
            </button>
          )}
        </div>

        <div className="notify-channel">
          <div className="notify-channel__text">
            <strong>Email</strong>
            <span>{config?.emailEnabled ? 'Available — deliveries use the address below.' : 'Not available on the server yet.'}</span>
          </div>
          <label className="notify-channel__toggle">
            <input
              type="checkbox"
              checked={preferences.emailEnabled}
              disabled={busy || !config?.emailEnabled}
              onChange={(event) => void savePreferences({ emailEnabled: event.target.checked })}
            />
            <span>Send email alerts</span>
          </label>
        </div>
      </div>

      <div className="notify-card__email">
        <label>
          Email address
          <input
            type="email"
            value={preferences.emailAddress || ''}
            placeholder="you@company.com"
            disabled={busy || !config?.emailEnabled}
            onChange={(event) => setPreferences((current) => ({ ...current, emailAddress: event.target.value }))}
            onBlur={(event) => void savePreferences({ emailAddress: event.target.value.trim() || null })}
          />
        </label>
      </div>

      <fieldset className="notify-card__events">
        <legend>Notify me when</legend>
        {([
          ['notifyStarted', 'a deployment starts'],
          ['notifyCompleted', 'a deployment succeeds'],
          ['notifyFailed', 'a deployment fails'],
        ] as const).map(([key, label]) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={preferences[key]}
              disabled={busy}
              onChange={(event) => void savePreferences({ [key]: event.target.checked })}
            />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>

      <div className="notify-card__footer">
        <button type="button" className="ht-btn ht-btn--secondary" onClick={sendTest} disabled={busy}>Send test notification</button>
        {message ? <span className="notify-card__message">{message}</span> : null}
        {error ? <span className="notify-card__error">{error}</span> : null}
      </div>
    </section>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  currentPushSubscription,
  previewNotification,
  pushPermission,
  pushSupported,
  registerPushWorker,
  subscribeToPush,
  subscriptionMatchesKey,
  unsubscribeFromPush,
  type PushPermission,
} from '../lib/push';
import {
  fetchNotificationConfig,
  saveNotificationPreferences,
  sendTestNotification,
  subscribePushDevice,
  unsubscribePushDevice,
  type NotificationConfig,
} from '../lib/notificationStore';

export default function NotificationSettings() {
  const [config, setConfig] = useState<NotificationConfig | null>(null);
  const [preferences, setPreferences] = useState({ pushEnabled: true, notifyStarted: true, notifyCompleted: true, notifyFailed: true });
  const [permission, setPermission] = useState<PushPermission>('default');
  const [deviceActive, setDeviceActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await fetchNotificationConfig();
      setConfig(data);
      setPreferences(data.preferences);
      setPermission(pushPermission());
      const subscription = await currentPushSubscription();
      setDeviceActive(Boolean(subscription) && subscriptionMatchesKey(subscription, data.vapidPublicKey || ''));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load notification settings');
    }
  }, []);

  useEffect(() => {
    void load();
    void registerPushWorker();
  }, [load]);

  async function savePreferences(next: Partial<typeof preferences>) {
    setBusy(true);
    setError('');
    try {
      await saveNotificationPreferences(next);
      setPreferences((current) => ({ ...current, ...next }));
      setMessage('Notification preferences saved.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save preferences');
    } finally {
      setBusy(false);
    }
  }

  async function enablePush() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const vapidKey = config?.vapidPublicKey;
      if (!vapidKey) throw new Error('Browser push is not configured on the server yet');
      const result = await subscribeToPush(vapidKey);
      if (!result.ok) throw new Error(result.reason);
      await subscribePushDevice(result.subscription);
      setPermission(pushPermission());
      setDeviceActive(true);
      setMessage('This device now receives browser notifications.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to enable notifications');
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const subscription = await currentPushSubscription();
      if (subscription) await unsubscribePushDevice(subscription);
      await unsubscribeFromPush();
      setDeviceActive(false);
      setMessage('This device no longer receives browser notifications.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to disable notifications');
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await sendTestNotification();
      const push = result.push?.sent ?? 0;
      setMessage(result.message || (push ? `Test notification sent (${push} browser).` : 'Test notification created.'));
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to send a test notification');
    } finally {
      setBusy(false);
    }
  }

  async function sendPreview() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const shown = await previewNotification(
        'HexTorq Cloud Console',
        'Preview notification — if you can see this, the browser can display notifications.',
      );
      setMessage(shown
        ? 'Preview requested. If nothing appeared, the browser or operating system is blocking notifications for this site.'
        : 'The notification worker is not running. Reload the page and try again.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to show a preview notification');
    } finally {
      setBusy(false);
    }
  }

  if (!pushSupported()) {
    return (
      <section data-ascii="surface" className="ht-card notify-card" aria-labelledby="notify-title">
        <div className="notify-card__head">
          <span className="notify-card__icon" aria-hidden="true">◈</span>
          <div>
            <h3 id="notify-title">Notifications</h3>
            <p>This browser does not support browser notifications. Notifications are always saved to your notification history.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section data-ascii="surface" className="ht-card notify-card" aria-labelledby="notify-title">
      <div className="notify-card__head">
        <span className="notify-card__icon" aria-hidden="true">◉</span>
        <div>
          <h3 id="notify-title">Notifications</h3>
          <p>Notifications are saved to your history. Enable browser notifications to also see them on this device — even when the console tab is closed.</p>
        </div>
      </div>

      <div className="notify-card__channels">
        <div className="notify-channel">
          <div className="notify-channel__text">
            <strong>Browser notifications</strong>
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
        <button type="button" className="ht-btn ht-btn--secondary" onClick={sendPreview} disabled={busy}>Preview notification</button>
        {message ? <span className="notify-card__message">{message}</span> : null}
        {error ? <span className="notify-card__error">{error}</span> : null}
      </div>
    </section>
  );
}

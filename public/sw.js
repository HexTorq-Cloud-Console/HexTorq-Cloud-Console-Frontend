/* HexTorq Cloud Console — service worker.
 *
 * Deployment notifications are delivered by the browser's push service even
 * when the tab (and sometimes the whole browser) is closed. The payload is
 * JSON and small; the deep link points at the deployment record so the
 * notification's action button opens the full details.
 */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

function readPayload(event) {
  const fallback = {
    title: 'HexTorq Cloud Console',
    body: 'A deployment updated.',
    url: '/deployments',
    tag: 'hextorq-deployment',
  };
  if (!event.data) return fallback;
  try {
    return { ...fallback, ...event.data.json() };
  } catch {
    return { ...fallback, body: event.data.text() };
  }
}

self.addEventListener('push', (event) => {
  const data = readPayload(event);
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      tag: data.tag || 'hextorq-deployment',
      renotify: true,
      requireInteraction: data.status === 'FAILED' || data.status === 'ERROR',
      vibrate: [120, 60, 120],
      timestamp: Date.now(),
      data: {
        url: data.url || '/deployments',
        deploymentId: data.deploymentId || null,
        serviceId: data.serviceId || null,
        status: data.status || null,
      },
      actions: [
        { action: 'details', title: 'View full details' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url || '/deployments';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => client.url.startsWith(self.location.origin));
      if (existing) {
        existing.focus();
        // `navigate` is only available on WindowClient instances that have one.
        return typeof existing.navigate === 'function' ? existing.navigate(url) : undefined;
      }
      return self.clients.openWindow(url);
    }),
  );
});

self.addEventListener('close', () => undefined);

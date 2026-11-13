/* HexTorq Cloud Console — service worker.
 *
 * Deployment notifications are delivered by the browser's push service even
 * when the tab (and sometimes the whole browser) is closed. The payload is
 * JSON and small; the deep link points at the deployment record so the
 * notification's action button opens the full details.
 *
 * Every step logs to the worker console (DevTools → Application → Service
 * Workers) so a missing notification can be traced to either delivery or
 * display without guessing.
 */

const SW_VERSION = '3';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  console.log(`[sw] activated v${SW_VERSION}`);
  event.waitUntil(self.clients.claim());
});

function readPayload(event) {
  const fallback = {
    title: 'HexTorq Cloud Console',
    body: 'A deployment updated.',
    url: '/deployments',
    tag: 'hextorq-deployment',
    status: 'SUCCESS',
  };
  if (!event.data) {
    console.log('[sw] push received without a payload');
    return fallback;
  }
  try {
    const parsed = event.data.json();
    console.log('[sw] push payload received', parsed);
    return { ...fallback, ...parsed };
  } catch {
    console.warn('[sw] push payload was not JSON, falling back to text');
    return { ...fallback, body: event.data.text() };
  }
}

async function showNotification(data) {
  try {
    await self.registration.showNotification(data.title || 'HexTorq Cloud Console', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      tag: data.tag || 'hextorq-deployment',
      renotify: true,
      requireInteraction: data.status === 'FAILED' || data.status === 'ERROR',
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
    });
    console.log('[sw] notification shown:', data.title);
    return { shown: true };
  } catch (error) {
    console.error('[sw] showNotification failed', error);
    return { shown: false, error: error.message };
  }
}

async function broadcast(data) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  clients.forEach((client) => client.postMessage({ type: 'push-received', data }));
}

self.addEventListener('push', (event) => {
  const data = readPayload(event);
  event.waitUntil(Promise.all([showNotification(data), broadcast(data)]));
});

// Lets the page trigger a notification through this exact same path, so a
// local preview exercises the real rendering code.
self.addEventListener('message', (event) => {
  const message = event.data || {};
  if (message.type === 'preview') {
    event.waitUntil(showNotification({
      title: message.title || 'HexTorq Cloud Console',
      body: message.body || 'Preview notification from the console.',
      url: message.url || '/deployments',
      tag: 'hextorq-preview',
      status: 'SUCCESS',
    }));
    return;
  }
  if (message.type === 'ping') {
    event.source?.postMessage({ type: 'pong', version: SW_VERSION });
  }
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

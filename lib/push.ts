// Browser push helpers.
//
// The service worker owns the notification display; this module owns the
// subscription lifecycle: register the worker, ask for permission, subscribe
// with the VAPID public key, and keep the backend in sync with the device.

const WORKER_PATH = '/sw.js';

export type PushPermission = 'default' | 'granted' | 'denied' | 'unsupported';

export type PushSubscriptionRecord = {
  endpoint: string;
  expirationTime?: number | null;
  keys?: { p256dh?: string; auth?: string };
  applicationServerKey?: ArrayBuffer | null;
  unsubscribe?: () => Promise<boolean>;
};

export function pushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  return typeof Notification !== 'undefined';
}

export function pushPermission(): PushPermission {
  if (!pushSupported()) return 'unsupported';
  return Notification.permission as PushPermission;
}

/** VAPID keys are base64url; the Push API needs a Uint8Array. */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) output[index] = raw.charCodeAt(index);
  return output;
}

export async function registerPushWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null;
  try {
    return await navigator.serviceWorker.register(WORKER_PATH, { scope: '/' });
  } catch {
    return null;
  }
}

export async function currentPushSubscription(): Promise<PushSubscriptionRecord | null> {
  if (!pushSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.getRegistration('/');
    if (!registration) return null;
    const subscription = await registration.pushManager.getSubscription();
    return (subscription as unknown as PushSubscriptionRecord) ?? null;
  } catch {
    return null;
  }
}

export type SubscribeResult =
  | { ok: true; subscription: PushSubscriptionRecord }
  | { ok: false; reason: string };

/**
 * Check whether an existing subscription was created with the current VAPID
 * key.
 *
 * A browser subscription is bound to the applicationServerKey that created
 * it. If the server rotates its VAPID keypair, the old subscription stops
 * working and `subscribe()` refuses to replace it, so it has to be dropped
 * first. When the stored key cannot be read we assume a mismatch and
 * resubscribe, which is the safe direction.
 */
export function subscriptionMatchesKey(
  subscription: PushSubscriptionRecord | null,
  vapidPublicKey: string,
): boolean {
  const stored = subscription?.applicationServerKey;
  if (!stored) return false;
  const existing = stored instanceof ArrayBuffer ? new Uint8Array(stored) : new Uint8Array(stored as ArrayBufferLike);
  const expected = urlBase64ToUint8Array(vapidPublicKey);
  if (existing.length !== expected.length) return false;
  for (let index = 0; index < existing.length; index += 1) {
    if (existing[index] !== expected[index]) return false;
  }
  return true;
}

/**
 * Ask for permission and subscribe the device.
 *
 * The permission prompt must be triggered by a user gesture, so this is only
 * ever called from a click handler.
 */
export async function subscribeToPush(vapidPublicKey: string): Promise<SubscribeResult> {
  if (!pushSupported()) return { ok: false, reason: 'This browser does not support push notifications' };
  if (!vapidPublicKey) return { ok: false, reason: 'Push is not configured on the server yet' };

  let permission = Notification.permission;
  if (permission === 'default') permission = await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, reason: 'Notification permission was not granted' };

  const registration = await registerPushWorker();
  if (!registration) return { ok: false, reason: 'Unable to register the notification worker' };

  let existing = await registration.pushManager.getSubscription();
  if (existing && !subscriptionMatchesKey(existing as unknown as PushSubscriptionRecord, vapidPublicKey)) {
    // The server rotated its VAPID keypair. The old subscription is bound to
    // the previous key and can no longer be used, so replace it.
    try {
      await existing.unsubscribe();
    } catch {
      // The subscription is already gone; continue with a fresh one.
    }
    existing = null;
  }

  const subscription = existing ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
  });

  return { ok: true, subscription: subscription as unknown as PushSubscriptionRecord };
}

export async function unsubscribeFromPush(): Promise<boolean> {
  const subscription = await currentPushSubscription();
  if (!subscription) return false;
  try {
    await subscription.unsubscribe?.();
    return true;
  } catch {
    return false;
  }
}

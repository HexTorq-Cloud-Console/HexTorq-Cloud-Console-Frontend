'use client';

// Notification history is authoritative on the backend (PostgreSQL). This
// module is the frontend client: it reads history, marks read/unread and holds
// the live feed (poll + service-worker push) that drives the bell, the toast
// and the Alerts history page. Browser push is an additional surface for the
// same stored notification — never a separate message.

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiUrl, TOKEN_KEY, responseJson } from './api';

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  metadata?: Record<string, unknown> | null;
  resourceType?: string | null;
  resourceId?: string | null;
  read: boolean;
  readAt?: string | null;
  createdAt: string;
};

export type NotificationsResponse = {
  notifications: AppNotification[];
  total: number;
  unreadCount: number;
  hasMore: boolean;
  nextCursor: string | null;
  limit: number;
};

export type NotificationConfig = {
  enabled: boolean;
  mode: string;
  browserPushEnabled: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
  vapidPublicKey: string | null;
  scopeKey: string | null;
  preferences: {
    pushEnabled: boolean;
    notifyStarted: boolean;
    notifyCompleted: boolean;
    notifyFailed: boolean;
  };
  devices: Array<{ id: string; endpoint: string; createdAt: string; lastUsedAt: string | null }>;
  deviceCount: number;
};

function authHeaders(json = false): HeadersInit {
  const token = typeof window !== 'undefined' ? window.localStorage.getItem(TOKEN_KEY) : null;
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  };
}

export async function fetchNotifications(params: { filter?: 'all' | 'unread' | 'read'; cursor?: string | null; limit?: number } = {}): Promise<NotificationsResponse> {
  const query = new URLSearchParams();
  if (params.filter) query.set('filter', params.filter);
  if (params.cursor) query.set('cursor', params.cursor);
  if (params.limit) query.set('limit', String(params.limit));
  const response = await fetch(`${apiUrl}/notifications?${query.toString()}`, { headers: authHeaders() });
  const data = await responseJson<NotificationsResponse & { message?: string }>(response);
  if (!response.ok) throw new Error(data.message || 'Unable to load notifications');
  return data;
}

export async function fetchUnreadCount(): Promise<number> {
  const response = await fetch(`${apiUrl}/notifications/unread-count`, { headers: authHeaders() });
  const data = await responseJson<{ unreadCount?: number }>(response);
  return response.ok ? data.unreadCount || 0 : 0;
}

export async function markNotificationRead(id: string): Promise<void> {
  await fetch(`${apiUrl}/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH', headers: authHeaders() });
}

export async function markAllNotificationsRead(): Promise<void> {
  await fetch(`${apiUrl}/notifications/read-all`, { method: 'POST', headers: authHeaders() });
}

export async function fetchNotificationConfig(): Promise<NotificationConfig> {
  const response = await fetch(`${apiUrl}/notifications/config`, { headers: authHeaders() });
  const data = await responseJson<NotificationConfig & { message?: string }>(response);
  if (!response.ok) throw new Error(data.message || 'Unable to load notification settings');
  return data;
}

export async function saveNotificationPreferences(patch: Partial<NotificationConfig['preferences']>): Promise<void> {
  const response = await fetch(`${apiUrl}/notifications/preferences`, {
    method: 'PATCH',
    headers: authHeaders(true),
    body: JSON.stringify(patch),
  });
  const data = await responseJson<{ message?: string }>(response);
  if (!response.ok) throw new Error(data.message || 'Unable to save preferences');
}

export async function subscribePushDevice(subscription: unknown): Promise<void> {
  const response = await fetch(`${apiUrl}/notifications/subscribe`, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({ subscription }),
  });
  const data = await responseJson<{ message?: string }>(response);
  if (!response.ok) throw new Error(data.message || 'Unable to register this device');
}

export async function unsubscribePushDevice(subscription: unknown): Promise<void> {
  await fetch(`${apiUrl}/notifications/subscribe`, {
    method: 'DELETE',
    headers: authHeaders(true),
    body: JSON.stringify({ subscription }),
  });
}

export async function sendTestNotification(): Promise<{ push?: { sent?: number }; message?: string }> {
  const response = await fetch(`${apiUrl}/notifications/test`, { method: 'POST', headers: authHeaders() });
  const data = await responseJson<{ message?: string; result?: { push?: { sent?: number } } }>(response);
  if (!response.ok) throw new Error(data.message || 'Unable to send a test notification');
  return { push: data.result?.push, message: data.message };
}

/** Where a notification should navigate, if anywhere. */
export function notificationTarget(item: AppNotification): string | null {
  const url = (item.metadata as { url?: string } | null)?.url;
  if (typeof url === 'string' && url) return url;
  if (item.resourceType === 'deployment' && item.resourceId) return `/deployments?deployment=${encodeURIComponent(item.resourceId)}`;
  return null;
}

export type NotificationFeed = {
  items: AppNotification[];
  unreadCount: number;
  loading: boolean;
  error: string;
  toasts: AppNotification[];
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  dismissToast: (id: string) => void;
};

/**
 * Live notification feed. Polls the newest notifications + unread count, and
 * also refreshes when the service worker reports an incoming push. Genuinely
 * new notifications (never seen since the first load) raise one toast each;
 * initial history does not.
 */
export function useNotificationFeed(pollMs = 25000): NotificationFeed {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toasts, setToasts] = useState<AppNotification[]>([]);
  const seenRef = useRef<Set<string>>(new Set());
  const primedRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const page = await fetchNotifications({ limit: 12 });
      const fresh = page.notifications.filter((item) => !seenRef.current.has(item.id));
      for (const item of page.notifications) seenRef.current.add(item.id);
      setItems(page.notifications);
      setUnreadCount(page.unreadCount);
      setError('');
      if (primedRef.current && fresh.length) {
        setToasts((current) => [...fresh, ...current].slice(0, 3));
      }
      primedRef.current = true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to refresh notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), pollMs);
    let onMessage: ((event: MessageEvent) => void) | null = null;
    if ('serviceWorker' in navigator) {
      onMessage = (event: MessageEvent) => {
        if (event.data?.type === 'push-received') void refresh();
      };
      navigator.serviceWorker.addEventListener('message', onMessage);
    }
    return () => {
      window.clearInterval(timer);
      if (onMessage) navigator.serviceWorker.removeEventListener('message', onMessage);
    };
  }, [refresh, pollMs]);

  const markRead = useCallback(async (id: string) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, read: true } : item)));
    setUnreadCount((current) => Math.max(0, current - 1));
    setToasts((current) => current.filter((item) => item.id !== id));
    try { await markNotificationRead(id); } catch { /* optimistic; next poll reconciles */ }
  }, []);

  const markAllRead = useCallback(async () => {
    setItems((current) => current.map((item) => ({ ...item, read: true })));
    setUnreadCount(0);
    try { await markAllNotificationsRead(); } catch { /* next poll reconciles */ }
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  return { items, unreadCount, loading, error, toasts, refresh, markRead, markAllRead, dismissToast };
}

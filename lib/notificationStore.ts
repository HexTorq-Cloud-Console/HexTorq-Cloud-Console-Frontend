import { useSyncExternalStore } from 'react';

export type NotificationKind = 'success' | 'failed' | 'running' | 'error' | 'info';

export type StoredNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  url?: string;
  createdAt: number;
  read: boolean;
};

const MAX_ITEMS = 100;
const EMPTY: StoredNotification[] = [];

let items: StoredNotification[] = EMPTY;
let loadedKey: string | null = null;
let storageKey = '';
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function persist() {
  if (!storageKey) return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(items));
  } catch {
    // Storage can be full or blocked; the in-memory list still works.
  }
}

export function loadNotifications(scope: string) {
  if (typeof window === 'undefined') return;
  const key = `hextorq-notifications:${scope}`;
  if (loadedKey === key) return;
  loadedKey = key;
  storageKey = key;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || '[]');
    items = Array.isArray(parsed) ? parsed.slice(0, MAX_ITEMS) : EMPTY;
  } catch {
    items = EMPTY;
  }
  emit();
}

export function addNotification(entry: Omit<StoredNotification, 'createdAt' | 'read' | 'id'> & { id?: string; createdAt?: number }) {
  const id = entry.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  if (items.some((item) => item.id === id)) return;
  items = [{ ...entry, id, createdAt: entry.createdAt ?? Date.now(), read: false }, ...items].slice(0, MAX_ITEMS);
  persist();
  emit();
}

export function markAllRead() {
  if (!items.some((item) => !item.read)) return;
  items = items.map((item) => (item.read ? item : { ...item, read: true }));
  persist();
  emit();
}

export function markRead(id: string) {
  items = items.map((item) => (item.id === id ? { ...item, read: true } : item));
  persist();
  emit();
}

export function removeNotification(id: string) {
  items = items.filter((item) => item.id !== id);
  persist();
  emit();
}

export function clearNotifications() {
  items = EMPTY;
  persist();
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useNotifications() {
  return useSyncExternalStore(subscribe, () => items, () => EMPTY);
}

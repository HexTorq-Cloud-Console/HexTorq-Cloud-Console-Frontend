'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notificationTarget,
  type AppNotification,
} from '../lib/notificationStore';

type Filter = 'all' | 'unread' | 'read';

function relativeTime(value: string) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(value).toLocaleString();
}

function kindFor(type: string): 'success' | 'failed' | 'running' | 'info' {
  if (type === 'deployment.success') return 'success';
  if (type === 'deployment.failed') return 'failed';
  if (type === 'deployment.started') return 'running';
  return 'info';
}

export default function NotificationHistory() {
  const [filter, setFilter] = useState<Filter>('all');
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (next: Filter, appendTo: string | null = null) => {
    if (appendTo) setLoadingMore(true); else setLoading(true);
    setError('');
    try {
      const page = await fetchNotifications({ filter: next, cursor: appendTo, limit: 20 });
      setItems((current) => (appendTo ? [...current, ...page.notifications] : page.notifications));
      setUnreadCount(page.unreadCount);
      setTotal(page.total);
      setNextCursor(page.nextCursor);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load notifications');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { void load(filter); }, [filter, load]);

  async function onMarkRead(item: AppNotification) {
    if (item.read) return;
    setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, read: true } : entry)));
    setUnreadCount((current) => Math.max(0, current - 1));
    try { await markNotificationRead(item.id); } catch { /* reconciled on next load */ }
  }

  async function onOpen(item: AppNotification) {
    await onMarkRead(item);
    const target = notificationTarget(item);
    if (target) window.location.assign(target);
  }

  async function onMarkAll() {
    setItems((current) => current.map((entry) => ({ ...entry, read: true })));
    setUnreadCount(0);
    try { await markAllNotificationsRead(); } catch { /* reconciled on next load */ }
  }

  return (
    <section className="ht-card notification-history" aria-labelledby="notification-history-title">
      <div className="notification-history__head">
        <div>
          <h3 id="notification-history-title">Notification history</h3>
          <p className="muted">{total} total{unreadCount ? ` · ${unreadCount} unread` : ''}</p>
        </div>
        <button className="ht-btn ht-btn--secondary" type="button" onClick={() => void onMarkAll()} disabled={!unreadCount}>Mark all read</button>
      </div>

      <div className="notification-history__filters" role="tablist" aria-label="Notification filter">
        {(['all', 'unread', 'read'] as Filter[]).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={filter === key}
            className={`notification-history__filter${filter === key ? ' is-active' : ''}`}
            onClick={() => setFilter(key)}
          >
            {key === 'all' ? 'All' : key === 'unread' ? 'Unread' : 'Read'}
          </button>
        ))}
      </div>

      {error ? (
        <div className="ht-empty">{error}</div>
      ) : loading ? (
        <div className="ht-empty">Loading notifications...</div>
      ) : items.length === 0 ? (
        <div className="ht-empty">
          {filter === 'unread' ? 'No unread notifications.' : filter === 'read' ? 'No read notifications yet.' : 'No notifications yet. Deployment updates will appear here.'}
        </div>
      ) : (
        <>
          <ul className="notification-history__list">
            {items.map((item) => (
              <li key={item.id} className={`notification-history__item${item.read ? '' : ' is-unread'}`}>
                <button type="button" className={`notification-history__main notification-history__main--${kindFor(item.type)}`} onClick={() => void onOpen(item)}>
                  <span className="notification-history__dot" aria-hidden="true" />
                  <span className="notification-history__text">
                    <span className="notification-history__title">{item.title}</span>
                    {item.body ? <span className="notification-history__body">{item.body}</span> : null}
                    <span className="notification-history__meta">{item.type} · {relativeTime(item.createdAt)}</span>
                  </span>
                </button>
                {item.read ? (
                  <span className="notification-history__read">Read</span>
                ) : (
                  <button type="button" className="notification-history__mark" onClick={() => void onMarkRead(item)}>Mark read</button>
                )}
              </li>
            ))}
          </ul>
          {nextCursor ? (
            <div className="notification-history__more">
              <button className="ht-btn ht-btn--secondary" type="button" onClick={() => void load(filter, nextCursor)} disabled={loadingMore}>
                {loadingMore ? 'Loading...' : 'Load more'}
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

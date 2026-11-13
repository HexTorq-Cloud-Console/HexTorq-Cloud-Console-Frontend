'use client';

import { useEffect, useRef, useState } from 'react';
import {
  addNotification,
  clearNotifications,
  markAllRead,
  markRead,
  removeNotification,
  useNotifications,
  type NotificationKind,
} from '../lib/notificationStore';

function timeAgo(timestamp: number) {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

const KIND_LABEL: Record<NotificationKind, string> = {
  success: 'Success',
  failed: 'Failed',
  running: 'Started',
  error: 'Error',
  info: 'Info',
};

export default function NotificationCenter() {
  const items = useNotifications();
  const [open, setOpen] = useState(false);
  const [, setTick] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const unread = items.filter((item) => !item.read).length;

  useEffect(() => {
    if (!open) return;
    setTick((value) => value + 1);
    function onPointer(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    function onMessage(event: MessageEvent) {
      const message = event.data;
      if (!message || message.type !== 'push-received' || !message.data) return;
      const data = message.data;
      const status = String(data.status || '').toUpperCase();
      addNotification({
        id: data.deploymentId ? `${data.deploymentId}:${status || 'PUSH'}` : undefined,
        kind: status === 'FAILED' || status === 'ERROR' ? 'failed' : status === 'SUCCESS' ? 'success' : 'info',
        title: data.title || 'HexTorq Cloud Console',
        body: data.body || '',
        url: data.url,
      });
    }
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, []);

  function openItem(id: string, url?: string) {
    markRead(id);
    if (!url) return;
    setOpen(false);
    window.location.assign(url);
  }

  return (
    <div className="notif-center" ref={rootRef}>
      <button
        type="button"
        className="theme-toggle notif-center__button"
        onClick={() => setOpen((value) => !value)}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        title="Notifications"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && <span className="notif-center__badge">{unread > 99 ? '99+' : unread}</span>}
      </button>

      {open && (
        <div className="notif-center__panel" role="dialog" aria-label="Notifications">
          <div className="notif-center__head">
            <strong>Notifications</strong>
            <div className="notif-center__actions">
              <button type="button" onClick={markAllRead} disabled={!unread}>Mark all read</button>
              <button type="button" onClick={clearNotifications} disabled={!items.length}>Clear all</button>
            </div>
          </div>
          {items.length === 0 ? (
            <p className="notif-center__empty">No notifications yet. Deployment updates will appear here.</p>
          ) : (
            <ul className="notif-center__list">
              {items.map((item) => (
                <li key={item.id} className={`notif-item notif-item--${item.kind}${item.read ? '' : ' notif-item--unread'}`}>
                  <button type="button" className="notif-item__main" onClick={() => openItem(item.id, item.url)}>
                    <span className="notif-item__dot" aria-hidden="true" />
                    <span className="notif-item__text">
                      <span className="notif-item__title">{item.title}</span>
                      <span className="notif-item__body">{item.body}</span>
                      <span className="notif-item__meta">{KIND_LABEL[item.kind]} · {timeAgo(item.createdAt)}</span>
                    </span>
                  </button>
                  <button type="button" className="notif-item__remove" onClick={() => removeNotification(item.id)} aria-label="Remove notification">×</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

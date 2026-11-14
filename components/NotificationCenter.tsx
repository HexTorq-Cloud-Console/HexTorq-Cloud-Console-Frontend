'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AsciiReveal } from 'ascii-reveal';
import { notificationTarget, useNotificationFeed, type AppNotification } from '../lib/notificationStore';

function timeAgo(value: string) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function kindFor(type: string): 'success' | 'failed' | 'running' | 'info' {
  if (type === 'deployment.success') return 'success';
  if (type === 'deployment.failed') return 'failed';
  if (type === 'deployment.started') return 'running';
  return 'info';
}

export default function NotificationCenter() {
  const { items, unreadCount, loading, error, toasts, refresh, markRead, markAllRead, dismissToast } = useNotificationFeed();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
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
    if (!toasts.length) return;
    const timers = toasts.map((toast) => window.setTimeout(() => dismissToast(toast.id), 6000));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [toasts, dismissToast]);

  function openItem(item: AppNotification) {
    if (!item.read) void markRead(item.id);
    const target = notificationTarget(item);
    setOpen(false);
    if (target) window.location.assign(target);
  }

  return (
    <>
      <div className="notif-center" ref={rootRef}>
        <button
          type="button"
          className="notif-center__button"
          onClick={() => { setOpen((value) => !value); if (!open) void refresh(); }}
          aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
          aria-expanded={open}
          title="Notifications"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
          {unreadCount > 0 && <span className="notif-center__badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
        </button>

        {open && (
          <div className="notif-center__panel" data-lenis-prevent role="dialog" aria-label="Notifications">
            <AsciiReveal preset="dither" origin="top-left" speed={0.7}>
              <div className="notif-center__head">
                <strong>Notifications</strong>
                <div className="notif-center__actions">
                  <button type="button" onClick={() => void markAllRead()} disabled={!unreadCount}>Mark all read</button>
                </div>
              </div>
              {error ? (
                <p className="notif-center__empty">{error}</p>
              ) : items.length === 0 ? (
                <p className="notif-center__empty">{loading ? 'Loading notifications...' : 'No notifications yet. Deployment updates will appear here.'}</p>
              ) : (
                <ul className="notif-center__list" data-lenis-prevent>
                  {items.map((item) => (
                    <li key={item.id} className={`notif-item notif-item--${kindFor(item.type)}${item.read ? '' : ' notif-item--unread'}`}>
                      <button type="button" className="notif-item__main" onClick={() => openItem(item)}>
                        <span className="notif-item__dot" aria-hidden="true" />
                        <span className="notif-item__text">
                          <span className="notif-item__title">{item.title}</span>
                          {item.body ? <span className="notif-item__body">{item.body}</span> : null}
                          <span className="notif-item__meta">{timeAgo(item.createdAt)}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="notif-center__actions" style={{ justifyContent: 'center', padding: '10px 14px', borderTop: '1px solid var(--ht-line-subtle)' }}>
                <Link href="/alerts" onClick={() => setOpen(false)} style={{ color: 'var(--ht-violet-text)', font: '500 12px/17px var(--ht-font-body)' }}>View all notifications</Link>
              </div>
            </AsciiReveal>
          </div>
        )}
      </div>

      {toasts.length > 0 && (
        <div className="notif-toasts" role="status" aria-live="polite">
          {toasts.map((toast) => (
            <button
              key={toast.id}
              type="button"
              className={`notif-toast notif-toast--${kindFor(toast.type)}`}
              onClick={() => { void markRead(toast.id); dismissToast(toast.id); const target = notificationTarget(toast); if (target) window.location.assign(target); }}
            >
              <span className="notif-toast__title">{toast.title}</span>
              {toast.body ? <span className="notif-toast__body">{toast.body}</span> : null}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

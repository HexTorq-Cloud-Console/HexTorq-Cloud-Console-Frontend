'use client';

import { createElement, useEffect, useRef } from 'react';
import { SAKUGA_TOAST_EVENT, type SakugaToastDetail } from '../lib/sakugaToast';

interface SakugaToastElement extends HTMLElement {
  open?: boolean;
  show: (text?: string) => void;
  hide: () => void;
}

const DEFAULT_DURATION_MS = 2600;

export default function SakugaToastHost() {
  const ref = useRef<SakugaToastElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const markClosed = () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      el.removeAttribute('data-open');
    };

    const scheduleClose = () => {
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
      const durationAttr = Number(el.getAttribute('duration') || '2.6');
      const ms = (Number.isFinite(durationAttr) && durationAttr > 0 ? durationAttr * 1000 : DEFAULT_DURATION_MS) + 450;
      closeTimerRef.current = window.setTimeout(() => {
        if (!el.open) el.removeAttribute('data-open');
      }, ms);
    };

    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<SakugaToastDetail>).detail;
      const text = detail?.message;
      if (!text) return;
      el.setAttribute('data-open', 'true');
      if (typeof el.show === 'function') {
        el.show(text);
        scheduleClose();
      } else {
        // Fallback if /toast.js has not finished upgrading yet
        window.customElements?.whenDefined('sakuga-toast').then(() => {
          el.setAttribute('data-open', 'true');
          el.show(text);
          scheduleClose();
        });
      }
    };

    const onShadowClick = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest?.('.x') || event.composedPath().some((n) => (n as HTMLElement)?.classList?.contains?.('x'))) {
        markClosed();
      }
    };

    window.addEventListener(SAKUGA_TOAST_EVENT, onToast);
    el.addEventListener('click', onShadowClick);
    return () => {
      window.removeEventListener(SAKUGA_TOAST_EVENT, onToast);
      el.removeEventListener('click', onShadowClick);
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  return createElement('sakuga-toast', {
    ref,
    className: 'ht-sakuga-toast',
    duration: '2.6',
  });
}

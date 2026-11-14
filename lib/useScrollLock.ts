'use client';

import { useEffect } from 'react';

type LenisHandle = { stop?: () => void; start?: () => void };

/**
 * Locks page scrolling while a dialog is open.
 *
 * `overflow: hidden` alone is not enough: Lenis drives the scroll position itself, so
 * the page would keep gliding behind the dialog. The smooth-scroll instance has to be
 * stopped explicitly and resumed afterwards.
 */
export function useScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const lenis = (window as unknown as { __lenis?: LenisHandle }).__lenis;
    lenis?.stop?.();
    return () => {
      document.body.style.overflow = previous;
      lenis?.start?.();
    };
  }, [locked]);
}

'use client';

import { useEffect } from 'react';

type LenisHandle = { stop?: () => void; start?: () => void };

let activeLocks = 0;
let previousOverflow = '';
let previousPaddingRight = '';

export function lockScroll(): void {
  if (typeof window === 'undefined') return;

  if (activeLocks === 0) {
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    previousOverflow = document.body.style.overflow;
    previousPaddingRight = document.body.style.paddingRight;

    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    const lenis = (window as unknown as { __lenis?: LenisHandle }).__lenis;
    lenis?.stop?.();
  }
  activeLocks++;
}

export function unlockScroll(): void {
  if (typeof window === 'undefined') return;

  activeLocks = Math.max(0, activeLocks - 1);
  if (activeLocks === 0) {
    document.body.style.overflow = previousOverflow;
    document.body.style.paddingRight = previousPaddingRight;

    const lenis = (window as unknown as { __lenis?: LenisHandle }).__lenis;
    lenis?.start?.();
  }
}

/**
 * Locks page scrolling while a modal, dialog, or drawer is open.
 *
 * Uses reference counting so nested or concurrent locks do not corrupt
 * styles. Calculates scrollbar width and applies padding to eliminate
 * layout shift / jumping on desktop. Pauses and resumes Lenis smoothly.
 */
export function useScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked) return;
    lockScroll();
    return () => {
      unlockScroll();
    };
  }, [locked]);
}

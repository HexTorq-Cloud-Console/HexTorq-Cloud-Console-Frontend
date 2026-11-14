'use client';

import { useEffect } from 'react';

type LenisInstance = {
  raf: (time: number) => void;
  destroy: () => void;
  stop: () => void;
  start: () => void;
};

/**
 * Lightweight Lenis smooth-scroll wrapper.
 * Mounted once at the app root; provides silky-smooth, responsive wheel scrolling
 * while preserving 100% native frictionless touch momentum scrolling on mobile devices.
 */
export default function SmoothScroll({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let lenis: LenisInstance | null = null;
    let animFrame: number;

    const isTouchOnly =
      typeof window !== 'undefined' &&
      window.matchMedia('(pointer: coarse) and (hover: none)').matches;

    // On pure mobile touch devices, native momentum scrolling is hardware-accelerated,
    // instantaneous, and frictionless. We configure Lenis so wheel events are smoothed
    // on desktop/trackpad while touch devices never suffer from artificial drag lag.
    import('lenis').then(({ default: Lenis }) => {
      lenis = new Lenis({
        duration: 0.95,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: !isTouchOnly,
        syncTouch: false, // Preserves native 1:1 hardware touch inertia on mobile
        touchMultiplier: 1, // Avoids hyper-sensitive touch jumps
        prevent: (node: Node) => {
          if (!(node instanceof HTMLElement)) return false;
          return Boolean(
            node.closest(
              '[data-lenis-prevent], .modal-backdrop, .drawer-backdrop, .command-palette-backdrop, .detail-drawer, .pm2-log-card, .modal-card, [role="dialog"], pre'
            )
          );
        },
      });

      // Exposed so dialogs/drawers can pause smooth scroll while open.
      (window as unknown as { __lenis?: LenisInstance }).__lenis = lenis;

      function raf(time: number) {
        lenis?.raf(time);
        animFrame = requestAnimationFrame(raf);
      }
      animFrame = requestAnimationFrame(raf);
    });

    return () => {
      cancelAnimationFrame(animFrame);
      lenis?.destroy();
      (window as unknown as { __lenis?: unknown }).__lenis = undefined;
    };
  }, []);

  return <>{children}</>;
}

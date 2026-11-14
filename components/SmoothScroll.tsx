'use client';

import { useEffect } from 'react';

/**
 * Lightweight Lenis smooth-scroll wrapper.
 * Mounted once at the app root; works with the existing ASCII reveal and
 * click handlers because Lenis only intercepts wheel / touch scroll events.
 */
export default function SmoothScroll({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let lenis: { raf: (time: number) => void; destroy: () => void } | null = null;
    let animFrame: number;

    import('lenis').then(({ default: Lenis }) => {
      lenis = new Lenis({
        duration: 1.1,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        touchMultiplier: 2,
      });
      // Exposed so dialogs can pause the smooth scroll while they are open.
      (window as unknown as { __lenis?: unknown }).__lenis = lenis;

      function raf(time: number) {
        lenis!.raf(time);
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

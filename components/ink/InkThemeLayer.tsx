'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { InkTransition, type Point } from './InkTransition';

/**
 * Mounts the ink-bleed theme transition overlay (adapted from
 * codemure-official/ink-bleed-theme-changer): a fixed WebGL2 canvas that blends
 * full-document snapshots of both themes while the live DOM flips underneath.
 *
 * The layer lives in the root layout, so the singleton survives SPA navigation.
 */

const inkRef: { current: InkTransition | null } = { current: null };

/**
 * Attempt the ink-bleed theme switch. Returns false when the layer isn't ready
 * (pre-hydration, WebGL2 missing, …) so callers can fall back to a plain swap.
 */
export function requestInkThemeToggle(point?: Point): boolean {
  const ink = inkRef.current;
  if (!ink) return false;
  void ink.toggle(point);
  return true;
}

export default function InkThemeLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ink = new InkTransition(canvas);
    inkRef.current = ink;

    // SPA navigations and live-data churn invalidate the snapshots even when the
    // document size is unchanged; refresh them, debounced.
    let observerTimer = 0;
    const contentChanged = (): void => {
      window.clearTimeout(observerTimer);
      observerTimer = window.setTimeout(() => ink.refresh(0), 1000);
    };
    const observer = new MutationObserver(contentChanged);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.setTimeout(() => ink.refresh(400), 250); // settle after this navigation's paint

    return () => {
      observer.disconnect();
      window.clearTimeout(observerTimer);
      ink.destroy();
      if (inkRef.current === ink) inkRef.current = null;
    };
  }, [pathname]);

  return <canvas ref={canvasRef} className="ink-canvas" aria-hidden="true" data-html2canvas-ignore="true" />;
}

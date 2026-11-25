'use client';

import { useEffect, useRef } from 'react';
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ink = new InkTransition(canvas);
    inkRef.current = ink;
    // The transition is deliberately NOT recreated on navigation and it does not
    // capture snapshots in the background: rebuilding it disposed the GPU
    // textures and forced a fresh pair of full-page html2canvas snapshots on
    // every route change, which was the source of the background jank. The
    // theme switch captures on demand instead.
    return () => {
      ink.destroy();
      if (inkRef.current === ink) inkRef.current = null;
    };
  }, []);

  return <canvas ref={canvasRef} className="ink-canvas" aria-hidden="true" data-html2canvas-ignore="true" />;
}

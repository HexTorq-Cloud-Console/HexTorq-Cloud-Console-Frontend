'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { InkTransition, type Point } from './InkTransition';

/**
 * Mounts the ink-bleed theme transition overlay (exact port of
 * codemure-official/ink-bleed-theme-changer): a fixed WebGL2 canvas that blends
 * theme snapshots while the live DOM flips underneath.
 *
 * The layer lives in the root layout, so the singleton survives SPA navigation.
 */

const inkRef: { current: InkTransition | null } = { current: null };
let pendingToggleButton: HTMLButtonElement | null = null;

const TEXT_ENTRY =
  'input:not([type="range"]):not([type="checkbox"]):not([type="button"]), textarea, select, [contenteditable="true"]';

/** Registers the active ThemeToggle button for GSAP sun ↔ moon icon morphing. */
export function registerInkToggle(button: HTMLButtonElement | null): void {
  pendingToggleButton = button;
  inkRef.current?.registerToggle(button);
}

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
    if (pendingToggleButton) {
      ink.registerToggle(pendingToggleButton);
    }

    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target;
      if (target instanceof Element && target.closest(TEXT_ENTRY)) return;
      if (e.key.toLowerCase() === 't') {
        e.preventDefault();
        void ink.toggle();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      ink.destroy();
      if (inkRef.current === ink) inkRef.current = null;
    };
  }, []);

  // Refresh idle snapshots when navigating between console pages.
  useEffect(() => {
    inkRef.current?.refresh(500);
  }, [pathname]);

  return <canvas ref={canvasRef} className="ink-canvas" aria-hidden="true" data-html2canvas-ignore="true" />;
}

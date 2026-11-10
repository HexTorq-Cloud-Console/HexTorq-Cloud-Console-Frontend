/**
 * Minimal rAF tween — the exact subset the original ink-bleed demo used GSAP for:
 * a single eased scalar animation with `kill()` and `time()`. No dependency needed.
 *
 * Two details mirror GSAP so the transition behaves identically:
 *  - time is tracked in SECONDS (the shader's drift and the ink params are second-based);
 *  - lag smoothing: if the main thread stalls (e.g. an html2canvas capture), the frame
 *    only advances a little instead of jumping the animation to its end.
 */

export type EaseName = 'power3.out' | 'none';

export interface TweenLike {
  kill(): void;
  /** Seconds since the tween started (timeScale-adjusted). */
  time(): number;
  timeScale(scale: number): void;
}

/** A frame longer than this is treated as a stall. */
const MAX_LAG_MS = 500;
/** What a stalled frame is worth instead (GSAP's default is 33ms). */
const LAG_ADJUST_MS = 33;

const EASES: Record<EaseName, (t: number) => number> = {
  'power3.out': t => 1 - Math.pow(1 - t, 3),
  none: t => t,
};

export function tween(options: {
  duration: number;
  ease?: EaseName;
  /** Receives the eased scalar in 0..1. */
  onUpdate?: (value: number) => void;
  onComplete?: () => void;
}): TweenLike {
  const ease = EASES[options.ease ?? 'none'];
  let killed = false;
  let scale = 1;
  let origin = performance.now();
  // Virtual clock (ms): advances by the real frame delta, but a stalled frame only
  // advances by LAG_ADJUST_MS so the animation never jumps ahead.
  let virtual = origin;
  let elapsed = 0; // seconds
  let raf = 0;

  const step = (now: number): void => {
    if (killed) return;
    let delta = now - virtual;
    if (delta < 0) delta = 0;
    if (delta > MAX_LAG_MS) delta = LAG_ADJUST_MS;
    virtual += delta;

    elapsed = (virtual - origin) / 1000 / scale;
    const t = options.duration > 0 ? Math.min(1, elapsed / options.duration) : 1;
    const value = ease(t);
    options.onUpdate?.(value);
    if (t < 1) {
      raf = requestAnimationFrame(step);
    } else {
      raf = 0;
      options.onComplete?.();
    }
  };
  raf = requestAnimationFrame(step);

  return {
    kill(): void {
      killed = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    },
    time(): number {
      return elapsed;
    },
    timeScale(next): void {
      if (next <= 0 || next === scale) return;
      // Keep the current progress: re-base the clock so elapsed stays continuous.
      elapsed = (virtual - origin) / 1000 / scale;
      const now = performance.now();
      origin = now - elapsed * next * 1000;
      virtual = now;
      scale = next;
    },
  };
}

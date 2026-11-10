/**
 * Minimal rAF tween — the exact subset the original ink-bleed demo used GSAP for:
 * a single eased scalar animation with `kill()` and `time()`. No dependency needed.
 * (rAF-based, so it pauses naturally in background tabs, like the original.)
 */

export type EaseName = 'power3.out' | 'none';

export interface TweenLike {
  kill(): void;
  /** Seconds since the tween started (timeScale-adjusted). */
  time(): number;
  timeScale(scale: number): void;
}

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
  let start = performance.now();
  let elapsed = 0; // scaled seconds
  let raf = 0;

  const step = (now: number): void => {
    if (killed) return;
    elapsed = (now - start) / scale;
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
      const now = performance.now();
      start = now - elapsed * next; // keep the current scaled progress
      scale = next;
    },
  };
}

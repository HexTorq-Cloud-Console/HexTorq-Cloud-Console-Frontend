import gsap from 'gsap';
import { capturePage, layoutKey, renderScale } from './capture';
import { inkParams } from './gl/params';
import { InkRenderer, type InkFrame, type InkSource } from './gl/renderer';
import { applyTheme, getTheme, otherTheme, type Theme } from './theme';
import { ThemeIcon } from './ThemeIcon';

export interface Point {
  x: number;
  y: number;
}

const EASE = 'power3.out';
const FADE_OUT = 0.15;
const RESIZE_DEBOUNCE_MS = 250;
/** CSS cross-fade used without WebGL2 or before snapshots are ready. */
const CSS_FADE_S = 0.45;
/** Background snapshots wait until the user has been quiet for this long. */
const INTERACTION_QUIET_MS = 1200;

/**
 * Spread shape over time. `growth`: base radius at progress 1 relative to the farthest
 * corner. `cleanupFrom`: fraction of the (linear) duration after which a uniform extra
 * reach slowly eats whatever the noise left behind, so the page is fully covered exactly
 * at the end. `cleanupReach`: that extra reach at t = 1, relative to the farthest corner.
 */
export const SPREAD = { growth: 0.7, cleanupFrom: 0.45, cleanupReach: 0.4, cleanupPow: 2 };

type ActiveFrame = Omit<InkFrame, 'progress' | 'radius' | 'time' | 'cleanup'>;

/**
 * Orchestrates the ink-bleed theme transition (exact port of codemure-official/ink-bleed-theme-changer):
 *  1. pre-captures snapshots of both themes on idle/resize/route-change (and on demand
 *     if clicked before idle capture completes)
 *  2. on toggle, covers the page with the "from" image, flips the live DOM underneath,
 *     spreads the ink from the click point via WebGL2 + GSAP, morphs the sun/moon icon in
 *     lock-step, then fades the overlay onto the already-flipped page
 *  3. if toggled mid-spread, freezes the frame on screen and spreads the next ink over it
 *  4. falls back to a CSS colour cross-fade without WebGL2; under prefers-reduced-motion
 *     it switches instantly
 */
export class InkTransition {
  private readonly renderer: InkRenderer | null;
  private readonly state = { progress: 0, time: 0 };
  private toggleButton: HTMLButtonElement | null = null;
  private icon: ThemeIcon | null = null;
  private spread: gsap.core.Tween | null = null;
  private fade: gsap.core.Tween | null = null;
  private frame: ActiveFrame | null = null;
  private cssFadeTimer = 0;
  private captureGen = 0;
  private capturing = false;
  private captureQueued = false;
  private capturePromise: Promise<void> | null = null;
  private captureTimer = 0;
  private toggleGen = 0;
  private lastInteraction = 0;
  private disposers: Array<() => void> = [];

  constructor(canvas: HTMLCanvasElement) {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMotionChange = (): void => {
      this.icon?.set(getTheme());
      this.scheduleCapture(0);
    };
    reducedMotion.addEventListener('change', onMotionChange);
    this.disposers.push(() => reducedMotion.removeEventListener('change', onMotionChange));

    this.renderer = InkRenderer.create(canvas);
    if (!this.renderer) {
      document.documentElement.dataset.ink = 'css';
      return;
    }
    document.documentElement.dataset.ink = 'webgl';

    this.renderer.resize(renderScale());
    this.renderer.watchContext(
      () => this.cancel(),
      () => this.scheduleCapture(0),
    );

    const onResize = (): void => {
      this.renderer?.resize(renderScale());
      if (this.frame) this.draw();
      this.scheduleCapture(RESIZE_DEBOUNCE_MS);
    };
    window.addEventListener('resize', onResize);
    this.disposers.push(() => window.removeEventListener('resize', onResize));

    // Catches document-height changes that aren't window resizes (late fonts, data).
    const observer = new ResizeObserver(() => this.scheduleCapture(RESIZE_DEBOUNCE_MS));
    observer.observe(document.body);
    this.disposers.push(() => observer.disconnect());

    // Pre-capture once fonts settle so the first click animates immediately.
    void document.fonts.ready.then(() => {
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        this.scheduleCapture(300);
      }
    });

    const markInteraction = (): void => {
      this.lastInteraction = performance.now();
    };
    const interactions: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'wheel', 'pointermove'];
    for (const event of interactions) {
      window.addEventListener(event, markInteraction, { passive: true });
    }
    this.disposers.push(() => {
      for (const event of interactions) window.removeEventListener(event, markInteraction);
    });
  }

  get isAnimating(): boolean {
    return this.frame !== null;
  }

  /** Registers the live ThemeToggle button so ThemeIcon morphs in lock-step with the ink. */
  registerToggle(button: HTMLButtonElement | null): void {
    this.icon?.kill();
    this.toggleButton = button;
    this.icon = button ? new ThemeIcon(button) : null;
    this.icon?.set(getTheme());
    if (button) {
      button.setAttribute('aria-pressed', String(getTheme() === 'dark'));
    }
  }

  /** Requests a background snapshot refresh (e.g. after SPA route navigation). */
  refresh(delay = 300): void {
    this.scheduleCapture(delay);
  }

  /**
   * Toggle the theme, spreading from `point` (viewport CSS px) or from the toggle button.
   * `seed` reproduces a previous spread exactly.
   */
  async toggle(point?: Point, seed?: InkFrame['seed']): Promise<void> {
    const gen = ++this.toggleGen;
    const renderer = this.renderer;
    const to = otherTheme(getTheme());
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const scale = renderScale();
    const key = layoutKey(scale);
    const interrupting = this.frame !== null;

    // No WebGL2 (or a lost context) or reduced motion: straight swap.
    if (!renderer || renderer.isLost || reduced) {
      this.cancel();
      this.applyNow(to, !reduced);
      if (renderer && !reduced) this.scheduleCapture(0);
      return;
    }

    const valid = renderer.hasValid(to, key) && (interrupting || renderer.hasValid(getTheme(), key));
    if (valid) {
      if (gen === this.toggleGen) this.spreadInk(point, seed, interrupting);
      return;
    }

    // Interrupted spread without a usable target snapshot: plain fade.
    if (interrupting) {
      this.cancel();
      this.applyNow(to, true);
      this.scheduleCapture(0);
      return;
    }

    // Snapshots missing (e.g. clicked before idle capture finished or after scrolling a tall page):
    // capture on demand, then spread.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await this.captureAll(true);
      if (gen !== this.toggleGen) return;
      const key2 = layoutKey(renderScale());
      if (renderer.hasValid(to, key2) && renderer.hasValid(getTheme(), key2)) {
        this.spreadInk(point, seed, false);
        return;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 250));
    }

    this.applyNow(to, true);
    this.scheduleCapture(0);
  }

  destroy(): void {
    this.cancel();
    this.icon?.kill();
    this.toggleGen++;
    this.captureGen++;
    for (const dispose of this.disposers) dispose();
    this.disposers = [];
    window.clearTimeout(this.captureTimer);
    window.clearTimeout(this.cssFadeTimer);
    if (this.renderer) delete document.documentElement.dataset.ink;
    document.documentElement.removeAttribute('data-ink-active');
  }

  // ---------- internals ----------

  /** Plain swap, optionally softened by the short CSS colour cross-fade. */
  private applyNow(to: Theme, withFade: boolean): void {
    const root = document.documentElement;
    if (withFade) {
      root.style.setProperty('--theme-fade', `${CSS_FADE_S}s`);
      root.classList.add('theme-fade');
    }
    this.flipDomTheme(to);
    if (withFade) {
      this.icon?.morphTo(to, { duration: CSS_FADE_S * 1.6, ease: 'power2.inOut', timeScale: 1 });
      window.clearTimeout(this.cssFadeTimer);
      this.cssFadeTimer = window.setTimeout(() => {
        root.classList.remove('theme-fade');
        if (this.captureQueued) this.scheduleCapture(0);
      }, CSS_FADE_S * 1000 + 50);
    } else {
      this.icon?.set(to);
    }
  }

  private flipDomTheme(to: Theme): void {
    applyTheme(to);
    if (this.toggleButton) {
      this.toggleButton.setAttribute('aria-pressed', String(to === 'dark'));
    }
    window.dispatchEvent(new CustomEvent('hextorq-theme-change', { detail: to }));
  }

  private spreadInk(point?: Point, seed?: InkFrame['seed'], interrupting = false): void {
    const renderer = this.renderer;
    if (!renderer) return;
    const scale = renderScale();
    const to = otherTheme(getTheme());
    const center = point ?? this.toggleCenter();
    const maxDist = farthestCorner(center);
    const frameSeed = seed ?? randomSeed();

    let from: InkSource = getTheme();
    if (interrupting) {
      this.spread?.kill();
      this.fade?.kill();
      this.spread = null;
      this.fade = null;
      renderer.resize(scale);
      const frozen = this.currentFrame();
      from = frozen && renderer.freeze(frozen) ? 'composite' : getTheme();
    }

    this.frame = { from, to, center, maxDist, seed: frameSeed };
    this.state.progress = 0;
    this.state.time = 0;

    const chromeFrom = this.icon?.readChrome();
    renderer.resize(scale);
    this.draw();
    // Same task: the overlay (showing "from") and the flipped DOM hit the screen together.
    gsap.set(renderer.canvas, { opacity: 1 });
    renderer.canvas.classList.add('is-active');
    document.documentElement.setAttribute('data-ink-active', '1');
    this.flipDomTheme(to);

    const duration = inkParams.duration;
    this.icon?.morphTo(to, {
      duration,
      ease: EASE,
      timeScale: inkParams.timeScale,
      chromeFrom,
      chromeDelay: this.inkArrival(center, maxDist, this.toggleCenter()) * duration,
    });

    this.spread = gsap.to(this.state, {
      progress: 1,
      duration,
      ease: EASE,
      onUpdate: () => {
        this.state.time = this.spread?.time() ?? 0;
        this.draw();
      },
      onComplete: () => this.finish(),
    });
    this.spread.timeScale(inkParams.timeScale);
  }

  private currentFrame(): InkFrame | null {
    if (!this.frame) return null;
    const { progress, time } = this.state;
    const { maxDist } = this.frame;
    const linear = Math.min(1, time / inkParams.duration);
    const ramp = Math.max(0, (linear - SPREAD.cleanupFrom) / (1 - SPREAD.cleanupFrom));
    const cleanup =
      ramp ** SPREAD.cleanupPow * maxDist * SPREAD.cleanupReach + Math.max(0, (linear - 0.97) / 0.03) * maxDist;
    return { ...this.frame, progress, time, radius: progress * maxDist * SPREAD.growth, cleanup };
  }

  private draw(): void {
    const frame = this.currentFrame();
    if (this.renderer && frame) this.renderer.draw(frame);
  }

  private finish(): void {
    const canvas = this.renderer?.canvas;
    this.spread = null;
    if (!canvas) return;
    this.fade = gsap
      .to(canvas, { opacity: 0, duration: FADE_OUT, ease: 'none', onComplete: () => this.hide() })
      .timeScale(inkParams.timeScale);
  }

  private hide(): void {
    this.fade = null;
    this.frame = null;
    this.renderer?.canvas.classList.remove('is-active');
    document.documentElement.removeAttribute('data-ink-active');
    if (this.captureQueued) this.scheduleCapture(0);
  }

  private cancel(): void {
    if (!this.frame) return;
    this.spread?.kill();
    this.fade?.kill();
    this.spread = null;
    this.fade = null;
    this.hide();
  }

  /**
   * Fraction of the duration at which the base ink front reaches `target`.
   */
  private inkArrival(center: Point, maxDist: number, target: Point): number {
    const dist = Math.hypot(target.x - center.x, target.y - center.y);
    if (dist < 28) return 0;
    const p = Math.min(1, dist / (maxDist * SPREAD.growth * 1.15));
    return Math.min(0.85, 1 - Math.cbrt(1 - p));
  }

  private toggleCenter(): Point {
    const r = this.toggleButton?.getBoundingClientRect();
    if (!r) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  // ---------- capture scheduling ----------

  private scheduleCapture(delay: number): void {
    window.clearTimeout(this.captureTimer);
    this.captureTimer = window.setTimeout(() => {
      const run = (): void => void this.captureAll(false);
      if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(run, { timeout: 2000 });
      } else {
        window.setTimeout(run, 32);
      }
    }, delay);
  }

  private deferCapture(): void {
    this.captureQueued = true;
    this.scheduleCapture(RESIZE_DEBOUNCE_MS);
  }

  private captureAll(force = false): Promise<void> {
    if (this.capturePromise) return this.capturePromise;
    let promise: Promise<void>;
    promise = this.runCapture(force).finally(() => {
      if (this.capturePromise === promise) this.capturePromise = null;
    });
    this.capturePromise = promise;
    return promise;
  }

  private async runCapture(force: boolean): Promise<void> {
    const renderer = this.renderer;
    if (!renderer || renderer.isLost || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    if (this.capturing || this.frame || document.documentElement.classList.contains('theme-fade')) {
      this.deferCapture();
      return;
    }

    if (!force && performance.now() - this.lastInteraction < INTERACTION_QUIET_MS) {
      this.deferCapture();
      return;
    }

    if (document.querySelector('.ars')) {
      this.deferCapture();
      return;
    }

    const scale = renderScale();
    const key = layoutKey(scale);
    const current = getTheme();
    const themes: Theme[] = [current, otherTheme(current)].filter((t) => !renderer.hasValid(t, key));
    this.captureQueued = false;
    if (themes.length === 0) return;

    const gen = ++this.captureGen;
    this.capturing = true;
    try {
      for (const theme of themes) {
        const snap = await capturePage(theme, scale, renderer.maxTextureSize);
        if (gen !== this.captureGen) return;
        if (snap.key !== layoutKey(renderScale())) {
          this.captureQueued = true;
          break;
        }
        renderer.upload(snap);
      }
    } catch (err) {
      console.error('[ink] capture failed', err);
    } finally {
      this.capturing = false;
    }
    if (this.captureQueued) this.scheduleCapture(RESIZE_DEBOUNCE_MS);
  }
}

function farthestCorner(p: Point): number {
  const w = document.documentElement.clientWidth;
  const h = document.documentElement.clientHeight;
  return Math.max(Math.hypot(p.x, p.y), Math.hypot(w - p.x, p.y), Math.hypot(p.x, h - p.y), Math.hypot(w - p.x, h - p.y)) + 4;
}

function randomSeed(): InkFrame['seed'] {
  return { x: Math.random() * 64 - 32, y: Math.random() * 64 - 32, angle: Math.random() * Math.PI * 2 };
}

import { tween, type TweenLike } from './tween';
import { capturePage, layoutKey, renderScale } from './capture';
import { inkParams } from './gl/params';
import { InkRenderer, type InkFrame, type InkSource } from './gl/renderer';
import { applyTheme, getTheme, otherTheme, type Theme } from './theme';

export interface Point {
  x: number;
  y: number;
}

const FADE_OUT = 0.15;
const RESIZE_DEBOUNCE_MS = 250;
/** CSS cross-fade used without WebGL2 or before snapshots are ready. */
const CSS_FADE_S = 0.45;
/** Snapshots wait until the user has been quiet for this long. */
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
 * Orchestrates the theme transition (adapted from codemure-official/ink-bleed-theme-changer):
 *  1. keeps fresh snapshots of both themes on the GPU (captured on idle/resize/SPA
 *     navigation; re-captured on demand for a first click before they exist)
 *  2. on toggle, covers the page with the "from" image, flips the live DOM underneath,
 *     spreads the ink from the click point, then fades the overlay away onto the
 *     already-flipped page
 *  3. if toggled mid-spread, freezes the frame on screen and spreads the next ink over it
 *  4. falls back to a CSS colour cross-fade without WebGL2; under prefers-reduced-motion
 *     it switches instantly, like the console always did
 */
export class InkTransition {
  private readonly renderer: InkRenderer | null;
  private readonly state = { progress: 0, time: 0 };
  private spread: TweenLike | null = null;
  private fade: TweenLike | null = null;
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
    const onMotionChange = (): void => this.scheduleCapture(0);
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
      // Catches document-height changes that aren't window resizes (late fonts, data).
    };
    window.addEventListener('resize', onResize);
    this.disposers.push(() => window.removeEventListener('resize', onResize));

    const observer = new ResizeObserver(() => this.scheduleCapture(RESIZE_DEBOUNCE_MS));
    observer.observe(document.body);
    this.disposers.push(() => observer.disconnect());

    // Snapshots are skipped under reduced motion; take them if the preference is lifted.
    const onMotionReady = (): void => {
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) this.scheduleCapture(0);
    };
    void document.fonts.ready.then(onMotionReady);

    // Capturing blocks the main thread — never do it while the user is busy.
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

  /** The reducer-friendly way for the app shell to request snapshot refreshes. */
  refresh(delay = 0): void {
    this.scheduleCapture(delay);
  }

  /**
   * Toggle the theme, spreading from `point` (viewport CSS px) or from mid-stack.
   * `seed` reproduces a previous spread exactly (unused today, kept for replay tooling).
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

    // Snapshots missing (typical first click on a brand-new layout): capture both themes
    // on demand, then spread — the user still gets the ink transition, just a beat later.
    if (interrupting) {
      // Interrupted spread without a usable target snapshot: plain fade.
      this.cancel();
      this.applyNow(to, true);
      this.scheduleCapture(0);
      return;
    }

    await this.captureAll();
    if (gen !== this.toggleGen) return; // a newer click took over

    let key2 = layoutKey(renderScale());
    if (!renderer.hasValid(to, key2) || !renderer.hasValid(getTheme(), key2)) {
      // The wait above may have been deferred (the user is interacting); force a capture.
      await this.captureAll(true);
      if (gen !== this.toggleGen) return;
      key2 = layoutKey(renderScale());
    }

    if (renderer.hasValid(to, key2) && renderer.hasValid(getTheme(), key2)) {
      this.spreadInk(point, seed, false);
    } else {
      this.applyNow(to, true);
      this.scheduleCapture(0);
    }
  }

  destroy(): void {
    this.cancel();
    this.toggleGen++; // invalidate any in-flight toggle
    this.captureGen++; // invalidate any in-flight capture
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
    applyTheme(to);
    if (withFade) {
      window.clearTimeout(this.cssFadeTimer);
      this.cssFadeTimer = window.setTimeout(() => {
        root.classList.remove('theme-fade');
        if (this.captureQueued) this.scheduleCapture(0);
      }, CSS_FADE_S * 1000 + 50);
    }
  }

  private spreadInk(point?: Point, seed?: InkFrame['seed'], interrupting = false): void {
    const renderer = this.renderer;
    if (!renderer) return;
    const scale = renderScale();
    const to = otherTheme(getTheme());
    const center = point ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const maxDist = farthestCorner(center);
    const frameSeed = seed ?? randomSeed();

    let from: InkSource = getTheme();
    if (interrupting) {
      // Interrupted: freeze exactly what is on screen and spread the new ink over it.
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

    renderer.resize(scale);
    this.draw();
    // Same task: the overlay (showing "from") and the flipped DOM hit the screen together.
    renderer.canvas.style.opacity = '1';
    renderer.canvas.classList.add('is-active');
    document.documentElement.setAttribute('data-ink-active', '1');
    applyTheme(to);

    this.spread = tween({
      duration: inkParams.duration,
      ease: 'power3.out',
      onUpdate: (value) => {
        // The eased value IS the spread progress (0..1); the radius follows it.
        this.state.progress = value;
        // Tween-local seconds: slow motion slows the drift too, so it looks identical.
        if (this.spread) this.state.time = this.spread.time();
        this.draw();
      },
      onComplete: () => this.finish(),
    });
  }

  private currentFrame(): InkFrame | null {
    if (!this.frame) return null;
    const { progress, time } = this.state;
    const { maxDist } = this.frame;
    const linear = Math.min(1, time / inkParams.duration);
    const ramp = Math.max(0, (linear - SPREAD.cleanupFrom) / (1 - SPREAD.cleanupFrom));
    // Second term only acts in the last ~3% (≈40ms): a guarantee for unlucky seeds so the
    // final frame is exactly the "to" snapshot before the fade (measured residual is 0).
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
    this.fade = tween({
      duration: FADE_OUT,
      ease: 'none',
      onUpdate: (value) => {
        canvas.style.opacity = String(1 - value);
      },
      onComplete: () => this.hide(),
    });
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

  // ---------- capture scheduling ----------

  /**
   * Snapshots cost ~1s of main-thread time on a dashboard this size, so captures only
   * run when the browser is idle and the user isn't interacting. The transition itself
   * never waits for one: a click that finds no snapshot captures on demand first.
   */
  private scheduleCapture(delay: number): void {
    window.clearTimeout(this.captureTimer);
    this.captureTimer = window.setTimeout(() => {
      const run = (): void => void this.captureAll();
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

  /**
   * Snapshots the page in both themes. Concurrent callers share one run, so a click
   * that needs a snapshot can simply await the capture already in flight.
   * `force` ignores the "user is busy" guard (used by an explicit theme switch).
   */
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

    // Capturing blocks the main thread; never do it mid-animation (or mid CSS fade, which
    // would bake half-transitioned colours into the snapshot).
    if (this.capturing || this.frame || document.documentElement.classList.contains('theme-fade')) {
      this.deferCapture();
      return;
    }

    // Don't stall the page while the user is moving around (an explicit theme switch
    // asks for force and skips this).
    if (!force && performance.now() - this.lastInteraction < INTERACTION_QUIET_MS) {
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
          // Layout changed while capturing; this snapshot is already stale.
          this.captureQueued = true;
          break;
        }
        renderer.upload(snap);
        if (process.env.NODE_ENV !== 'production') {
          console.debug(`[ink] captured ${theme} ${snap.canvas.width}×${snap.canvas.height} in ${snap.ms.toFixed(0)}ms`);
        }
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
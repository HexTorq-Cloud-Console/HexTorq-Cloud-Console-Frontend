import type { Theme } from './theme';

/**
 * Full-document (or viewport-windowed on ultra-tall pages) snapshots of the page
 * in a given theme.
 *
 * We capture the whole document up to MAX_FULL_CAPTURE_HEIGHT so a snapshot stays valid
 * while the user scrolls; the shader picks the visible window using the live scroll
 * offset. For ultra-tall pages, we capture the active viewport window so html2canvas
 * stays fast and within GPU texture limits.
 */

export interface Snapshot {
  theme: Theme;
  canvas: HTMLCanvasElement;
  /** Texture pixels per CSS pixel. */
  scale: number;
  /** Layout this snapshot is valid for; see {@link layoutKey}. */
  key: string;
  /** Document CSS px origin of this snapshot (0,0 for full-doc captures). */
  originX: number;
  originY: number;
  /** Whether this snapshot covers the full document. */
  fullDoc: boolean;
  ms: number;
}

/**
 * Backdrop for unpainted clone areas, from the console tokens (`--ht-canvas`):
 * light #f5f5f2, dark #07080d. Kept in sync with app/tokens.css.
 */
const BACKGROUND: Record<Theme, string> = { light: '#f5f5f2', dark: '#07080d' };

const isCoarsePointer = (): boolean => window.matchMedia('(pointer: coarse)').matches;

/** Device-pixel ratio used for both the snapshots and the overlay canvas. */
export function renderScale(): number {
  const cap = isCoarsePointer() ? 1.5 : 2;
  return Math.min(window.devicePixelRatio || 1, cap);
}

export function documentSize(): { width: number; height: number } {
  const el = document.documentElement;
  return { width: el.clientWidth, height: Math.max(el.scrollHeight, el.clientHeight) };
}

/**
 * Captures the active viewport window so sticky elements (.shell-sidebar, .shell-topbar)
 * always align with the scrolled viewport and html2canvas stays fast on tall pages.
 */
export function layoutKey(scale: number): string {
  const { width, height } = documentSize();
  const path = typeof window !== 'undefined' ? window.location.pathname : '';
  return `view:${path}:${width}x${height}:${document.documentElement.clientHeight}@${scale}`;
}

export async function capturePage(theme: Theme, scale: number, maxTextureSize: number): Promise<Snapshot> {
  const t0 = performance.now();
  const key = layoutKey(scale);
  const { width, height: docHeight } = documentSize();
  const fullDoc = false;
  const originX = 0;
  const originY = Math.max(0, Math.floor(window.scrollY));
  const captureHeight = Math.min(Math.max(1, docHeight - originY), document.documentElement.clientHeight);

  // Never exceed what the GPU can hold; the shader handles scale != canvas DPR.
  const safeScale = Math.min(scale, maxTextureSize / width, maxTextureSize / Math.max(1, captureHeight));

  // Lazy-loaded: html2canvas is ~200 KB and only needed after first paint.
  const { default: html2canvas } = await import('html2canvas');
  const canvas = await html2canvas(document.body, {
    scale: safeScale,
    backgroundColor: BACKGROUND[theme],
    x: originX,
    y: originY,
    width,
    height: captureHeight,
    scrollX: 0,
    scrollY: 0,
    // The clone iframe renders without a scrollbar, so give it the live page's
    // scrollbar-less width; otherwise centred content shifts by half a scrollbar.
    windowWidth: width,
    windowHeight: document.documentElement.clientHeight,
    logging: false,
    useCORS: true,
    onclone: (doc) => {
      // Disable CSS transitions in the clone BEFORE flipping data-theme so html2canvas
      // never captures elements mid-140ms color transition. Keep animations intact so
      // elements with `animation: ... forwards` don't revert to opacity: 0.
      const noTrans = doc.createElement('style');
      noTrans.textContent = '*, *::before, *::after { transition: none !important; }';
      doc.head.appendChild(noTrans);

      doc.documentElement.dataset.theme = theme;
      void doc.documentElement.offsetHeight;

      // If capturing a scrolled viewport slice on a tall page, keep sticky chrome
      // aligned with the captured window.
      if (!fullDoc && originY > 0) {
        doc.querySelectorAll<HTMLElement>('.shell-sidebar, .shell-topbar').forEach((el) => {
          el.style.transform = `translateY(${originY}px)`;
        });
      }
      // The ASCII reveal keeps its overlay canvas in the DOM after it finishes, with the
      // last glyph frame still painted on it. Snapshotting that would freeze the glyphs
      // on top of the real text, so the overlay is left out of the capture.
      doc.querySelectorAll<HTMLElement>('.ar-overlay').forEach((el) => {
        el.style.visibility = 'hidden';
      });
      // html2canvas injects <html2canvaspseudoelement> inside void <input> toggles
      // (e.g. .notify-card__events input::after), where Chromium leaves computed styles
      // empty and triggers "unexpected EOF" in html2canvas's CSS parser.
      const view = doc.defaultView;
      if (view) {
        doc.querySelectorAll('html2canvaspseudoelement').forEach((pseudo) => {
          if (!view.getComputedStyle(pseudo).backgroundColor) {
            pseudo.remove();
          }
        });
      }
      // html2canvas chokes on large inset :autofill box-shadows (rendering the input
      // solid blue). Normalize text/email/password input surface colors cleanly.
      const inputBg = theme === 'dark' ? '#0b0d14' : '#fbfbf9';
      const inputFg = theme === 'dark' ? '#f4f5fa' : '#17181b';
      doc.querySelectorAll<HTMLInputElement>('input:not([type="checkbox"]):not([type="radio"])').forEach((input) => {
        input.style.setProperty('box-shadow', 'none', 'important');
        input.style.setProperty('background-color', inputBg, 'important');
        input.style.setProperty('color', inputFg, 'important');
        input.style.setProperty('-webkit-text-fill-color', inputFg, 'important');
      });

      sanitizeUnsupportedColors(doc);
      resolveSvgCssVars(doc, theme);
      flattenGradientText(doc);
    },
  });

  return { theme, canvas, scale: safeScale, key, originX, originY, fullDoc, ms: performance.now() - t0 };
}

const SVG_THEME_TOKENS: Record<Theme, Record<string, string>> = {
  light: {
    '--ht-chart-1': '#ef5b2a',
    '--ht-chart-2': '#0e9f9f',
    '--ht-chart-3': '#123b55',
    '--ht-chart-4': '#d99a06',
    '--ht-danger': '#d92d20',
    '--ht-line': '#e5e5df',
    '--ht-card': '#ffffff',
    '--ht-text': '#17181b',
    '--ht-text-secondary': '#5f646d',
    '--ht-text-muted': '#8a8f98',
  },
  dark: {
    '--ht-chart-1': '#4f7cff',
    '--ht-chart-2': '#2fd08a',
    '--ht-chart-3': '#8a3ffc',
    '--ht-chart-4': '#f5b83d',
    '--ht-danger': '#ff5c6c',
    '--ht-line': '#2d3448',
    '--ht-card': '#10131c',
    '--ht-text': '#f4f5fa',
    '--ht-text-secondary': '#b8c0d4',
    '--ht-text-muted': '#949db5',
  },
};

const COLOR4_RE = /\b(?:color|oklch|oklab|lab|lch)\([^)]+\)/gi;

const COLOR_PROPS = [
  ['color', 'color'],
  ['backgroundColor', 'background-color'],
  ['backgroundImage', 'background-image'],
  ['borderTopColor', 'border-top-color'],
  ['borderRightColor', 'border-right-color'],
  ['borderBottomColor', 'border-bottom-color'],
  ['borderLeftColor', 'border-left-color'],
  ['boxShadow', 'box-shadow'],
  ['textShadow', 'text-shadow'],
  ['textDecorationColor', 'text-decoration-color'],
  ['webkitTextStrokeColor', '-webkit-text-stroke-color'],
] as const;

/**
 * Chromium computes `color-mix()` / wide-gamut colors to `color(srgb ...)` or
 * `oklch(...)`, which html2canvas 1.4.1 cannot parse. Rasterize any offending
 * CSS Color 4 token via a lazy 1x1 canvas into standard `rgba(...)`.
 */
function sanitizeUnsupportedColors(doc: Document): void {
  const view = doc.defaultView;
  if (!view) return;
  const cache = new Map<string, string>();
  let ctx: CanvasRenderingContext2D | null = null;

  const toRgba = (token: string): string => {
    const cached = cache.get(token);
    if (cached) return cached;
    if (!ctx) {
      const c = doc.createElement('canvas');
      c.width = 1;
      c.height = 1;
      ctx = c.getContext('2d', { willReadFrequently: true });
    }
    if (!ctx) return 'transparent';
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = token;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    const rgba = `rgba(${r}, ${g}, ${b}, ${+(a / 255).toFixed(3)})`;
    cache.set(token, rgba);
    return rgba;
  };

  doc.querySelectorAll<HTMLElement>('*').forEach((el) => {
    const cs = view.getComputedStyle(el);
    for (const [camel, kebab] of COLOR_PROPS) {
      const val = cs[camel];
      if (!val || !COLOR4_RE.test(val)) continue;
      COLOR4_RE.lastIndex = 0;
      const fixed = val.replace(COLOR4_RE, (m) => toRgba(m));
      el.style.setProperty(kebab, fixed, 'important');
    }
  });
}

/**
 * html2canvas serializes inline <svg> elements into data-URI images where external
 * CSS classes and :root custom properties do not apply. Resolve var(--*) attributes
 * and inline class-based SVG text fills in the clone so charts match the live DOM.
 */
function resolveSvgCssVars(doc: Document, theme: Theme): void {
  const view = doc.defaultView;
  const rootStyle = view ? view.getComputedStyle(doc.documentElement) : null;
  const tokens = SVG_THEME_TOKENS[theme];
  const attrs = ['stroke', 'fill', 'stop-color'] as const;
  doc.querySelectorAll('svg *').forEach((el) => {
    const styled = el as unknown as { style?: CSSStyleDeclaration };
    for (const attr of attrs) {
      const val = el.getAttribute(attr);
      if (!val || !val.includes('var(')) continue;
      const resolved = val.replace(/var\(\s*(--[^,\s)]+)\s*(?:,[^)]*)?\)/g, (match, name: string) => {
        return tokens[name] || rootStyle?.getPropertyValue(name).trim() || match;
      });
      if (resolved !== val) {
        el.setAttribute(attr, resolved);
        styled.style?.setProperty(attr, resolved, 'important');
      }
    }
    if (el.classList.contains('donut-total')) {
      el.setAttribute('fill', tokens['--ht-text']);
      styled.style?.setProperty('fill', tokens['--ht-text'], 'important');
    } else if (
      el.classList.contains('donut-label') ||
      el.classList.contains('chart-axis-text') ||
      el.classList.contains('chart-empty-text')
    ) {
      el.setAttribute('fill', tokens['--ht-text-muted']);
      styled.style?.setProperty('fill', tokens['--ht-text-muted'], 'important');
    }
  });
}

/**
 * html2canvas can't clip a background to the glyph outlines, so gradient text — the
 * accent letters of the HEXTORQ wordmark, the tagline dots — is captured as a solid
 * block that swallows the letter. In the clone we swap the gradient for a flat colour
 * (the middle stop) so the letters stay readable while the ink spreads.
 *
 * Only the clone is touched: the live page keeps its real gradient.
 */
function flattenGradientText(doc: Document): void {
  const view = doc.defaultView;
  if (!view) return;
  for (const el of Array.from(doc.querySelectorAll<HTMLElement>('*'))) {
    if (el.children.length > 0) continue; // gradient text only lives on leaf elements
    const style = view.getComputedStyle(el);
    if (style.backgroundClip !== 'text' && style.webkitBackgroundClip !== 'text') continue;
    const flat = middleGradientColor(style.backgroundImage);
    if (!flat) continue;
    // Drop the gradient entirely and paint the glyph in a flat version of it: html2canvas
    // would otherwise fill the element's box with the gradient (a solid block) and the
    // transparent glyph on top would stay invisible.
    el.style.background = 'none';
    el.style.backgroundImage = 'none';
    el.style.webkitBackgroundClip = 'border-box';
    el.style.backgroundClip = 'border-box';
    el.style.color = flat;
    el.style.webkitTextFillColor = flat;
  }
}

/** The middle colour stop of a gradient, so a flat fill matches the gradient's midpoint. */
function middleGradientColor(image: string): string | null {
  const colors = image.match(/rgba?\([^)]+\)/g);
  if (!colors || colors.length === 0) return null;
  return colors[Math.floor((colors.length - 1) / 2)];
}

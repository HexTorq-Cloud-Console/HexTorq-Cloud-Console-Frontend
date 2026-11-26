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
 * Above this document height we capture a viewport-sized window instead of the
 * full scrollHeight so html2canvas stays snappy and never exceeds GPU texture limits.
 */
export const MAX_FULL_CAPTURE_HEIGHT = 4500;

/**
 * Identifies the layout a snapshot depends on. Viewport height is deliberately
 * excluded for full-doc captures (mobile URL-bar show/hide changes it without reflowing).
 */
export function layoutKey(scale: number): string {
  const { width, height } = documentSize();
  if (height <= MAX_FULL_CAPTURE_HEIGHT) {
    return `full:${width}x${height}@${scale}`;
  }
  return `view:${width}x${document.documentElement.clientHeight}@${scale}`;
}

export async function capturePage(theme: Theme, scale: number, maxTextureSize: number): Promise<Snapshot> {
  const t0 = performance.now();
  const key = layoutKey(scale);
  const { width, height: docHeight } = documentSize();
  const fullDoc = docHeight <= MAX_FULL_CAPTURE_HEIGHT;
  const originX = 0;
  const originY = fullDoc ? 0 : Math.max(0, Math.floor(window.scrollY));
  const captureHeight = fullDoc
    ? docHeight
    : Math.min(docHeight - originY, document.documentElement.clientHeight);

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
      doc.documentElement.dataset.theme = theme;
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
  },
  dark: {
    '--ht-chart-1': '#4f7cff',
    '--ht-chart-2': '#2fd08a',
    '--ht-chart-3': '#8a3ffc',
    '--ht-chart-4': '#f5b83d',
    '--ht-danger': '#ff5c6c',
  },
};

/**
 * html2canvas doesn't resolve CSS custom properties inside SVG presentation attributes
 * (`stroke="var(--ht-chart-1)"`, `stop-color="var(--ht-chart-2)"`). Resolve them in the
 * clone using the target theme's tokens so charts match the live DOM pixel-for-pixel.
 */
function resolveSvgCssVars(doc: Document, theme: Theme): void {
  const view = doc.defaultView;
  const rootStyle = view ? view.getComputedStyle(doc.documentElement) : null;
  const tokens = SVG_THEME_TOKENS[theme];
  const attrs = ['stroke', 'fill', 'stop-color'] as const;
  doc.querySelectorAll('svg *').forEach((el) => {
    for (const attr of attrs) {
      const val = el.getAttribute(attr);
      if (!val || !val.includes('var(')) continue;
      const resolved = val.replace(/var\(\s*(--[^,\s)]+)\s*(?:,[^)]*)?\)/g, (match, name: string) => {
        return tokens[name] || rootStyle?.getPropertyValue(name).trim() || match;
      });
      if (resolved !== val) el.setAttribute(attr, resolved);
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

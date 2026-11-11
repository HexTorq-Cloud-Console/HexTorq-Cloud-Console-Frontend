import type { Theme } from './theme';

/**
 * Full-document snapshots of the page in a given theme.
 *
 * We capture the whole document (not just the viewport) so a snapshot stays valid
 * while the user scrolls; the shader picks the visible window using the live scroll
 * offset. The theme is applied to html2canvas' *cloned* document via `onclone`, so the
 * live page never flickers during capture.
 */

export interface Snapshot {
  theme: Theme;
  canvas: HTMLCanvasElement;
  /** Texture pixels per CSS pixel. */
  scale: number;
  /** Layout this snapshot is valid for; see {@link layoutKey}. */
  key: string;
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
 * Identifies the layout a snapshot depends on. Viewport height is deliberately
 * excluded (mobile URL-bar show/hide changes it without reflowing the document).
 */
export function layoutKey(scale: number): string {
  const { width, height } = documentSize();
  return `${width}x${height}@${scale}`;
}

export async function capturePage(theme: Theme, scale: number, maxTextureSize: number): Promise<Snapshot> {
  const t0 = performance.now();
  const key = layoutKey(scale);
  const { width, height } = documentSize();

  // Never exceed what the GPU can hold; the shader handles scale != canvas DPR.
  const safeScale = Math.min(scale, maxTextureSize / width, maxTextureSize / height);

  // Lazy-loaded: html2canvas is ~200 KB and only needed after first paint.
  const { default: html2canvas } = await import('html2canvas');
  const canvas = await html2canvas(document.body, {
    scale: safeScale,
    backgroundColor: BACKGROUND[theme],
    x: 0,
    y: 0,
    width,
    height,
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
      // The live toggles are drawn above the overlay, so leave holes for them.
      // `visibility` (not data-html2canvas-ignore) keeps their box in the layout
      // so the topbar doesn't shift.
      doc.querySelectorAll<HTMLElement>('[data-ink-live]').forEach((el) => {
        el.style.visibility = 'hidden';
      });
      flattenGradientText(doc);
    },
  });

  return { theme, canvas, scale: safeScale, key, ms: performance.now() - t0 };
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

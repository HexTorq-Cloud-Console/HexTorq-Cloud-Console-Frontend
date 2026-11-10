import type { Theme } from '../theme';

/** Live look of the ink. Kept identical to the reference implementation. */
export interface InkParams {
  /** Seconds for the spread (before the 150ms fade). */
  duration: number;
  /** Tendril reach multiplier, 0 = clean blob. */
  tendril: number;
  /** Noise frequency multiplier: lower = bigger, lazier shapes. */
  noiseScale: number;
  /** Frontier half-width in CSS px. */
  softness: number;
  /** Speed at which the shape evolves during the spread. */
  drift: number;
}

export const inkParams: InkParams = {
  duration: 1.4,
  tendril: 1,
  noiseScale: 1,
  softness: 1.4,
  drift: 1,
};

/**
 * Pigment colour pooled at the frontier, keyed by the theme being revealed —
 * a touch punchier than the console's canvas tokens (#f5f5f2 / #07080d).
 */
export const RIM_COLOR: Record<Theme, [number, number, number]> = {
  dark: [0.0, 0.0, 0.008], // ink: denser than the dark canvas
  light: [1.0, 1.0, 0.97], // bleach: brighter than the light canvas
};

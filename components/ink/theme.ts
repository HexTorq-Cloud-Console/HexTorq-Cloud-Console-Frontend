export type Theme = 'light' | 'dark';

const META_COLOR: Record<Theme, string> = { light: '#f5f5f2', dark: '#07080d' };

export function getTheme(): Theme {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function otherTheme(theme: Theme): Theme {
  return theme === 'dark' ? 'light' : 'dark';
}

/**
 * Instantly flips the live DOM to `theme` and persists the choice — the exact
 * writes the console's own ThemeToggle performs, kept in one place because the
 * ink transition owns the flip while it animates.
 */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    window.localStorage.setItem('hextorq-theme', theme);
  } catch {
    // Storage unavailable (private mode etc.) — the attribute flip still applies.
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', META_COLOR[theme]);
}

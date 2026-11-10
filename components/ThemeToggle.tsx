'use client';

import { useEffect, useState } from 'react';
import { requestInkThemeToggle } from './ink/InkThemeLayer';

type Theme = 'light' | 'dark';

const THEME_KEY = 'hextorq-theme';

function currentTheme(): Theme {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export default function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    setTheme(currentTheme());
  }, []);

  function toggleTheme(event: React.MouseEvent<HTMLButtonElement>) {
    // Read the live theme, not the rendered state: the ink transition owns the DOM flip,
    // so a second click during a spread must reverse the theme that is actually applied.
    const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark';
    setTheme(next);

    // The ink spreads from the pointer; a keyboard activation spreads from the button.
    const rect = event.currentTarget.getBoundingClientRect();
    const point =
      event.detail > 0
        ? { x: event.clientX, y: event.clientY }
        : { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };

    // The ink layer flips the DOM itself; it reports false when it can't (no WebGL2,
    // not mounted yet) and we fall back to an instant swap.
    if (requestInkThemeToggle(point)) return;

    document.documentElement.dataset.theme = next;
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      document.documentElement.dataset.theme = next;
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', next === 'dark' ? '#07080d' : '#f5f5f2');
  }

  const label = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';

  return (
    <button
      type="button"
      className={`theme-toggle${className ? ` ${className}` : ''}`}
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      data-ink-live="true"
    >
      {theme === 'dark' ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
        </svg>
      )}
    </button>
  );
}

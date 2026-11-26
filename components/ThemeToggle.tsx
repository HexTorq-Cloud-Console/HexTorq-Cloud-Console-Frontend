'use client';

import { useEffect, useRef, useState } from 'react';
import { registerInkToggle, requestInkThemeToggle } from './ink/InkThemeLayer';

type Theme = 'light' | 'dark';

const THEME_KEY = 'hextorq-theme';

function currentTheme(): Theme {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export default function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>('light');
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setTheme(currentTheme());
    const button = buttonRef.current;
    registerInkToggle(button);

    const onThemeChange = (e: Event): void => {
      const next = (e as CustomEvent<Theme>).detail;
      if (next === 'light' || next === 'dark') {
        setTheme(next);
      }
    };
    window.addEventListener('hextorq-theme-change', onThemeChange);
    return () => {
      window.removeEventListener('hextorq-theme-change', onThemeChange);
      registerInkToggle(null);
    };
  }, []);

  function toggleTheme(event: React.MouseEvent<HTMLButtonElement>) {
    // Read the live theme, not the rendered state: the ink transition owns the DOM flip,
    // so a second click during a spread must reverse the theme that is actually applied.
    const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark';

    // The ink spreads from the pointer; a keyboard activation spreads from the button.
    const rect = event.currentTarget.getBoundingClientRect();
    const point =
      event.detail > 0
        ? { x: event.clientX, y: event.clientY }
        : { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };

    // The ink layer flips the DOM and morphs the icon itself; it returns false only
    // before hydration or if the layer isn't mounted.
    if (requestInkThemeToggle(point)) return;

    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      document.documentElement.dataset.theme = next;
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', next === 'dark' ? '#07080d' : '#f5f5f2');
  }

  const label = theme === 'dark' ? 'Switch to light theme (T)' : 'Switch to dark theme (T)';

  return (
    <button
      ref={buttonRef}
      type="button"
      className={`theme-toggle${className ? ` ${className}` : ''}`}
      onClick={toggleTheme}
      aria-label={label}
      aria-pressed={theme === 'dark'}
      title={label}
      data-ink-live="true"
    >
      <svg className="theme-toggle__icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        {/* Sun body; morphed into the moon crescent by components/ink/ThemeIcon.ts */}
        <path className="theme-toggle__body" d="M12 7a5 5 0 1 1 0 10a5 5 0 1 1 0-10z" />
        <g className="theme-toggle__rays">
          <line x1="12" y1="1.5" x2="12" y2="3.5" />
          <line x1="12" y1="20.5" x2="12" y2="22.5" />
          <line x1="1.5" y1="12" x2="3.5" y2="12" />
          <line x1="20.5" y1="12" x2="22.5" y2="12" />
          <line x1="4.58" y1="4.58" x2="6" y2="6" />
          <line x1="18" y1="18" x2="19.42" y2="19.42" />
          <line x1="4.58" y1="19.42" x2="6" y2="18" />
          <line x1="18" y1="6" x2="19.42" y2="4.58" />
        </g>
      </svg>
    </button>
  );
}

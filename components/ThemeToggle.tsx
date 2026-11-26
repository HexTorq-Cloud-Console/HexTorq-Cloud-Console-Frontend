'use client';

import { useEffect, useState } from 'react';
import { requestInkThemeToggle } from './ink/InkThemeLayer';
import { ThemeSwitch } from './ui/theme-switch';

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

    const onThemeChange = (e: Event): void => {
      const next = (e as CustomEvent<Theme>).detail;
      if (next === 'light' || next === 'dark') {
        setTheme(next);
      }
    };
    window.addEventListener('hextorq-theme-change', onThemeChange);
    return () => {
      window.removeEventListener('hextorq-theme-change', onThemeChange);
    };
  }, []);

  function handleCheckedChange(checked: boolean, point?: { x: number; y: number }) {
    const next: Theme = checked ? 'dark' : 'light';

    // Let the existing InkThemeLayer spread handle the transition untouched;
    // fall back to immediate DOM swap only before hydration or without WebGL.
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
    <ThemeSwitch
      checked={theme === 'dark'}
      onCheckedChange={handleCheckedChange}
      ariaLabel={label}
      title={label}
      showCaption={false}
      size="topbar"
      inkLive
      className={`theme-toggle theme-toggle--pill${className ? ` ${className}` : ''}`}
    />
  );
}

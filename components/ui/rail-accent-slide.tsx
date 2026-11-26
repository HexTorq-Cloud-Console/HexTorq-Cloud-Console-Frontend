'use client';

import * as React from 'react';

export interface RailAccentSlideItem {
  id: string;
  label: string;
  href?: string;
  icon: React.ReactNode;
}

export interface RailAccentSlideProps {
  /** Navigation items rendered along the vertical rail. Defaults to the 4 reference items. */
  items?: RailAccentSlideItem[];
  /** Controlled active item id. */
  value?: string;
  /** Initial active item id when uncontrolled. Defaults to the first item. */
  defaultValue?: string;
  /** Called when an item is activated. */
  onValueChange?: (id: string, index: number) => void;
  /** Accessible label for the `<nav>` landmark. */
  ariaLabel?: string;
  /** Additional class names on the `<nav className="nv-rl">` container. */
  className?: string;
  /** Surface tone: `'dark'` matches the dark translucent rail; `'auto'` adapts to `data-theme`. */
  surface?: 'dark' | 'auto';
}

const DEFAULT_ITEMS: RailAccentSlideItem[] = [
  {
    id: 'home',
    label: 'Home',
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M3 12L12 3l9 9" />
        <path d="M5 10v10h14V10" />
      </svg>
    ),
  },
  {
    id: 'overview',
    label: 'Grid',
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    id: 'messages',
    label: 'Messages',
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
      </svg>
    ),
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

export function RailAccentSlide({
  items = DEFAULT_ITEMS,
  value,
  defaultValue,
  onValueChange,
  ariaLabel = 'Rail navigation',
  className,
  surface = 'dark',
}: RailAccentSlideProps) {
  const isControlled = value !== undefined;
  const [internalId, setInternalId] = React.useState<string>(
    () => defaultValue ?? items[0]?.id ?? ''
  );

  const activeId = isControlled ? value : internalId;
  const activeIndex = Math.max(
    0,
    items.findIndex((item) => item.id === activeId)
  );

  const rootRef = React.useRef<HTMLElement | null>(null);
  const barRef = React.useRef<HTMLSpanElement | null>(null);
  const itemRefs = React.useRef<Array<HTMLButtonElement | HTMLAnchorElement | null>>([]);

  const syncBarPosition = React.useCallback(() => {
    const bar = barRef.current;
    const activeEl = itemRefs.current[activeIndex];
    if (!bar || !activeEl) return;
    bar.style.transform = `translateY(${activeEl.offsetTop - 10}px)`;
  }, [activeIndex]);

  React.useLayoutEffect(() => {
    const raf = window.requestAnimationFrame(syncBarPosition);
    const root = rootRef.current;
    const observer =
      typeof ResizeObserver !== 'undefined' && root
        ? new ResizeObserver(() => syncBarPosition())
        : null;
    if (observer && root) observer.observe(root);

    return () => {
      window.cancelAnimationFrame(raf);
      observer?.disconnect();
    };
  }, [syncBarPosition, items.length]);

  const handleSelect = (item: RailAccentSlideItem, index: number) => {
    if (!isControlled) setInternalId(item.id);
    onValueChange?.(item.id, index);
  };

  const navClassName = ['nv-rl', className].filter(Boolean).join(' ');

  return (
    <nav ref={rootRef} className={navClassName} aria-label={ariaLabel} data-surface={surface}>
      <span ref={barRef} className="nv-rl-bar" aria-hidden="true" />
      {items.map((item, index) => {
        const isActive = index === activeIndex;
        const itemClassName = `nv-rl-i${isActive ? ' is-on' : ''}`;

        if (item.href) {
          return (
            <a
              key={item.id}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              href={item.href}
              className={itemClassName}
              data-i={index}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              title={item.label}
              onClick={() => handleSelect(item, index)}
            >
              {item.icon}
            </a>
          );
        }

        return (
          <button
            key={item.id}
            ref={(el) => {
              itemRefs.current[index] = el;
            }}
            type="button"
            className={itemClassName}
            data-i={index}
            aria-label={item.label}
            aria-pressed={isActive}
            title={item.label}
            onClick={() => handleSelect(item, index)}
          >
            {item.icon}
          </button>
        );
      })}
    </nav>
  );
}

export default RailAccentSlide;

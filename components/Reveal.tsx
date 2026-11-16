'use client';

import { useEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from 'react';

type RevealProps = {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  /** Stagger, in milliseconds. */
  delay?: number;
  style?: CSSProperties;
};

/**
 * Smooth scroll/intro reveal.
 *
 * The element is visible in the server-rendered markup, so the page never
 * renders blank if JavaScript fails. On mount it is armed (hidden) and then
 * revealed when it enters the viewport, which keeps it in step with Lenis:
 * Lenis scrolls the real window, so the observer fires exactly as the smooth
 * scroll reaches the element.
 *
 * Safety nets: reduced-motion users and a timeout fallback always reveal it.
 */
export default function Reveal({ children, as: Tag = 'div', className = '', delay = 0, style }: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [state, setState] = useState<'idle' | 'armed' | 'revealed'>('idle');

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { setState('revealed'); return; }

    let frame = 0;
    let observer: IntersectionObserver | null = null;

    // Arm on the next frame so the browser paints the hidden state first and
    // the reveal actually transitions instead of snapping.
    frame = requestAnimationFrame(() => {
      setState('armed');
      requestAnimationFrame(() => {
        if (typeof IntersectionObserver === 'undefined') { setState('revealed'); return; }
        observer = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (!entry.isIntersecting) continue;
              setState('revealed');
              observer?.disconnect();
            }
          },
          { threshold: 0.12, rootMargin: '0px 0px 40px 0px' },
        );
        observer.observe(node);
      });
    });

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, []);

  const classes = ['reveal', state === 'armed' ? 'is-armed' : '', state === 'revealed' ? 'is-revealed' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <Tag
      ref={ref as never}
      className={classes}
      style={{ ...style, ['--reveal-delay' as string]: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}

'use client';

import * as React from 'react';

export interface FlowFieldProps {
  /** Theme mode: `'auto'` tracks `document.documentElement.dataset.theme` (`light` | `dark`). */
  theme?: 'auto' | 'light' | 'dark';
  /** Particle count multiplier (default `1`). */
  density?: number;
  /** Spatial scale of the 3D value-noise flow field (default `0.0017`). */
  detail?: number;
  /** Number of turns the field twists through (default `2.2`). */
  curl?: number;
  /** Base stroke width in CSS pixels (default `1`). */
  thickness?: number;
  /** Additional classes on `.bg-flow-field-root`. */
  className?: string;
}

const TAU = Math.PI * 2;

function hash3(x: number, y: number, z: number): number {
  let n = (x | 0) * 374761393 + (y | 0) * 668265263 + (z | 0) * 1442695040;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967295;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function vnoise3(x: number, y: number, z: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const xf = x - xi;
  const yf = y - yi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const w = zf * zf * (3 - 2 * zf);

  const c000 = hash3(xi, yi, zi);
  const c100 = hash3(xi + 1, yi, zi);
  const c010 = hash3(xi, yi + 1, zi);
  const c110 = hash3(xi + 1, yi + 1, zi);
  const c001 = hash3(xi, yi, zi + 1);
  const c101 = hash3(xi + 1, yi, zi + 1);
  const c011 = hash3(xi, yi + 1, zi + 1);
  const c111 = hash3(xi + 1, yi + 1, zi + 1);

  const x00 = lerp(c000, c100, u);
  const x10 = lerp(c010, c110, u);
  const x01 = lerp(c001, c101, u);
  const x11 = lerp(c011, c111, u);
  return lerp(lerp(x00, x10, v), lerp(x01, x11, v), w);
}

type Particle = {
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  spd: number;
  bright: number;
};

function resolveTheme(mode: 'auto' | 'light' | 'dark'): 'light' | 'dark' {
  if (mode === 'light' || mode === 'dark') return mode;
  if (typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark') {
    return 'dark';
  }
  return 'light';
}

export function FlowField({
  theme = 'auto',
  density = 1,
  detail = 0.0017,
  curl = 2.2,
  thickness = 1,
  className,
}: FlowFieldProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [resolvedTheme, setResolvedTheme] = React.useState<'light' | 'dark'>(() => resolveTheme(theme));
  const themeRef = React.useRef<'light' | 'dark'>(resolvedTheme);

  React.useEffect(() => {
    const sync = () => {
      const next = resolveTheme(theme);
      themeRef.current = next;
      setResolvedTheme(next);
    };
    sync();
    if (theme !== 'auto') return;

    const mo = new MutationObserver(sync);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const onThemeEvent = () => sync();
    window.addEventListener('hextorq-theme-change', onThemeEvent);
    return () => {
      mo.disconnect();
      window.removeEventListener('hextorq-theme-change', onThemeEvent);
    };
  }, [theme]);

  React.useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let W = 0;
    let H = 0;
    let rot = 0;
    const particles: Particle[] = [];
    let count = 0;
    let lastDrawnTheme: 'light' | 'dark' = themeRef.current;

    function fieldAngle(x: number, y: number, tt: number) {
      let n = vnoise3(x * detail, y * detail, tt * 0.11);
      n += 0.5 * vnoise3(x * detail * 2.2, y * detail * 2.2, tt * 0.11 + 17.3);
      n /= 1.5;
      return n * TAU * curl + rot;
    }

    function spawn(p: Particle) {
      p.x = Math.random() * W;
      p.y = Math.random() * H;
      p.px = p.x;
      p.py = p.y;
      p.vx = 0;
      p.vy = 0;
      p.life = 0;
      p.max = 4 + Math.random() * 7;
      p.spd = 42 + Math.random() * Math.random() * 108;
      p.bright = 0.6 + Math.random() * 0.6;
    }

    function desiredCount() {
      return Math.round(Math.max(340, Math.min(500, (W * H) / 2050)) * density);
    }

    function syncParticles() {
      const target = desiredCount();
      if (particles.length === 0) {
        for (let i = 0; i < target; i += 1) {
          const p = {} as Particle;
          spawn(p);
          p.life = Math.random() * p.max;
          particles.push(p);
        }
      } else if (target > particles.length) {
        while (particles.length < target) {
          const q = {} as Particle;
          spawn(q);
          particles.push(q);
        }
      } else if (target < particles.length) {
        particles.length = target;
      }
      count = particles.length;
    }

    function paintBase(mode: 'light' | 'dark') {
      if (!ctx || !c) return;
      ctx.globalCompositeOperation = 'source-over';
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = mode === 'dark' ? '#060b13' : '#f2f6fc';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function resize() {
      if (!c || !ctx) return;
      W = window.innerWidth;
      H = window.innerHeight;
      c.width = Math.floor(W * dpr);
      c.height = Math.floor(H * dpr);
      c.style.width = `${W}px`;
      c.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      syncParticles();
      lastDrawnTheme = themeRef.current;
      paintBase(lastDrawnTheme);
    }

    let mx = -9999;
    let my = -9999;
    let hasMouse = false;

    const onPointerMove = (e: PointerEvent) => {
      mx = e.clientX;
      my = e.clientY;
      hasMouse = true;
    };
    const onPointerLeave = () => {
      hasMouse = false;
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerleave', onPointerLeave);
    window.addEventListener('resize', resize);
    resize();

    let t = 0;
    let start = Date.now();
    let last = start;
    let raf = 0;
    let running = true;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function stepFrame(dt: number) {
      if (!ctx) return;
      const activeTheme = themeRef.current;
      if (activeTheme !== lastDrawnTheme) {
        lastDrawnTheme = activeTheme;
        paintBase(activeTheme);
      }

      rot = t * 0.024;
      const vx = W * (0.5 + 0.3 * Math.sin(t * 0.11) + 0.11 * Math.sin(t * 0.37 + 1.3));
      const vy = H * (0.48 + 0.24 * Math.cos(t * 0.09) + 0.08 * Math.cos(t * 0.28 + 0.6));
      const cx = hasMouse ? mx : vx;
      const cy = hasMouse ? my : vy;
      const swirlStrength = hasMouse ? 240 : 175;
      const R = 230;
      const R2 = R * R;

      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = activeTheme === 'dark' ? 'rgba(6, 11, 19, 0.044)' : 'rgba(242, 246, 252, 0.068)';
      ctx.fillRect(0, 0, W, H);

      ctx.globalCompositeOperation = activeTheme === 'dark' ? 'lighter' : 'source-over';
      ctx.lineCap = 'round';

      for (let i = 0; i < count; i += 1) {
        const p = particles[i];
        const a = fieldAngle(p.x, p.y, t);
        let svx = Math.cos(a) * p.spd;
        let svy = Math.sin(a) * p.spd;

        const dx = p.x - cx;
        const dy = p.y - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 < R2) {
          const d = Math.sqrt(d2) + 0.001;
          let fall = 1 - d / R;
          fall *= fall;
          const tx = -dy / d;
          const ty = dx / d;
          svx += tx * swirlStrength * fall + (-dx / d) * 46 * fall;
          svy += ty * swirlStrength * fall + (-dy / d) * 46 * fall;
        }

        p.vx += (svx - p.vx) * 0.22;
        p.vy += (svy - p.vy) * 0.22;
        p.px = p.x;
        p.py = p.y;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life += dt;

        if (p.life > p.max || p.x < -30 || p.x > W + 30 || p.y < -30 || p.y > H + 30) {
          spawn(p);
          continue;
        }

        const v = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        let e = (v - 22) / 150;
        if (e < 0) e = 0;
        else if (e > 1) e = 1;
        const e2 = e * e;

        const lf = p.life / p.max;
        const env = lf < 0.15 ? lf / 0.15 : lf > 0.82 ? (1 - lf) / 0.18 : 1;

        let r: number;
        let g: number;
        let b: number;
        let alpha: number;
        if (activeTheme === 'dark') {
          r = 26 + (74 - 26) * e2;
          g = 86 + (157 - 86) * e;
          b = 146 + (253 - 146) * e;
          alpha = (0.14 + e2 * 0.5) * p.bright * env;
        } else {
          // Deep ocean teal -> sapphire-blue ink streams for high-contrast light mode
          r = 18 + (37 - 18) * e2;
          g = 116 + (99 - 116) * e;
          b = 162 + (235 - 162) * e;
          alpha = (0.16 + e2 * 0.44) * p.bright * env;
        }

        ctx.strokeStyle = `rgba(${r | 0},${g | 0},${b | 0},${alpha.toFixed(3)})`;
        ctx.lineWidth = thickness + e * 1.9;
        ctx.beginPath();
        ctx.moveTo(p.px, p.py);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }

      ctx.globalCompositeOperation = 'source-over';
    }

    function frame() {
      const now = Date.now();
      t = (now - start) / 1000;
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.05) dt = 0.05;
      stepFrame(dt);
      if (running) raf = requestAnimationFrame(frame);
    }

    if (reducedMotion) {
      for (let i = 0; i < 24; i += 1) {
        t += 0.033;
        stepFrame(0.033);
      }
    } else {
      frame();
    }

    const onVisibilityChange = () => {
      if (reducedMotion) return;
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        last = Date.now();
        start = Date.now() - t * 1000;
        frame();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [density, detail, curl, thickness]);

  const rootClass = ['bg-flow-field-root', className].filter(Boolean).join(' ');

  return (
    <div className={rootClass} data-theme={resolvedTheme} aria-hidden="true">
      <canvas ref={canvasRef} className="bg-flow-field-canvas" />
    </div>
  );
}

export default FlowField;

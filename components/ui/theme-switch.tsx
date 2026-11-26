'use client';

import * as React from 'react';

export interface ThemeSwitchProps {
  /** Controlled checked state (`true` = Dark / moon, `false` = Light / sun). */
  checked?: boolean;
  /** Initial checked state when uncontrolled. Defaults to `true` (Dark mode). */
  defaultChecked?: boolean;
  /** Called whenever the user toggles the switch, with optional pointer coordinates. */
  onCheckedChange?: (checked: boolean, point?: { x: number; y: number }) => void;
  /** Accessible label read by screen readers. */
  ariaLabel?: string;
  /** Tooltip title attribute. */
  title?: string;
  /** Whether to show the `"Light" / "Dark"` caption below the pill. Defaults to `true`. */
  showCaption?: boolean;
  /** `'default'` renders the full 196×80 reference pill; `'topbar'` scales proportionally to fit compact headers. */
  size?: 'default' | 'topbar';
  /** Additional classes placed on the outer `<label>` element. */
  className?: string;
  /** Passed through as `data-ink-live` when participating in ink theme transitions. */
  inkLive?: boolean;
}

export function ThemeSwitch({
  checked,
  defaultChecked = true,
  onCheckedChange,
  ariaLabel = 'Toggle light and dark theme',
  title,
  showCaption = true,
  size = 'default',
  className,
  inkLive,
}: ThemeSwitchProps) {
  const isControlled = checked !== undefined;
  const [internalChecked, setInternalChecked] = React.useState(defaultChecked);
  const isChecked = isControlled ? checked : internalChecked;

  const trackRef = React.useRef<HTMLSpanElement>(null);
  const pointerRef = React.useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = (event: React.PointerEvent<HTMLLabelElement>) => {
    if (event.clientX || event.clientY) {
      pointerRef.current = { x: event.clientX, y: event.clientY };
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.currentTarget.checked;
    if (!isControlled) {
      setInternalChecked(next);
    }

    let point = pointerRef.current ?? undefined;
    pointerRef.current = null;

    if (!point && trackRef.current) {
      const rect = trackRef.current.getBoundingClientRect();
      point = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }

    onCheckedChange?.(next, point);
  };

  const rootClassName = [
    'tts-switch',
    size === 'topbar' ? 'tts-switch--topbar' : '',
    !showCaption ? 'tts-switch--no-caption' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <label
      className={rootClassName}
      title={title}
      onPointerDown={handlePointerDown}
      data-ink-live={inkLive ? 'true' : undefined}
    >
      <input
        className="tts-input"
        type="checkbox"
        role="switch"
        checked={isChecked}
        aria-checked={isChecked}
        aria-label={ariaLabel}
        onChange={handleChange}
      />

      <span className="tts-track-frame">
        <span ref={trackRef} className="tts-track">
          <span className="tts-stars" aria-hidden="true">
            <span className="tts-star" />
            <span className="tts-star" />
            <span className="tts-star" />
            <span className="tts-star" />
            <span className="tts-star" />
            <span className="tts-star" />
          </span>

          <span className="tts-clouds" aria-hidden="true">
            <span className="tts-cloud tts-cloud-a" />
            <span className="tts-cloud tts-cloud-b" />
            <span className="tts-cloud tts-cloud-c" />
          </span>

          <span className="tts-knob" aria-hidden="true">
            <span className="tts-glow" />
            <span className="tts-crater tts-crater-1" />
            <span className="tts-crater tts-crater-2" />
            <span className="tts-crater tts-crater-3" />
            <span className="tts-knob-shadow" />
          </span>
        </span>
      </span>

      {showCaption && (
        <span className="tts-caption" aria-hidden="true">
          <span className="tts-cap tts-cap-light">Light</span>
          <span className="tts-cap tts-cap-dark">Dark</span>
        </span>
      )}
    </label>
  );
}

export default ThemeSwitch;

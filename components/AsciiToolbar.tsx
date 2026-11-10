'use client';

import React, { useState } from 'react';
import { useAscii } from './AsciiContext';
import type { PresetName, SkeletonVariant } from 'ascii-reveal';

export default function AsciiToolbar() {
  const {
    preset,
    setPreset,
    originName,
    setOriginName,
    speed,
    setSpeed,
    skeletonVariant,
    setSkeletonVariant,
    revealPreset,
    setRevealPreset,
    mode,
    setMode,
    isSimulatingLoading,
    triggerReplay,
    triggerReload,
  } = useAscii();

  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="ascii-toolbar-dock" aria-label="ASCII Reveal & Skeleton Controls">
      <div className="ascii-toolbar-dock__top">
        <div className="ascii-toolbar-dock__badge">
          <span className="ascii-toolbar-dock__badge-dot" />
          <span>ASCII Motion Control · {preset.toUpperCase()} @ {speed}x ({originName})</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="ascii-action-btn ascii-action-btn--primary"
            onClick={triggerReplay}
            title="Replay reveal wave across all cards (Key: R)"
          >
            <span>◫ Replay</span>
            <kbd style={{ fontSize: '9px', opacity: 0.7, padding: '1px 4px', border: '1px solid currentColor', borderRadius: '3px' }}>R</kbd>
          </button>
          <button
            type="button"
            className="ascii-toolbar-dock__toggle-btn"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? '▾ Expand Controls' : '▴ Hide'}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="ascii-toolbar-dock__body">
          {/* Row 1: Skeleton + Reveal options matching user screenshot */}
          <div className="ascii-toolbar-row">
            <div className="ascii-toolbar-group">
              <span className="ascii-toolbar-label">Mode:</span>
              <div className="ascii-btn-group">
                <button
                  type="button"
                  className={`ascii-pill-btn ${mode === 'skeleton_reveal' ? 'is-active' : ''}`}
                  onClick={() => setMode('skeleton_reveal')}
                >
                  Skeleton + reveal
                </button>
                <button
                  type="button"
                  className={`ascii-pill-btn ${mode === 'skeleton_only' ? 'is-active' : ''}`}
                  onClick={() => setMode('skeleton_only')}
                >
                  Skeleton only
                </button>
                <button
                  type="button"
                  className={`ascii-pill-btn ${mode === 'cards' ? 'is-active' : ''}`}
                  onClick={() => setMode('cards')}
                >
                  Live cards
                </button>
              </div>
            </div>

            <div className="ascii-toolbar-group">
              <span className="ascii-toolbar-label">Skeleton:</span>
              <div className="ascii-btn-group">
                {(['dither', 'scan', 'braille', 'terminal'] as SkeletonVariant[]).map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={`ascii-pill-btn ${skeletonVariant === v ? 'is-active' : ''}`}
                    onClick={() => setSkeletonVariant(v)}
                  >
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="ascii-toolbar-group">
              <span className="ascii-toolbar-label">Reveal:</span>
              <div className="ascii-btn-group">
                {(['decode', 'dither', 'terminal', 'blueprint'] as PresetName[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`ascii-pill-btn ${revealPreset === p ? 'is-active' : ''}`}
                    onClick={() => setRevealPreset(p)}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="ascii-toolbar-right">
              <span className="ascii-timer-hint">all ready in 1.78 s</span>
              <button
                type="button"
                className="ascii-action-btn"
                onClick={() => triggerReload(1780)}
                disabled={isSimulatingLoading}
              >
                {isSimulatingLoading ? '⟳ Loading...' : '↻ Reload'}
              </button>
            </div>
          </div>

          {/* Row 2: Card preset, wave, and speed matching user screenshot */}
          <div className="ascii-toolbar-row">
            <div className="ascii-toolbar-group">
              <span className="ascii-toolbar-label">Preset:</span>
              <div className="ascii-btn-group">
                {(['decode', 'dither', 'terminal', 'blueprint'] as PresetName[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`ascii-pill-btn ${preset === p ? 'is-active' : ''}`}
                    onClick={() => setPreset(p)}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="ascii-toolbar-group">
              <span className="ascii-toolbar-label">Wave from:</span>
              <div className="ascii-btn-group">
                {(['center', 'corner', 'pointer'] as const).map((o) => (
                  <button
                    key={o}
                    type="button"
                    className={`ascii-pill-btn ${originName === o ? 'is-active' : ''}`}
                    onClick={() => setOriginName(o)}
                  >
                    {o === 'pointer' ? 'Cursor' : o.charAt(0).toUpperCase() + o.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="ascii-toolbar-group ascii-speed-slider">
              <span className="ascii-toolbar-label">Speed:</span>
              <input
                type="range"
                min="0.3"
                max="2.0"
                step="0.1"
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                aria-label="Reveal speed multiplier"
              />
              <span className="ascii-speed-val">{speed.toFixed(1)}x</span>
            </div>
          </div>

          <div className="ascii-hint-bar">
            <span>Click any card to replay from that origin · Scroll down to see lazy reveal wave</span>
            <span><code>&lt;AsciiReveal preset=&quot;{mode === 'skeleton_reveal' ? revealPreset : preset}&quot; speed={speed} origin=&quot;{originName}&quot;&gt;</code></span>
          </div>
        </div>
      )}
    </div>
  );
}

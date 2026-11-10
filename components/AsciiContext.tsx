'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useTransition } from 'react';
import type { PresetName, Origin, SkeletonVariant } from 'ascii-reveal';

export type AsciiMode = 'cards' | 'skeleton_reveal' | 'skeleton_only';

interface AsciiContextType {
  // Reveal Configuration
  preset: PresetName;
  setPreset: (preset: PresetName) => void;
  origin: Origin;
  setOrigin: (origin: Origin) => void;
  originName: 'corner' | 'center' | 'pointer';
  setOriginName: (name: 'corner' | 'center' | 'pointer') => void;
  speed: number;
  setSpeed: (speed: number) => void;
  
  // Skeleton Configuration
  skeletonVariant: SkeletonVariant;
  setSkeletonVariant: (v: SkeletonVariant) => void;
  revealPreset: PresetName;
  setRevealPreset: (p: PresetName) => void;
  readyDurationMs: number;
  setReadyDurationMs: (ms: number) => void;
  
  // Mode & State
  mode: AsciiMode;
  setMode: (mode: AsciiMode) => void;
  isSimulatingLoading: boolean;
  replayKey: number;
  
  // Actions
  triggerReplay: () => void;
  triggerReload: (durationMs?: number) => void;
}

const AsciiContext = createContext<AsciiContextType | null>(null);

export function AsciiProvider({ children }: { children: React.ReactNode }) {
  // Preset defaults requested by user:
  // preset: terminal, wave from: corner (top-left), speed: 0.7x
  const [preset, setPreset] = useState<PresetName>('terminal');
  const [originName, setOriginName] = useState<'corner' | 'center' | 'pointer'>('corner');
  const [origin, setOrigin] = useState<Origin>('top-left');
  const [speed, setSpeed] = useState<number>(0.7);
  
  // Skeleton defaults requested by user:
  // skeleton: dither, reveal: decode, ready in 1.78s
  const [skeletonVariant, setSkeletonVariant] = useState<SkeletonVariant>('dither');
  const [revealPreset, setRevealPreset] = useState<PresetName>('decode');
  const [readyDurationMs, setReadyDurationMs] = useState<number>(1780); // 1.78s
  
  const [mode, setMode] = useState<AsciiMode>('cards');
  const [isSimulatingLoading, setIsSimulatingLoading] = useState<boolean>(false);
  const [replayKey, setReplayKey] = useState<number>(0);

  const handleSetOriginName = useCallback((name: 'corner' | 'center' | 'pointer') => {
    setOriginName(name);
    if (name === 'corner') setOrigin('top-left');
    else if (name === 'center') setOrigin('center');
    else setOrigin('pointer');
  }, []);

  const triggerReplay = useCallback(() => {
    setReplayKey((k) => k + 1);
  }, []);

  const triggerReload = useCallback((durationMs?: number) => {
    const delay = durationMs ?? readyDurationMs;
    setIsSimulatingLoading(true);
    setReplayKey((k) => k + 1);
    setTimeout(() => {
      setIsSimulatingLoading(false);
    }, delay);
  }, [readyDurationMs]);

  // Global keydown shortcut 'r' to trigger replay
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
          return;
        }
        e.preventDefault();
        triggerReplay();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [triggerReplay]);

  return (
    <AsciiContext.Provider
      value={{
        preset,
        setPreset,
        origin,
        setOrigin,
        originName,
        setOriginName: handleSetOriginName,
        speed,
        setSpeed,
        skeletonVariant,
        setSkeletonVariant,
        revealPreset,
        setRevealPreset,
        readyDurationMs,
        setReadyDurationMs,
        mode,
        setMode,
        isSimulatingLoading,
        replayKey,
        triggerReplay,
        triggerReload,
      }}
    >
      {children}
    </AsciiContext.Provider>
  );
}

export function useAscii() {
  const context = useContext(AsciiContext);
  if (!context) {
    throw new Error('useAscii must be used within an AsciiProvider');
  }
  return context;
}

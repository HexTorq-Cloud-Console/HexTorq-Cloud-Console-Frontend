'use client';

import { useEffect } from 'react';
import { AsciiReveal } from 'ascii-reveal';
import { ASCII_REVEAL } from '../lib/asciiReveal';
import type { ReactNode } from 'react';
import { useScrollLock } from '../lib/useScrollLock';

function Modal({ open, title, subtitle, onClose, children, className }: { open: boolean; title: string; subtitle: string; onClose: () => void; children: ReactNode; className?: string }) {
  // The page behind a dialog must not scroll: the backdrop is fixed, so without this
  // the content slides underneath while the dialog is open.
  useScrollLock(open);

  if (!open) return null;
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <AsciiReveal as="section" data-lenis-prevent {...ASCII_REVEAL} className={`modal-card${className ? ` ${className}` : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <button className="modal-close" aria-label="Close" onClick={onClose}>
          x
        </button>
        <p className="eyebrow">HEX TORQ CLOUD</p>
        <h2>{title}</h2>
        <p className="modal-subtitle">{subtitle}</p>
        {children}
      </AsciiReveal>
    </div>
  );
}
export default Modal;

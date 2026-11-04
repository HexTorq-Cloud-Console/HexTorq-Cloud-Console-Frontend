import type { ReactNode } from 'react';
function Modal({ open, title, subtitle, onClose, children }: { open: boolean; title: string; subtitle: string; onClose: () => void; children: ReactNode }) {
  if (!open) return null;
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="modal-card" role="dialog" aria-modal="true" aria-label={title}>
        <button className="modal-close" aria-label="Close" onClick={onClose}>
          x
        </button>
        <p className="eyebrow">HEX TORQ CLOUD</p>
        <h2>{title}</h2>
        <p className="modal-subtitle">{subtitle}</p>
        {children}
      </section>
    </div>
  );
}
export default Modal;

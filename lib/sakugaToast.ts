export const SAKUGA_TOAST_EVENT = 'hextorq:toast';

export type SakugaToastDetail = {
  message: string;
};

/**
 * Triggers the global `<sakuga-toast>` element mounted in `SakugaToastHost`.
 */
export function showSakugaToast(message: string): void {
  if (typeof window === 'undefined' || !message) return;
  window.dispatchEvent(new CustomEvent<SakugaToastDetail>(SAKUGA_TOAST_EVENT, { detail: { message } }));
}

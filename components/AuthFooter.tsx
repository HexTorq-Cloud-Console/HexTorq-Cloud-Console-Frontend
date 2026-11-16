'use client';

import Logo from './Logo';

/**
 * Login-page footer. Spans the full width below the two columns and links
 * back to the main HexTorq site (opened in a new tab).
 */
export default function AuthFooter() {
  return (
    <footer className="auth-footer">
      <div className="auth-footer__brand">
        <span className="auth-footer__logo">
          <Logo size="sm" />
          <span className="auth-footer__product">Cloud Console</span>
        </span>
        <p className="auth-footer__description">
          A unified control plane for deployment, monitoring and operations.
        </p>
      </div>

      <div className="auth-footer__links">
        <a
          className="auth-footer__link"
          href="https://hextorq.tech"
          target="_blank"
          rel="noopener noreferrer"
        >
          Visit HexTorq Main Site
          <svg
            className="auth-footer__external"
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M15 3h6v6" />
            <path d="M10 14 21 3" />
            <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
          </svg>
        </a>
        <span className="auth-footer__domain">hextorq.tech</span>
      </div>

      <p className="auth-footer__copyright">&copy; 2026 HexTorq. All rights reserved.</p>
    </footer>
  );
}

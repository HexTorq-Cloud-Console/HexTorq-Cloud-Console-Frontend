'use client';

import Logo from './Logo';
import Reveal from './Reveal';

/**
 * Login-page footer. Spans the full width below the two columns: brand on the
 * left, the copyright centred, and the link to the main site on the right.
 */
export default function AuthFooter() {
  return (
    <footer className="auth-footer">
      <Reveal className="auth-footer__brand" delay={620}>
        <span className="auth-footer__logo">
          <Logo size="sm" />
          <span className="auth-footer__product">Cloud Console</span>
        </span>
        <p className="auth-footer__description">
          A unified control plane for deployment, monitoring and operations.
        </p>
      </Reveal>

      <Reveal as="p" className="auth-footer__copyright" delay={700}>
        &copy; 2026 HexTorq. All rights reserved.
      </Reveal>

      <Reveal className="auth-footer__links" delay={740}>
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
      </Reveal>
    </footer>
  );
}

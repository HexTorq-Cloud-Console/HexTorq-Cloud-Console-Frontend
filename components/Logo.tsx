type LogoSize = 'sm' | 'md' | 'lg';

type LogoProps = {
  /** Renders the HEXTORQ wordmark logo. */
  size?: LogoSize;
  /** Kept for caller compatibility; tagline is intentionally omitted. */
  tagline?: boolean;
  className?: string;
};

/**
 * HexTorq wordmark logo.
 *
 * Renders theme-matched transparent PNG lockups (light & dark) of the HEXTORQ
 * wordmark without the slogan, so it stays crisp on every surface and inside
 * html2canvas ink-bleed snapshots.
 */
export default function Logo({ size = 'md', className }: LogoProps) {
  const classes = ['ht-logo', size === 'md' ? '' : `ht-logo--${size}`, className]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes}>
      <img
        src="/hextorq-logo-light.png"
        alt=""
        width={980}
        height={125}
        className="ht-logo__img ht-logo__img--light"
        aria-hidden="true"
        decoding="async"
      />
      <img
        src="/hextorq-logo-dark.png"
        alt=""
        width={980}
        height={125}
        className="ht-logo__img ht-logo__img--dark"
        aria-hidden="true"
        decoding="async"
      />
      <span className="ht-visually-hidden">HexTorq</span>
    </span>
  );
}

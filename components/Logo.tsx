type LogoSize = 'sm' | 'md' | 'lg';

type LogoProps = {
  /** Renders the HEXTORQ wordmark. */
  size?: LogoSize;
  /** Shows the CODE · INNOVATE · ELEVATE line beneath the wordmark. */
  tagline?: boolean;
  className?: string;
};

const LETTERS = ['H', 'E', 'X', 'T', 'O', 'R', 'Q'];
const ACCENT_LETTERS = new Set(['X', 'Q']);

/**
 * HexTorq wordmark.
 *
 * The mark is built from type so it stays crisp at any size and needs no raster
 * asset. The gradient is applied to the X and Q, matching the brand lockup.
 */
export default function Logo({ size = 'md', tagline = false, className }: LogoProps) {
  const classes = ['ht-logo', size === 'md' ? '' : `ht-logo--${size}`, className]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes}>
      <span className="ht-logo__stack">
        <span className="ht-logo__word" aria-hidden="true">
          {LETTERS.map((letter, index) =>
            ACCENT_LETTERS.has(letter) ? (
              <span key={`${letter}-${index}`} className="ht-logo__accent">
                {letter}
              </span>
            ) : (
              <span key={`${letter}-${index}`}>{letter}</span>
            ),
          )}
        </span>
        {tagline ? (
          <span className="ht-logo__tagline" aria-hidden="true">
            Code <span className="ht-logo__accent">·</span> Innovate{' '}
            <span className="ht-logo__accent">·</span> Elevate
          </span>
        ) : null}
      </span>
      <span className="ht-visually-hidden">HexTorq</span>
    </span>
  );
}

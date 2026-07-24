/**
 * StraitsMark — the STRAITS brand favicon as an inline SVG.
 * Two tapered coastline walls pinch a strait; a brighter-amber vessel chevron
 * transits the narrows, inside a terminal bezel. Matches public/favicon-32.png.
 */
interface StraitsMarkProps {
  size?: number;
  className?: string;
}

export function StraitsMark({ size = 22, className }: StraitsMarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Straits"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="4" y="4" width="56" height="56" fill="none" stroke="#b45309" strokeWidth="1" />
      <polygon points="9,11 18,11 18,26 23,30 23,34 18,38 18,53 9,53" fill="#f59e0b" />
      <polygon points="55,11 46,11 46,26 41,30 41,34 46,38 46,53 55,53" fill="#f59e0b" />
      <path d="M27 22 L37 32 L27 42 L27 36 L31 32 L27 28 Z" fill="#fbbf24" />
    </svg>
  );
}

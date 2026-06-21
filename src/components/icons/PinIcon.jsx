/**
 * Kandoo's own pin glyph — a clean, upright thumbtack. Stroke-based to sit
 * comfortably alongside the app's icon language; inherits `currentColor`.
 */
export default function PinIcon({ size = '1em', strokeWidth = 1.7, ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {/* flat cap you press */}
      <line x1="8" y1="4" x2="16" y2="4" />
      {/* body flaring out to the flange */}
      <path d="M10 4 L7.6 11 H16.4 L14 4" />
      {/* needle */}
      <line x1="12" y1="11" x2="12" y2="20.5" />
    </svg>
  );
}

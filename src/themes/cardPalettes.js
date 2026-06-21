/**
 * Card colour palette
 *
 * Cards no longer store an arbitrary hex. Instead each card holds one of five
 * universal *hue keys*. Every theme renders those keys in its own register via
 * `color-mix` against the theme's surfaces, so a "sky" card stays recognisably
 * sky in every theme while still harmonising with that theme's mood — and the
 * recipe adapts automatically to custom themes too.
 */

// Muted, decorative tones — deliberately desaturated and shifted off the
// vivid semantic colours (danger red, warning amber, success green) so a card
// never reads as an alert and never drowns out the real status badges sitting
// on it. Evenly spaced around the wheel so the five stay distinct.
export const CARD_HUES = [
  { key: 'rose',   label: 'Berry',  hex: '#d4607f' },
  { key: 'amber',  label: 'Amber',  hex: '#e0964a' },
  { key: 'mint',   label: 'Teal',   hex: '#2bb394' },
  { key: 'sky',    label: 'Sky',    hex: '#4f8fdb' },
  { key: 'violet', label: 'Violet', hex: '#9173e0' },
];

export const CARD_HUE_KEYS = CARD_HUES.map((h) => h.key);
const HUE_HEX = Object.fromEntries(CARD_HUES.map((h) => [h.key, h.hex]));

// Legacy stored values (old Tailwind class names) → new hue keys.
const LEGACY_MAP = {
  'bg-pink-200': 'rose',
  'bg-red-200': 'rose',
  'bg-red-300': 'rose',
  'bg-sky-200': 'sky',
  'bg-blue-100': 'sky',
  'bg-blue-200': 'sky',
  'bg-teal-200': 'mint',
  'bg-green-100': 'mint',
  'bg-green-200': 'mint',
  'bg-yellow-200': 'amber',
  'bg-orange-200': 'amber',
  'bg-purple-200': 'violet',
  'bg-gray-200': 'violet',
};

export function randomCardColorKey() {
  return CARD_HUE_KEYS[Math.floor(Math.random() * CARD_HUE_KEYS.length)];
}

/**
 * Choose a hue for a new card that balances the board: pick the least-used
 * hue among existing cards (ties broken randomly) so colours spread out
 * instead of clustering on one.
 */
export function pickCardColorKey(existingColors = []) {
  const counts = Object.fromEntries(CARD_HUE_KEYS.map((k) => [k, 0]));
  for (const c of existingColors) {
    const k = normalizeCardColor(c);
    if (k in counts) counts[k] += 1;
  }
  const min = Math.min(...CARD_HUE_KEYS.map((k) => counts[k]));
  const leastUsed = CARD_HUE_KEYS.filter((k) => counts[k] === min);
  return leastUsed[Math.floor(Math.random() * leastUsed.length)];
}

// ── colour helpers ──────────────────────────────────────────────────────────

function hexToRgb(hex) {
  if (typeof hex !== 'string') return null;
  let h = hex.trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6 || /[^0-9a-f]/i.test(h)) return null;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

function hexToHue(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let hue;
  if (max === r) hue = ((g - b) / d) % 6;
  else if (max === g) hue = (b - r) / d + 2;
  else hue = (r - g) / d + 4;
  hue *= 60;
  return hue < 0 ? hue + 360 : hue;
}

const BASE_HUES = CARD_HUES.map((h) => ({ key: h.key, hue: hexToHue(h.hex) }));

// Snap an arbitrary hex to the nearest palette key by circular hue distance.
function nearestKeyForHex(hex) {
  const hue = hexToHue(hex);
  if (hue == null) return 'sky';
  let best = 'sky';
  let bestDist = Infinity;
  for (const { key, hue: bh } of BASE_HUES) {
    const raw = Math.abs(hue - bh);
    const dist = Math.min(raw, 360 - raw);
    if (dist < bestDist) { bestDist = dist; best = key; }
  }
  return best;
}

/**
 * Map any stored card colour to a current palette key.
 * Deterministic so it never flickers on re-render.
 */
export function normalizeCardColor(color) {
  if (!color) return 'sky';
  if (CARD_HUE_KEYS.includes(color)) return color;
  if (LEGACY_MAP[color]) return LEGACY_MAP[color];
  if (typeof color === 'string' && color.startsWith('#')) return nearestKeyForHex(color);
  return 'sky';
}

// Relative-luminance test so light/dark detection also covers custom themes.
export function isDarkSurface(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return false;
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return L < 0.4;
}

/**
 * Resolve a hue key to the concrete CSS colours used by a card.
 * Values lean on `var(--theme-bg-card)` so they track live theme changes.
 */
export function resolveCardColor(color, isDark) {
  const hue = HUE_HEX[normalizeCardColor(color)] || HUE_HEX.sky;

  // Colour is concentrated in the header; the body stays a neutral recessed
  // surface. Tiles are flat and calm at rest — the glass material (specular
  // sheen from the bottom-right, rim light, deeper lift) only appears on hover,
  // and fully on the floating drag overlay. Keeps the board quiet day-to-day.
  if (isDark) {
    return {
      header:      `color-mix(in srgb, ${hue} 40%, var(--theme-bg-card))`,
      headerText:  `color-mix(in srgb, ${hue} 8%, #ffffff)`,
      headerBadge: 'rgba(255,255,255,0.16)',
      body:        'var(--theme-bg-secondary)',
      tileSheen:   'linear-gradient(315deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.02) 42%, rgba(255,255,255,0) 60%)',
      tileBorder:  'rgba(255,255,255,0.14)',
      tileShadow:  '0 8px 22px rgba(0,0,0,0.36), inset 0 -1px 0 rgba(255,255,255,0.08)',
      accent:      hue,
    };
  }
  return {
    header:      `color-mix(in srgb, ${hue} 34%, var(--theme-bg-card))`,
    headerText:  `color-mix(in srgb, ${hue} 18%, #15202e)`,
    headerBadge: 'rgba(0,0,0,0.09)',
    body:        'var(--theme-bg-secondary)',
    tileSheen:   'linear-gradient(315deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.08) 42%, rgba(255,255,255,0) 60%)',
    tileBorder:  'rgba(0,0,0,0.07)',
    tileShadow:  '0 8px 20px rgba(0,0,0,0.10), inset 0 -1px 0 rgba(255,255,255,0.7)',
    accent:      hue,
  };
}

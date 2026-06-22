import {
  LuLeaf, LuCloudFog, LuSun, LuSnowflake, LuTerminal, LuGem,
  LuEye, LuCoffee, LuMoon, LuSparkles, LuTreePine, LuSunset, LuPalette,
} from 'react-icons/lu';

// Theme identity glyphs, drawn from one consistent outline family (Lucide) so
// they sit cleanly alongside the rest of the UI's icons. Themes reference these
// by a stable string key (see `icon` in themes.js); the key keeps theme data
// serializable for export/import, while the component mapping stays in the UI.
const THEME_ICONS = {
  leaf: LuLeaf,
  fog: LuCloudFog,
  sun: LuSun,
  snow: LuSnowflake,
  terminal: LuTerminal,
  gem: LuGem,
  owl: LuEye,
  coffee: LuCoffee,
  moon: LuMoon,
  sparkles: LuSparkles,
  forest: LuTreePine,
  sunset: LuSunset,
};

// Resolve a theme's icon component, falling back to a generic palette glyph for
// custom/imported themes that don't specify one.
export function getThemeIcon(iconKey) {
  return THEME_ICONS[iconKey] || LuPalette;
}

export default THEME_ICONS;

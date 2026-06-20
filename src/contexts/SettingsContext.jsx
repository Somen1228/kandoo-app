import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useTheme } from './ThemeContext';

const SettingsContext = createContext();

export const useSettings = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within a SettingsProvider');
  return ctx;
};

const STORAGE_KEY = 'kandoo-settings-v1';

export const SETTINGS_DEFAULTS = {
  // Appearance
  density: 'comfortable',     // 'comfortable' | 'compact'
  reduceMotion: false,
  accent: '',                 // '' = theme default, else hex
  // Editor (Notes)
  noteFontFamily: '',         // '' = default UI font
  noteFontSize: 16,           // px
  noteLineHeight: 1.7,
  noteDefaultView: 'paper',   // 'paper' | 'wide'
  noteSpellcheck: true,
  // Behavior
  taskDeleteMode: 'undo',     // 'undo' | 'confirm'
  quickAddDueToday: true,
  autoMoveDone: true,         // move completed tasks to Done column
};

export function SettingsProvider({ children }) {
  const { currentTheme, currentThemeId } = useTheme();
  const [settings, setSettings] = useState(() => {
    try {
      return { ...SETTINGS_DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
    } catch {
      return { ...SETTINGS_DEFAULTS };
    }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* quota */ }
  }, [settings]);

  // ── Apply non-colour preferences to the document ────────────────────────
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.density = settings.density;
    root.classList.toggle('reduce-motion', !!settings.reduceMotion);
    root.style.setProperty('--note-font-size', `${settings.noteFontSize}px`);
    root.style.setProperty('--note-line-height', String(settings.noteLineHeight));
    if (settings.noteFontFamily) root.style.setProperty('--note-font-family', settings.noteFontFamily);
    else root.style.removeProperty('--note-font-family');
  }, [settings.density, settings.reduceMotion, settings.noteFontSize, settings.noteLineHeight, settings.noteFontFamily]);

  // ── Accent override — re-applied after each theme change ────────────────
  // ThemeContext writes --theme-accent inline on every theme switch (and its
  // effect runs *after* this child provider's), so we re-assert on the next
  // frame to win, falling back to the active theme's own accent when unset.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const root = document.documentElement;
      const accent = settings.accent || currentTheme?.colors?.accent;
      const hover = settings.accent || currentTheme?.colors?.accentHover || accent;
      if (accent) {
        root.style.setProperty('--theme-accent', accent);
        root.style.setProperty('--theme-accent-hover', hover);
      }
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.accent, currentThemeId]);

  const setSetting = useCallback((key, value) => {
    setSettings((s) => ({ ...s, [key]: value }));
  }, []);

  const resetSettings = useCallback(() => setSettings({ ...SETTINGS_DEFAULTS }), []);

  return (
    <SettingsContext.Provider value={{ settings, setSetting, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export default SettingsContext;

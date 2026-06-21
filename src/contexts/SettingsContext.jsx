import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from './ThemeContext';
import { useAuth } from './AuthContext';
import { getWorkspace, savePrefs, subscribeWorkspace } from '../services/firestoreSync';

const SettingsContext = createContext();

export const useSettings = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within a SettingsProvider');
  return ctx;
};

const STORAGE_KEY = 'kandoo-settings-v1';
const AT_KEY = 'kandoo-settings-v1-at';   // client timestamp of the last local change
const PUSH_DEBOUNCE_MS = 700;

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
  const { user } = useAuth();
  const userUid = user?.uid || null;

  const [settings, setSettings] = useState(() => {
    try {
      return { ...SETTINGS_DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
    } catch {
      return { ...SETTINGS_DEFAULTS };
    }
  });

  // ── Cloud sync refs ─────────────────────────────────────────────────────────
  const updatedAtRef     = useRef(Number(localStorage.getItem(AT_KEY)) || 0);
  const applyingRemoteRef = useRef(false);   // suppress the push when we adopt cloud
  const hydratedRef       = useRef(false);   // don't push before the initial cloud read
  const pushTimerRef      = useRef(null);
  const userUidRef        = useRef(userUid);
  useEffect(() => { userUidRef.current = userUid; }, [userUid]);

  // Persist locally + push to the cloud whenever settings change.
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* quota */ }
    if (applyingRemoteRef.current) { applyingRemoteRef.current = false; return; }
    if (!hydratedRef.current) return; // wait until the initial cloud hydrate settles
    const at = Date.now();
    updatedAtRef.current = at;
    try { localStorage.setItem(AT_KEY, String(at)); } catch { /* quota */ }
    const uid = userUidRef.current;
    if (!uid) return;
    clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(() => {
      savePrefs(uid, { settings, settingsUpdatedAt: at }).catch(() => {});
    }, PUSH_DEBOUNCE_MS);
  }, [settings]);

  // On login: adopt newer cloud settings, otherwise push the local ones up.
  useEffect(() => {
    if (!userUid) { hydratedRef.current = true; return undefined; }
    let cancelled = false;
    (async () => {
      try {
        const { workspace } = await getWorkspace(userUid);
        if (cancelled) return;
        const cloudAt = workspace.settingsUpdatedAt || 0;
        if (workspace.settings && cloudAt > updatedAtRef.current) {
          applyingRemoteRef.current = true;
          updatedAtRef.current = cloudAt;
          try { localStorage.setItem(AT_KEY, String(cloudAt)); } catch { /* quota */ }
          setSettings({ ...SETTINGS_DEFAULTS, ...workspace.settings });
        } else if (updatedAtRef.current > cloudAt) {
          savePrefs(userUid, { settings, settingsUpdatedAt: updatedAtRef.current }).catch(() => {});
        }
      } catch { /* offline — keep local copy */ }
      finally { if (!cancelled) hydratedRef.current = true; }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userUid]);

  // Live-apply settings changed on another device (echo-suppressed by timestamp).
  useEffect(() => {
    if (!userUid) return undefined;
    return subscribeWorkspace(userUid, (data) => {
      const cloudAt = data.settingsUpdatedAt || 0;
      if (data.settings && cloudAt > updatedAtRef.current) {
        applyingRemoteRef.current = true;
        updatedAtRef.current = cloudAt;
        try { localStorage.setItem(AT_KEY, String(cloudAt)); } catch { /* quota */ }
        setSettings({ ...SETTINGS_DEFAULTS, ...data.settings });
      }
    });
  }, [userUid]);

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

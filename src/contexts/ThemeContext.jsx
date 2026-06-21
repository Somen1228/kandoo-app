import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { toast } from '../utils/toast';
import { useAuth } from './AuthContext';
import { getWorkspace, savePrefs, subscribeWorkspace } from '../services/firestoreSync';
import themes, { themeToCSSVars, validateTheme } from '../themes/themes';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};

const STORAGE_KEY_THEME = 'kandoo-theme-id';
const STORAGE_KEY_CUSTOM = 'kandoo-custom-themes';
const THEME_AT_KEY = 'kandoo-theme-at';   // client timestamp of the last local theme change
const PREFS_PUSH_DEBOUNCE_MS = 700;

export const ThemeProvider = ({ children }) => {
  const [currentThemeId, setCurrentThemeId] = useState(() => {
    return localStorage.getItem(STORAGE_KEY_THEME) || 'light';
  });
  const [customThemes, setCustomThemes] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY_CUSTOM) || '[]');
    } catch { return []; }
  });

  const allThemes = [...themes, ...customThemes];

  // Apply theme CSS variables to document root
  const applyTheme = useCallback((themeId) => {
    const theme = [...themes, ...customThemes].find((t) => t.id === themeId);
    if (!theme) return;

    const vars = themeToCSSVars(theme);
    const root = document.documentElement;
    Object.entries(vars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    // Also set a data attribute for potential CSS selectors
    root.setAttribute('data-theme', themeId);
  }, [customThemes]);

  // Apply on mount and when theme changes
  useEffect(() => {
    applyTheme(currentThemeId);
    localStorage.setItem(STORAGE_KEY_THEME, currentThemeId);
  }, [currentThemeId, applyTheme]);

  // Persist custom themes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(customThemes));
  }, [customThemes]);

  // ── Cloud sync (theme id + custom themes), last-write-wins by timestamp ──────
  const { user } = useAuth();
  const userUid = user?.uid || null;
  const themeAtRef       = useRef(Number(localStorage.getItem(THEME_AT_KEY)) || 0);
  const applyingRemoteRef = useRef(false);
  const hydratedRef       = useRef(false);
  const pushTimerRef      = useRef(null);
  const userUidRef        = useRef(userUid);
  useEffect(() => { userUidRef.current = userUid; }, [userUid]);

  // Push theme prefs to the cloud whenever the theme or custom themes change.
  useEffect(() => {
    if (applyingRemoteRef.current) { applyingRemoteRef.current = false; return; }
    if (!hydratedRef.current) return;
    const at = Date.now();
    themeAtRef.current = at;
    try { localStorage.setItem(THEME_AT_KEY, String(at)); } catch { /* quota */ }
    const uid = userUidRef.current;
    if (!uid) return;
    clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(() => {
      savePrefs(uid, { themeId: currentThemeId, customThemes, themeUpdatedAt: at }).catch(() => {});
    }, PREFS_PUSH_DEBOUNCE_MS);
  }, [currentThemeId, customThemes]);

  // Adopt a newer cloud theme. Always (re)set customThemes (new ref) so the push
  // effect above fires once and clears the applying flag.
  const adoptCloudTheme = (cloudThemeId, cloudCustom, cloudAt) => {
    applyingRemoteRef.current = true;
    themeAtRef.current = cloudAt;
    try { localStorage.setItem(THEME_AT_KEY, String(cloudAt)); } catch { /* quota */ }
    setCustomThemes(Array.isArray(cloudCustom) ? cloudCustom : []);
    if (cloudThemeId) setCurrentThemeId(cloudThemeId);
  };

  // On login: adopt newer cloud theme, otherwise push local up.
  useEffect(() => {
    if (!userUid) { hydratedRef.current = true; return undefined; }
    let cancelled = false;
    (async () => {
      try {
        const { workspace } = await getWorkspace(userUid);
        if (cancelled) return;
        const cloudAt = workspace.themeUpdatedAt || 0;
        if (cloudAt > themeAtRef.current && (workspace.themeId || workspace.customThemes)) {
          adoptCloudTheme(workspace.themeId, workspace.customThemes, cloudAt);
        } else if (themeAtRef.current > cloudAt) {
          savePrefs(userUid, { themeId: currentThemeId, customThemes, themeUpdatedAt: themeAtRef.current }).catch(() => {});
        }
      } catch { /* offline — keep local */ }
      finally { if (!cancelled) hydratedRef.current = true; }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userUid]);

  // Live-apply a theme changed on another device (echo-suppressed by timestamp).
  useEffect(() => {
    if (!userUid) return undefined;
    return subscribeWorkspace(userUid, (data) => {
      const cloudAt = data.themeUpdatedAt || 0;
      if (cloudAt > themeAtRef.current && (data.themeId || data.customThemes)) {
        adoptCloudTheme(data.themeId, data.customThemes, cloudAt);
      }
    });
  }, [userUid]);

  const setTheme = (id) => {
    const exists = allThemes.find((t) => t.id === id);
    if (exists && id !== currentThemeId) {
      setCurrentThemeId(id);
      toast.success(`Theme: ${exists.emoji ? exists.emoji + ' ' : ''}${exists.name}`);
    }
  };

  const addCustomTheme = (themeJson) => {
    const validation = validateTheme(themeJson);
    if (!validation.valid) return { success: false, error: validation.error };

    // Generate id if not provided
    const theme = {
      ...themeJson,
      id: themeJson.id || `custom-${Date.now()}`,
      isCustom: true,
    };

    // Check for duplicate id
    if (allThemes.find((t) => t.id === theme.id)) {
      return { success: false, error: `Theme with id "${theme.id}" already exists` };
    }

    setCustomThemes((prev) => [...prev, theme]);
    return { success: true, theme };
  };

  const removeCustomTheme = (id) => {
    setCustomThemes((prev) => prev.filter((t) => t.id !== id));
    if (currentThemeId === id) setCurrentThemeId('light');
  };

  const exportTheme = (id) => {
    const theme = allThemes.find((t) => t.id === id);
    if (!theme) return null;
    const { isCustom: _isCustom, ...exportData } = theme;
    return JSON.stringify(exportData, null, 2);
  };

  const getCurrentTheme = () => allThemes.find((t) => t.id === currentThemeId) || themes[0];

  const value = {
    currentThemeId,
    currentTheme: getCurrentTheme(),
    allThemes,
    builtInThemes: themes,
    customThemes,
    setTheme,
    addCustomTheme,
    removeCustomTheme,
    exportTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext;

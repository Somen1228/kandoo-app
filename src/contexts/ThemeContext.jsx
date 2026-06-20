import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toast } from '../utils/toast';
import themes, { themeToCSSVars, validateTheme } from '../themes/themes';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};

const STORAGE_KEY_THEME = 'kandoo-theme-id';
const STORAGE_KEY_CUSTOM = 'kandoo-custom-themes';

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

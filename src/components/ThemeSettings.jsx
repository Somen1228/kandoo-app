import { useState, useRef, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { THEME_TOKENS } from '../themes/themes';
import './ThemeSettings.css';
import { IoColorFilterOutline } from "react-icons/io5";

function ThemeSettings({ onClose }) {
  const {
    currentThemeId, builtInThemes, customThemes,
    setTheme, addCustomTheme, removeCustomTheme, exportTheme,
  } = useTheme();

  const [jsonInput, setJsonInput] = useState('');
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const panelRef = useRef(null);

  // Close on click outside
  useEffect(() => {
    const handleClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleImport = () => {
    setImportError('');
    setImportSuccess('');
    try {
      const parsed = JSON.parse(jsonInput);
      const result = addCustomTheme(parsed);
      if (result.success) {
        setImportSuccess(`Theme "${parsed.name}" imported successfully!`);
        setJsonInput('');
        setTheme(result.theme.id);
      } else {
        setImportError(result.error);
      }
    } catch {
      setImportError('Invalid JSON. Please check the format and try again.');
    }
  };

  const handleExport = (id) => {
    const json = exportTheme(id);
    if (!json) return;
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kandoo-theme-${id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setJsonInput(ev.target.result);
    reader.readAsText(file);
    e.target.value = '';
  };

  const sampleTheme = JSON.stringify({
    name: "My Theme",
    colors: THEME_TOKENS.reduce((acc, token) => {
      acc[token] = "#000000";
      return acc;
    }, {}),
  }, null, 2);

  return (
    <div className="theme-settings-overlay">
      <div className="theme-settings-panel" ref={panelRef}>
        {/* Header */}
        <div className="ts-header">
        <h2 className="flex items-center gap-2">
          <IoColorFilterOutline />
          Theme Settings
        </h2>
          <button className="ts-close" onClick={onClose}>✕</button>
        </div>

        {/* Built-in Themes */}
        <div className="ts-section">
          <p className="ts-section-title">Built-in Themes</p>
          <div className="ts-grid">
            {builtInThemes.map((theme) => (
              <div
                key={theme.id}
                className={`ts-theme-card ${currentThemeId === theme.id ? 'active' : ''}`}
                onClick={() => setTheme(theme.id)}
              >
                <div className="ts-preview">
                  <div className="ts-preview-bar" style={{ background: theme.colors.bgPrimary }} />
                  <div className="ts-preview-bar" style={{ background: theme.colors.bgCard }} />
                  <div className="ts-preview-bar" style={{ background: theme.colors.accent }} />
                  <div className="ts-preview-bar" style={{ background: theme.colors.bgInput }} />
                </div>
                <div className="ts-theme-name">
                  <span className="emoji">{theme.emoji}</span>
                  {theme.name}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Custom Themes */}
        {customThemes.length > 0 && (
          <>
            <div className="ts-divider" />
            <div className="ts-section">
              <p className="ts-section-title">Custom Themes</p>
              <div className="ts-grid">
                {customThemes.map((theme) => (
                  <div
                    key={theme.id}
                    className={`ts-theme-card ${currentThemeId === theme.id ? 'active' : ''}`}
                    onClick={() => setTheme(theme.id)}
                  >
                    <div className="ts-preview">
                      <div className="ts-preview-bar" style={{ background: theme.colors.bgPrimary }} />
                      <div className="ts-preview-bar" style={{ background: theme.colors.bgCard }} />
                      <div className="ts-preview-bar" style={{ background: theme.colors.accent }} />
                      <div className="ts-preview-bar" style={{ background: theme.colors.bgInput }} />
                    </div>
                    <div className="ts-theme-name">
                      {theme.emoji && <span className="emoji">{theme.emoji}</span>}
                      {theme.name}
                    </div>
                    <div className="ts-custom-actions">
                      <button className="ts-btn-sm ts-btn-export" onClick={(e) => { e.stopPropagation(); handleExport(theme.id); }}>
                        Export
                      </button>
                      <button className="ts-btn-sm ts-btn-delete" onClick={(e) => { e.stopPropagation(); removeCustomTheme(theme.id); }}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Import Section */}
        <div className="ts-divider" />
        <div className="ts-section">
          <p className="ts-section-title">Import Custom Theme</p>
          <div className="ts-import-area">
            <textarea
              className="ts-textarea"
              value={jsonInput}
              onChange={(e) => { setJsonInput(e.target.value); setImportError(''); setImportSuccess(''); }}
              placeholder={`Paste your theme JSON here...\n\nExample:\n${sampleTheme.slice(0, 200)}...`}
            />
            <div className="ts-import-actions">
              <label className="ts-btn ts-btn-secondary" style={{ cursor: 'pointer' }}>
                📁 Upload JSON
                <input type="file" accept=".json" onChange={handleFileUpload} style={{ display: 'none' }} />
              </label>
              <button className="ts-btn ts-btn-primary" onClick={handleImport} disabled={!jsonInput.trim()}>
                Import Theme
              </button>
            </div>
            {importError && <div className="ts-error">❌ {importError}</div>}
            {importSuccess && <div className="ts-success">✅ {importSuccess}</div>}
            <p className="ts-import-hint">
              Tip: Export any built-in theme to use as a starting template for your custom theme.
              <button
                className="ts-btn-sm ts-btn-export"
                style={{ marginLeft: 8 }}
                onClick={() => handleExport(currentThemeId)}
              >
                Export Current Theme
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ThemeSettings;

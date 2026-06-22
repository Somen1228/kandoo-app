import { useState, useRef, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { THEME_TOKENS } from '../themes/themes';
import { getThemeIcon } from '../themes/themeIcons';
import './ThemeSettings.css';

// Mini UI preview inside each theme card — matches the screenshot aesthetic
function ThemePreview({ colors }) {
  return (
    <div className="ts-mini-preview" style={{ background: colors.bgPrimary }}>
      <div className="ts-mp-row">
        <div className="ts-mp-pill ts-mp-pill--wide"  style={{ background: colors.bgSecondary }} />
        <div className="ts-mp-pill ts-mp-pill--short" style={{ background: colors.accent }} />
      </div>
      <div className="ts-mp-row">
        <div className="ts-mp-dot" style={{ background: colors.danger }} />
        <div className="ts-mp-dot" style={{ background: colors.accent }} />
        <div className="ts-mp-pill ts-mp-pill--medium" style={{ background: colors.bgInput }} />
      </div>
    </div>
  );
}

function ThemeCard({ theme, isActive, onClick, onExport, onDelete, showActions }) {
  const Icon = getThemeIcon(theme.icon);
  return (
    <div
      className={`ts-theme-card ${isActive ? 'active' : ''}`}
      onClick={onClick}
      style={{ borderColor: isActive ? theme.colors.accent : 'transparent' }}
    >
      <ThemePreview colors={theme.colors} />

      <div
        className="ts-theme-footer"
        style={{
          background: theme.colors.bgCard,
          borderTop: `1px solid ${theme.colors.border}`,
        }}
      >
        <span className="ts-theme-icon" aria-hidden="true" style={{ color: theme.colors.accent }}>
          <Icon />
        </span>
        <span className="ts-theme-name" style={{ color: theme.colors.textPrimary }}>
          {theme.name}
        </span>
        {isActive && (
          <span className="ts-check" style={{ color: theme.colors.accent }}>✓</span>
        )}
      </div>

      {showActions && (
        <div className="ts-custom-actions">
          <button className="ts-btn-sm ts-btn-export" onClick={(e) => { e.stopPropagation(); onExport?.(); }}>
            Export
          </button>
          <button className="ts-btn-sm ts-btn-delete" onClick={(e) => { e.stopPropagation(); onDelete?.(); }}>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function ThemeSettings({ onClose }) {
  const {
    currentThemeId, builtInThemes, customThemes,
    setTheme, addCustomTheme, removeCustomTheme, exportTheme,
  } = useTheme();

  const [jsonInput, setJsonInput]       = useState('');
  const [importError, setImportError]   = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const [showImport, setShowImport]     = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

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
        setImportSuccess(`Theme "${parsed.name}" imported!`);
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
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `kandoo-theme-${id}.json`; a.click();
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
    name: 'My Theme',
    colors: THEME_TOKENS.reduce((acc, t) => { acc[t] = '#000000'; return acc; }, {}),
  }, null, 2);

  return (
    <div className="theme-settings-overlay">
      <div className="theme-settings-panel" ref={panelRef}>

        {/* Header */}
        <div className="ts-header">
          <div>
            <h2 className="ts-title">Themes</h2>
            <p className="ts-subtitle">Pick a palette — applies instantly to both windows.</p>
          </div>
          <button className="ts-close" onClick={onClose}>×</button>
        </div>

        {/* Built-in grid */}
        <div className="ts-body">
          <div className="ts-grid">
            {builtInThemes.map((theme) => (
              <ThemeCard
                key={theme.id}
                theme={theme}
                isActive={currentThemeId === theme.id}
                onClick={() => setTheme(theme.id)}
                onExport={() => handleExport(theme.id)}
              />
            ))}
          </div>

          {/* Custom themes */}
          {customThemes.length > 0 && (
            <>
              <div className="ts-divider" />
              <p className="ts-section-title">Custom Themes</p>
              <div className="ts-grid">
                {customThemes.map((theme) => (
                  <ThemeCard
                    key={theme.id}
                    theme={theme}
                    isActive={currentThemeId === theme.id}
                    onClick={() => setTheme(theme.id)}
                    onExport={() => handleExport(theme.id)}
                    onDelete={() => removeCustomTheme(theme.id)}
                    showActions
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="ts-footer">
          <span className="ts-shortcut-hint">
            Press <kbd>T</kbd> anywhere to cycle themes.
          </span>
          <button className="ts-btn-custom" onClick={() => setShowImport(v => !v)}>
            + Custom theme
          </button>
        </div>

        {/* Import panel */}
        {showImport && (
          <div className="ts-import-section">
            <div className="ts-divider" />
            <div className="ts-section">
              <p className="ts-section-title">Import Custom Theme</p>
              <div className="ts-import-area">
                <textarea
                  className="ts-textarea"
                  value={jsonInput}
                  onChange={(e) => { setJsonInput(e.target.value); setImportError(''); setImportSuccess(''); }}
                  placeholder={`Paste your theme JSON here...\n\nExample:\n${sampleTheme.slice(0, 180)}...`}
                />
                <div className="ts-import-actions">
                  <label className="ts-btn ts-btn-secondary" style={{ cursor: 'pointer' }}>
                    Upload JSON
                    <input type="file" accept=".json" onChange={handleFileUpload} style={{ display: 'none' }} />
                  </label>
                  <button className="ts-btn ts-btn-primary" onClick={handleImport} disabled={!jsonInput.trim()}>
                    Import
                  </button>
                  <button className="ts-btn ts-btn-secondary" onClick={() => handleExport(currentThemeId)}>
                    Export current
                  </button>
                </div>
                {importError   && <div className="ts-error">{importError}</div>}
                {importSuccess && <div className="ts-success">{importSuccess}</div>}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default ThemeSettings;

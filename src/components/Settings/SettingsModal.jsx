import { useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { useTheme } from '../../contexts/ThemeContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useAuth } from '../../contexts/AuthContext';
import { CardsContext } from '../../contexts/CardsContext';
import { THEME_TOKENS } from '../../themes/themes';
import '../ThemeSettings.css';
import {
  VscAccount, VscColorMode, VscEdit, VscSettingsGear, VscDatabase, VscClose, VscCopy,
} from 'react-icons/vsc';

const SQLITE_PATH = '~/Library/Application Support/com.kandoo.desktop/kandoo.db';
const APP_VERSION = '1.0.0';
const REPO_URL = 'https://github.com/Somen1228/kandoo-app';

const ACCENTS = [
  { label: 'Theme default', value: '' },
  { label: 'Navy', value: '#1e3a5f' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Violet', value: '#7c3aed' },
  { label: 'Pink', value: '#db2777' },
  { label: 'Teal', value: '#0d9488' },
  { label: 'Amber', value: '#d97706' },
  { label: 'Red', value: '#dc2626' },
];

const FONT_FAMILIES = [
  { label: 'Default', value: '' },
  { label: 'Sans (Inter)', value: 'Inter, -apple-system, sans-serif' },
  { label: 'Serif (Georgia)', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Mono', value: '"SF Mono", ui-monospace, monospace' },
];

const mod = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform) ? '⌘' : 'Ctrl';
const SHORTCUTS = [
  { group: 'Navigation', items: [
    { keys: [`${mod}`, 'K'], desc: 'Focus search' },
    { keys: [`${mod}`, 'B'], desc: 'Toggle sidebar' },
    { keys: ['Esc'], desc: 'Close modal / clear search' },
  ]},
  { group: 'Actions', items: [
    { keys: [`${mod}`, 'N'], desc: 'Quick-add task' },
    { keys: [`${mod}`, 'Z'], desc: 'Undo' },
    { keys: [`${mod}`, '⇧', 'Z'], desc: 'Redo' },
    { keys: ['T'], desc: 'Cycle theme' },
    { keys: [`${mod}`, '⇧', '1'], desc: 'Help & features' },
  ]},
  { group: 'Editing', items: [
    { keys: [`${mod}`, 'B / I / U'], desc: 'Bold / italic / underline' },
    { keys: ['Drag'], desc: 'Move tasks between columns' },
    { keys: ['Right-click'], desc: 'Context menu (task / card / board)' },
  ]},
];

const TABS = [
  { id: 'account', label: 'Account & Sync', icon: <VscAccount /> },
  { id: 'appearance', label: 'Appearance', icon: <VscColorMode /> },
  { id: 'editor', label: 'Editor', icon: <VscEdit /> },
  { id: 'behavior', label: 'Behavior & Shortcuts', icon: <VscSettingsGear /> },
  { id: 'data', label: 'Data & About', icon: <VscDatabase /> },
];

export default function SettingsModal({ onClose, initialTab = 'appearance', onOpenExportImport, onResetWorkspace, storageKind }) {
  const [tab, setTab] = useState(initialTab);
  const panelRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="settings-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="settings-modal" ref={panelRef}>
        <aside className="settings-rail">
          <div className="settings-rail__title">Settings</div>
          {TABS.map((t) => (
            <button key={t.id} className={`settings-rail__item${tab === t.id ? ' is-active' : ''}`} onClick={() => setTab(t.id)}>
              <span className="settings-rail__icon">{t.icon}</span>{t.label}
            </button>
          ))}
        </aside>

        <div className="settings-content">
          <button className="settings-close" onClick={onClose} aria-label="Close settings"><VscClose /></button>
          {tab === 'account' && <AccountPanel />}
          {tab === 'appearance' && <AppearancePanel />}
          {tab === 'editor' && <EditorPanel />}
          {tab === 'behavior' && <BehaviorPanel />}
          {tab === 'data' && (
            <DataPanel
              storageKind={storageKind}
              onOpenExportImport={onOpenExportImport}
              onResetWorkspace={onResetWorkspace}
            />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function AccountPanel() {
  const { user, isGuest, backendStatus, logout, exitOfflineMode } = useAuth();
  const { syncState, cloudConflict, resolveSyncConflict } = useContext(CardsContext);

  const resolve = async (strategy) => {
    try { await resolveSyncConflict(strategy); }
    catch (error) { toast.error(error.message || 'Could not resolve sync conflict'); }
  };

  return (
    <div>
      <h2 className="settings-h2">Account &amp; Sync</h2>
      <Section title="Account">
        {user ? (
          <>
            <Row title={user.displayName || 'Kandoo user'} desc={user.email || user.phone || 'Signed in'}>
              <button className="settings-btn" onClick={logout}>Sign out</button>
            </Row>
            <Row title="Cloud connection" desc={backendStatus === 'online' ? 'Authenticated with the Kandoo API.' : 'Signed in, but the API is currently unavailable.'}>
              <span className="mac-chip">{backendStatus === 'online' ? 'Online' : 'Offline'}</span>
            </Row>
            <Row title="Workspace sync" desc={syncState === 'conflict' ? 'Another device saved a newer revision.' : 'Local changes are saved first, then uploaded.'}>
              <span className="mac-chip">{syncState}</span>
            </Row>
          </>
        ) : (
          <Row title="Offline workspace" desc="This workspace is stored only on this device until you sign in.">
            <button className="settings-btn settings-btn--primary" onClick={exitOfflineMode}>{isGuest ? 'Sign in' : 'Open login'}</button>
          </Row>
        )}
      </Section>

      {cloudConflict && (
        <Section title="Sync conflict">
          <Row title="Choose which workspace to keep" desc="Loading cloud replaces this device's current workspace. Uploading this device replaces the cloud revision.">
            <span style={{ display: 'inline-flex', gap: 6 }}>
              <button className="settings-btn" onClick={() => resolve('cloud')}>Load cloud</button>
              <button className="settings-btn settings-btn--danger" onClick={() => resolve('local')}>Upload this device</button>
            </span>
          </Row>
        </Section>
      )}
    </div>
  );
}

// ── Reusable rows / controls ────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div className="settings-section">
      <div className="settings-section__title">{title}</div>
      {children}
    </div>
  );
}
function Row({ title, desc, children }) {
  return (
    <div className="settings-row">
      <div className="settings-row__info">
        <div className="settings-row__name">{title}</div>
        {desc && <div className="settings-row__desc">{desc}</div>}
      </div>
      <div className="settings-row__control">{children}</div>
    </div>
  );
}
function Toggle({ checked, onChange }) {
  return (
    <button role="switch" aria-checked={checked} className={`settings-toggle${checked ? ' is-on' : ''}`} onClick={() => onChange(!checked)}>
      <span className="settings-toggle__knob" />
    </button>
  );
}
function Segmented({ value, options, onChange }) {
  return (
    <div className="settings-seg">
      {options.map((o) => (
        <button key={o.value} className={`settings-seg__btn${value === o.value ? ' is-active' : ''}`} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}
function Select({ value, options, onChange }) {
  return (
    <select className="settings-select" value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// ── Appearance ──────────────────────────────────────────────────────────────
function AppearancePanel() {
  const { currentThemeId, builtInThemes, customThemes, setTheme, addCustomTheme, removeCustomTheme, exportTheme } = useTheme();
  const { settings, setSetting } = useSettings();
  const [jsonInput, setJsonInput] = useState('');
  const [msg, setMsg] = useState(null);

  const handleExport = (id) => {
    const json = exportTheme(id);
    if (!json) return;
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `kandoo-theme-${id}.json`; a.click();
    URL.revokeObjectURL(url);
  };
  const handleImport = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      const res = addCustomTheme(parsed);
      if (res.success) { setMsg({ ok: true, text: `Imported “${parsed.name}”` }); setJsonInput(''); setTheme(res.theme.id); }
      else setMsg({ ok: false, text: res.error });
    } catch { setMsg({ ok: false, text: 'Invalid JSON.' }); }
  };
  const sampleTheme = JSON.stringify({ name: 'My Theme', colors: THEME_TOKENS.reduce((a, t) => (a[t] = '#000000', a), {}) }, null, 2);

  const ThemeCard = ({ theme, custom }) => (
    <div className={`ts-theme-card ${currentThemeId === theme.id ? 'active' : ''}`} onClick={() => setTheme(theme.id)}>
      <div className="ts-preview">
        <div className="ts-preview-bar" style={{ background: theme.colors.bgPrimary }} />
        <div className="ts-preview-bar" style={{ background: theme.colors.bgCard }} />
        <div className="ts-preview-bar" style={{ background: theme.colors.accent }} />
        <div className="ts-preview-bar" style={{ background: theme.colors.bgInput }} />
      </div>
      <div className="ts-theme-name">{theme.emoji && <span className="emoji">{theme.emoji}</span>}{theme.name}</div>
      {custom && (
        <div className="ts-custom-actions">
          <button className="ts-btn-sm ts-btn-export" onClick={(e) => { e.stopPropagation(); handleExport(theme.id); }}>Export</button>
          <button className="ts-btn-sm ts-btn-delete" onClick={(e) => { e.stopPropagation(); removeCustomTheme(theme.id); }}>Delete</button>
        </div>
      )}
    </div>
  );

  return (
    <div>
      <h2 className="settings-h2">Appearance</h2>
      <Section title="Theme">
        <div className="ts-grid">{builtInThemes.map((t) => <ThemeCard key={t.id} theme={t} />)}</div>
        {customThemes.length > 0 && <div className="ts-grid" style={{ marginTop: 12 }}>{customThemes.map((t) => <ThemeCard key={t.id} theme={t} custom />)}</div>}
      </Section>

      <Section title="Accent">
        <div className="settings-swatches">
          {ACCENTS.map((a) => (
            <button key={a.label} title={a.label}
              className={`settings-swatch${settings.accent === a.value ? ' is-active' : ''}`}
              style={a.value ? { background: a.value } : undefined}
              onClick={() => setSetting('accent', a.value)}>
              {!a.value && 'A'}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Interface">
        <Row title="Density" desc="Compact tightens spacing across the app.">
          <Segmented value={settings.density} onChange={(v) => setSetting('density', v)}
            options={[{ label: 'Comfortable', value: 'comfortable' }, { label: 'Compact', value: 'compact' }]} />
        </Row>
        <Row title="Reduce motion" desc="Minimise animations and transitions.">
          <Toggle checked={settings.reduceMotion} onChange={(v) => setSetting('reduceMotion', v)} />
        </Row>
      </Section>

      <Section title="Import custom theme">
        <textarea className="ts-textarea" value={jsonInput}
          onChange={(e) => { setJsonInput(e.target.value); setMsg(null); }}
          placeholder={`Paste theme JSON…\n\n${sampleTheme.slice(0, 160)}…`} />
        <div className="settings-actions">
          <button className="settings-btn" onClick={() => handleExport(currentThemeId)}>Export current</button>
          <button className="settings-btn settings-btn--primary" onClick={handleImport} disabled={!jsonInput.trim()}>Import</button>
        </div>
        {msg && <div className={msg.ok ? 'ts-success' : 'ts-error'}>{msg.ok ? '✅ ' : '❌ '}{msg.text}</div>}
      </Section>
    </div>
  );
}

// ── Editor ──────────────────────────────────────────────────────────────────
function EditorPanel() {
  const { settings, setSetting } = useSettings();
  return (
    <div>
      <h2 className="settings-h2">Editor (Notes)</h2>
      <Section title="Typography">
        <Row title="Font" desc="Default font for the note body.">
          <Select value={settings.noteFontFamily} options={FONT_FAMILIES} onChange={(v) => setSetting('noteFontFamily', v)} />
        </Row>
        <Row title="Font size" desc={`${settings.noteFontSize}px`}>
          <input type="range" min="13" max="24" value={settings.noteFontSize}
            onChange={(e) => setSetting('noteFontSize', Number(e.target.value))} className="settings-range" />
        </Row>
        <Row title="Line height" desc={String(settings.noteLineHeight)}>
          <input type="range" min="1.3" max="2.2" step="0.1" value={settings.noteLineHeight}
            onChange={(e) => setSetting('noteLineHeight', Number(e.target.value))} className="settings-range" />
        </Row>
      </Section>
      <Section title="Behaviour">
        <Row title="Default view" desc="Open notes as a centred page or full width.">
          <Segmented value={settings.noteDefaultView} onChange={(v) => setSetting('noteDefaultView', v)}
            options={[{ label: 'Paper', value: 'paper' }, { label: 'Wide', value: 'wide' }]} />
        </Row>
        <Row title="Spell check" desc="Underline misspelled words while writing.">
          <Toggle checked={settings.noteSpellcheck} onChange={(v) => setSetting('noteSpellcheck', v)} />
        </Row>
      </Section>
      <div className="settings-preview note-prose" style={{ minHeight: 'auto' }}>
        <p style={{ fontFamily: settings.noteFontFamily || undefined, fontSize: `${settings.noteFontSize}px`, lineHeight: settings.noteLineHeight }}>
          The quick brown fox jumps over the lazy dog — preview of your note typography.
        </p>
      </div>
    </div>
  );
}

// ── Behavior & Shortcuts ────────────────────────────────────────────────────
function BehaviorPanel() {
  const { settings, setSetting } = useSettings();
  return (
    <div>
      <h2 className="settings-h2">Behavior &amp; Shortcuts</h2>
      <Section title="Tasks">
        <Row title="Deleting a task" desc="Undo shows a toast you can revert; Confirm asks first.">
          <Segmented value={settings.taskDeleteMode} onChange={(v) => setSetting('taskDeleteMode', v)}
            options={[{ label: 'Undo toast', value: 'undo' }, { label: 'Confirm', value: 'confirm' }]} />
        </Row>
        <Row title="Quick-add due date" desc="Menu-bar quick-add sets the task due today.">
          <Toggle checked={settings.quickAddDueToday} onChange={(v) => setSetting('quickAddDueToday', v)} />
        </Row>
      </Section>
      <Section title="Keyboard shortcuts">
        <div className="settings-shortcuts">
          {SHORTCUTS.map((g) => (
            <div key={g.group} className="settings-shortcuts__group">
              <div className="settings-shortcuts__label">{g.group}</div>
              {g.items.map((it, i) => (
                <div key={i} className="settings-shortcuts__row">
                  <span>{it.desc}</span>
                  <span className="settings-shortcuts__keys">{it.keys.map((k, j) => <kbd key={j}>{k}</kbd>)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ── Data & About ────────────────────────────────────────────────────────────
function DataPanel({ storageKind, onOpenExportImport, onResetWorkspace }) {
  const { resetSettings } = useSettings();
  const [confirmReset, setConfirmReset] = useState(false);
  const path = storageKind === 'sqlite' ? SQLITE_PATH : 'Browser localStorage (development)';

  const copyPath = async () => {
    try { await navigator.clipboard.writeText(path); toast.success('Path copied'); } catch { toast.error('Copy failed'); }
  };

  return (
    <div>
      <h2 className="settings-h2">Data &amp; About</h2>
      <Section title="Backup">
        <Row title="Export / Import" desc="JSON backup of every board, or restore from a file.">
          <button className="settings-btn" onClick={onOpenExportImport}>Open</button>
        </Row>
        <Row title="Workspace location" desc={path}>
          <button className="settings-btn" onClick={copyPath}><VscCopy /> Copy</button>
        </Row>
      </Section>

      <Section title="Reset">
        <Row title="Reset settings" desc="Restore appearance, editor and behavior defaults.">
          <button className="settings-btn" onClick={() => { resetSettings(); toast.success('Settings reset'); }}>Reset settings</button>
        </Row>
        <Row title="Reset workspace" desc="Delete all boards, tasks and notes. Cannot be undone.">
          {confirmReset ? (
            <span style={{ display: 'inline-flex', gap: 6 }}>
              <button className="settings-btn settings-btn--danger" onClick={() => { onResetWorkspace(); setConfirmReset(false); }}>Delete everything</button>
              <button className="settings-btn" onClick={() => setConfirmReset(false)}>Cancel</button>
            </span>
          ) : (
            <button className="settings-btn settings-btn--danger" onClick={() => setConfirmReset(true)}>Reset workspace</button>
          )}
        </Row>
      </Section>

      <Section title="About">
        <div className="settings-about">
          <div className="settings-about__name">Kandoo Desktop</div>
          <div className="settings-about__ver">Version {APP_VERSION} · local-first, stored on this {storageKind === 'sqlite' ? 'Mac' : 'browser'}</div>
          <a className="settings-link" href={REPO_URL} target="_blank" rel="noopener noreferrer">{REPO_URL}</a>
        </div>
      </Section>
    </div>
  );
}

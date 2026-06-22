import { Suspense, lazy, useEffect, useRef, useState, useMemo, Fragment } from 'react';
import { createPortal } from 'react-dom';
import {
  VscAdd, VscTrash, VscChevronRight, VscChromeMaximize, VscChromeRestore,
  VscArrowLeft, VscArrowRight, VscBook, VscFile, VscDiscard, VscRedo,
} from 'react-icons/vsc';
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToFirstScrollableAncestor } from '@dnd-kit/modifiers';

const NEST_THRESHOLD = 22; // px dragged right before a hover becomes a "nest inside"
import { CSS } from '@dnd-kit/utilities';
import { markdownToHtml, isHtml } from '../../utils/htmlEditor';

const INDENT_WIDTH = 14;

// ── Note-tree drag-and-drop helpers (flat array, order = sibling order) ───────

// Flatten the visible tree (collapsed subtrees omitted) into an ordered list.
function flattenNoteTree(notes, collapsed) {
  const byParent = new Map();
  notes.forEach((n) => {
    const p = n.parentUid || null;
    if (!byParent.has(p)) byParent.set(p, []);
    byParent.get(p).push(n);
  });
  const out = [];
  const walk = (parentUid, depth) => {
    (byParent.get(parentUid) || []).forEach((n) => {
      const hasKids = (byParent.get(n.uid) || []).length > 0;
      out.push({ uid: n.uid, parentUid: parentUid || null, depth, hasKids, note: n });
      if (hasKids && !collapsed.has(n.uid)) walk(n.uid, depth + 1);
    });
  };
  walk(null, 0);
  return out;
}

// uids of every descendant of `uid` within a flattened list.
function descendantUids(flat, uid) {
  const result = new Set();
  const addChildren = (parent) => {
    flat.forEach((f) => {
      if (f.parentUid === parent && !result.has(f.uid)) { result.add(f.uid); addChildren(f.uid); }
    });
  };
  addChildren(uid);
  return result;
}

// Is `maybeUid` a descendant of `ancestorUid`? Used to forbid dropping a
// notebook into its own subtree.
function isDescendantOf(notes, ancestorUid, maybeUid) {
  const byParent = new Map();
  notes.forEach((n) => {
    const p = n.parentUid || null;
    if (!byParent.has(p)) byParent.set(p, []);
    byParent.get(p).push(n.uid);
  });
  const stack = [...(byParent.get(ancestorUid) || [])];
  while (stack.length) {
    const cur = stack.pop();
    if (cur === maybeUid) return true;
    stack.push(...(byParent.get(cur) || []));
  }
  return false;
}

// Compute the full new uid order for a drop:
//   'before' / 'after' → reorder as a sibling of `overUid`
//   'inside'           → nest as the first child of `overUid`
//   'outdent'          → pop out one level (sibling right after its old parent)
// Returns { orderedUids, newParent } or null.
function applyZoneOrder(notes, draggedUid, overUid, mode) {
  let newParent;
  let placement; // { type: 'unshift' | 'before' | 'after', uid? }
  if (mode === 'inside') {
    if (!notes.find((n) => n.uid === overUid)) return null;
    newParent = overUid;
    placement = { type: 'unshift' };
  } else if (mode === 'outdent') {
    const dragged = notes.find((n) => n.uid === draggedUid);
    const oldParentUid = dragged?.parentUid || null;
    if (!oldParentUid) return null; // already top-level — nothing to come out of
    const oldParent = notes.find((n) => n.uid === oldParentUid);
    newParent = oldParent?.parentUid || null;
    placement = { type: 'after', uid: oldParentUid };
  } else {
    const overNote = notes.find((n) => n.uid === overUid);
    if (!overNote) return null;
    newParent = overNote.parentUid || null;
    placement = { type: mode, uid: overUid }; // 'before' | 'after'
  }

  const childrenOf = new Map();
  notes.forEach((n) => {
    const p = n.parentUid || null;
    if (!childrenOf.has(p)) childrenOf.set(p, []);
    childrenOf.get(p).push(n.uid);
  });
  childrenOf.forEach((list) => {
    const i = list.indexOf(draggedUid);
    if (i >= 0) list.splice(i, 1);
  });
  if (!childrenOf.has(newParent)) childrenOf.set(newParent, []);
  const target = childrenOf.get(newParent);
  if (placement.type === 'unshift') {
    target.unshift(draggedUid);
  } else {
    const idx = target.indexOf(placement.uid);
    const at = placement.type === 'before' ? Math.max(0, idx) : (idx < 0 ? target.length : idx + 1);
    target.splice(at, 0, draggedUid);
  }

  const orderedUids = [];
  const seen = new Set();
  const dfs = (parentUid) => {
    (childrenOf.get(parentUid) || []).forEach((uid) => {
      if (seen.has(uid)) return;
      seen.add(uid);
      orderedUids.push(uid);
      dfs(uid);
    });
  };
  dfs(null);
  notes.forEach((n) => { if (!seen.has(n.uid)) { orderedUids.push(n.uid); seen.add(n.uid); } });
  return { orderedUids, newParent };
}
import { useSettings } from '../../contexts/SettingsContext';
import ContextMenu from '../ContextMenu';
import NoteExportMenu from './NoteExportMenu';
import MoveNoteConfirmModal from './MoveNoteConfirmModal';

// TipTap pulls in ProseMirror + lowlight — load it only when Notes is opened.
const NoteEditor = lazy(() => import('./NoteEditor'));

const NOTES_TREE_WIDTH_KEY = 'kandoo-notes-tree-width';
const NOTES_TREE_MIN = 180;
const NOTES_TREE_MAX = 420;
const NOTES_CANVAS_MIN = 420;
const NOTEBOOK_ICON_RECENTS_KEY = 'kandoo-recent-notebook-icons';
const DEFAULT_NOTEBOOK_ICON_KEY = 'LuBookOpen';

// Expose the complete Lucide outline family instead of maintaining a small,
// arbitrary subset. A consistent outline family keeps the tree visually calm,
// while search makes the large catalogue practical to use.
const iconLabel = (exportName) => exportName
  .replace(/^Lu/, '')
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2');

let notebookIconModuleCache = null;
let notebookIconCatalogCache = null;
let notebookIconLoadPromise = null;

const buildNotebookIconCatalog = (module) => Object.entries(module)
  .filter(([name]) => name.startsWith('Lu'))
  .map(([key, Icon]) => ({ key, label: iconLabel(key), Icon }))
  .sort((a, b) => a.label.localeCompare(b.label));

const loadNotebookIconLibrary = () => {
  if (notebookIconModuleCache) {
    return Promise.resolve({ module: notebookIconModuleCache, catalog: notebookIconCatalogCache });
  }
  if (!notebookIconLoadPromise) {
    notebookIconLoadPromise = import('react-icons/lu').then((module) => {
      notebookIconModuleCache = module;
      notebookIconCatalogCache = buildNotebookIconCatalog(module);
      return { module, catalog: notebookIconCatalogCache };
    });
  }
  return notebookIconLoadPromise;
};

// Preserve selections made by the earlier curated picker.
const LEGACY_NOTEBOOK_ICON_KEYS = {
  book: 'LuBookOpen', IoBookOutline: 'LuBookOpen',
  library: 'LuLibrary', IoLibraryOutline: 'LuLibrary',
  briefcase: 'LuBriefcase', IoBriefcaseOutline: 'LuBriefcase',
  school: 'LuSchool', IoSchoolOutline: 'LuSchool',
  bulb: 'LuLightbulb', IoBulbOutline: 'LuLightbulb',
  rocket: 'LuRocket', IoRocketOutline: 'LuRocket',
  heart: 'LuHeart', IoHeartOutline: 'LuHeart',
  home: 'LuHome', IoHomeOutline: 'LuHome',
  calendar: 'LuCalendarDays', IoCalendarOutline: 'LuCalendarDays',
  code: 'LuCode', IoCodeSlashOutline: 'LuCode',
  layers: 'LuLayers', IoLayersOutline: 'LuLayers',
  people: 'LuUsers', IoPeopleOutline: 'LuUsers',
  planet: 'LuGlobe2', IoPlanetOutline: 'LuGlobe2',
};

const NOTEBOOK_ICON_COLORS = [
  { key: 'accent', label: 'Theme colour', value: 'var(--theme-accent)' },
  { key: 'blue', label: 'Blue', value: '#4f86df' },
  { key: 'purple', label: 'Purple', value: '#8067c8' },
  { key: 'pink', label: 'Pink', value: '#c85f91' },
  { key: 'red', label: 'Red', value: '#d76558' },
  { key: 'orange', label: 'Orange', value: '#c9822f' },
  { key: 'green', label: 'Green', value: '#4f9b67' },
  { key: 'teal', label: 'Teal', value: '#318f89' },
  { key: 'slate', label: 'Slate', value: '#68778c' },
];

const normalizeNotebookIconKey = (key) => LEGACY_NOTEBOOK_ICON_KEYS[key] || key || DEFAULT_NOTEBOOK_ICON_KEY;
const getNotebookIconColor = (key) => NOTEBOOK_ICON_COLORS.find((item) => item.key === key)?.value || NOTEBOOK_ICON_COLORS[0].value;

function NotebookIcon({ iconKey, colorKey }) {
  const normalizedKey = normalizeNotebookIconKey(iconKey);
  const [Icon, setIcon] = useState(() => notebookIconModuleCache?.[normalizedKey] || VscBook);

  useEffect(() => {
    let active = true;
    if (notebookIconModuleCache?.[normalizedKey]) {
      setIcon(() => notebookIconModuleCache[normalizedKey]);
      return undefined;
    }
    if (normalizedKey === DEFAULT_NOTEBOOK_ICON_KEY) {
      setIcon(() => VscBook);
      return undefined;
    }
    loadNotebookIconLibrary().then(({ module }) => {
      if (active) setIcon(() => module[normalizedKey] || VscBook);
    });
    return () => { active = false; };
  }, [normalizedKey]);

  return <Icon style={{ color: getNotebookIconColor(colorKey) }} />;
}

function readRecentNotebookIcons() {
  try {
    const saved = JSON.parse(localStorage.getItem(NOTEBOOK_ICON_RECENTS_KEY) || '[]');
    return Array.isArray(saved)
      ? saved.map(normalizeNotebookIconKey).filter((key) => /^Lu[A-Z]/.test(key)).slice(0, 5)
      : [];
  } catch {
    return [];
  }
}

function NotebookIconPicker({ note, anchor, onUpdate, onClose }) {
  const pickerRef = useRef(null);
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState(readRecentNotebookIcons);
  const [icons, setIcons] = useState(() => notebookIconCatalogCache || []);
  const [position, setPosition] = useState({ left: anchor.x, top: anchor.y });
  const selectedIcon = normalizeNotebookIconKey(note.notebookIcon);
  const selectedColor = note.notebookIconColor || 'accent';

  useEffect(() => {
    const picker = pickerRef.current;
    if (!picker) return;
    const rect = picker.getBoundingClientRect();
    const pad = 8;
    setPosition({
      left: Math.max(pad, Math.min(anchor.x, window.innerWidth - rect.width - pad)),
      top: Math.max(pad, Math.min(anchor.y, window.innerHeight - rect.height - pad)),
    });
  }, [anchor, icons.length]);

  useEffect(() => {
    let active = true;
    loadNotebookIconLibrary().then(({ catalog }) => {
      if (active) setIcons(catalog);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const handlePointer = (event) => {
      if (!pickerRef.current?.contains(event.target)) onClose();
    };
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const chooseIcon = (key) => {
    onUpdate({ notebookIcon: key });
    setRecent((previous) => {
      const next = [key, ...previous.filter((item) => item !== key)].slice(0, 5);
      try { localStorage.setItem(NOTEBOOK_ICON_RECENTS_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
      return next;
    });
  };

  const normalizedQuery = query.trim().toLowerCase();
  const filteredIcons = icons.filter((item) =>
    !normalizedQuery || item.label.toLowerCase().includes(normalizedQuery) || item.key.toLowerCase().includes(normalizedQuery)
  );
  const recentIcons = recent.map((key) => icons.find((item) => item.key === key)).filter(Boolean);

  return createPortal(
    <div
      ref={pickerRef}
      className="notebook-icon-picker"
      style={{ left: position.left, top: position.top, '--notebook-picker-color': getNotebookIconColor(selectedColor) }}
      role="dialog"
      aria-label="Choose notebook icon and colour"
    >
      <div className="notebook-icon-picker__preview">
        <span className="notebook-icon-picker__preview-icon">
          <NotebookIcon iconKey={selectedIcon} colorKey={selectedColor} />
        </span>
        <div>
          <strong>{note.title?.trim() || 'Untitled'}</strong>
          <small>Notebook icon</small>
        </div>
        <button
          type="button"
          className="notebook-icon-picker__reset"
          onClick={() => onUpdate({ notebookIcon: null, notebookIconColor: null })}
        >
          Reset
        </button>
      </div>

      <label className="notebook-icon-picker__search">
        <span className="sr-only">Search icons</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search icons…" autoFocus />
      </label>

      <div className="notebook-icon-picker__section">
        <span className="notebook-icon-picker__label">Colour</span>
        <div className="notebook-icon-picker__colours">
          {NOTEBOOK_ICON_COLORS.map((color) => (
            <button
              key={color.key}
              type="button"
              className={selectedColor === color.key ? 'is-selected' : ''}
              style={{ '--notebook-swatch': color.value }}
              title={color.label}
              aria-label={color.label}
              aria-pressed={selectedColor === color.key}
              onClick={() => onUpdate({ notebookIconColor: color.key })}
            />
          ))}
        </div>
      </div>

      <div className="notebook-icon-picker__scroll">
        {!normalizedQuery && recentIcons.length > 0 && (
          <div className="notebook-icon-picker__section">
            <span className="notebook-icon-picker__label">Recent</span>
            <div className="notebook-icon-picker__grid">
              {recentIcons.map(({ key, label, Icon }) => (
                <button key={key} type="button" className={selectedIcon === key ? 'is-selected' : ''}
                  onClick={() => chooseIcon(key)} title={label} aria-label={label} aria-pressed={selectedIcon === key}>
                  <Icon />
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="notebook-icon-picker__section">
          <span className="notebook-icon-picker__label">Icons · {filteredIcons.length}</span>
          {icons.length === 0 ? (
            <div className="notebook-icon-picker__empty">Loading icon library…</div>
          ) : filteredIcons.length > 0 ? (
            <div className="notebook-icon-picker__grid">
              {filteredIcons.map(({ key, label, Icon }) => (
                <button key={key} type="button" className={selectedIcon === key ? 'is-selected' : ''}
                  onClick={() => chooseIcon(key)} title={label} aria-label={label} aria-pressed={selectedIcon === key}>
                  <Icon />
                </button>
              ))}
            </div>
          ) : <div className="notebook-icon-picker__empty">No matching icons</div>}
        </div>
      </div>
    </div>,
    document.body
  );
}

const clampNotesTreeWidth = (value, max = NOTES_TREE_MAX) =>
  Math.min(max, Math.max(NOTES_TREE_MIN, value));

function initialNotesTreeWidth() {
  try {
    const stored = localStorage.getItem(NOTES_TREE_WIDTH_KEY);
    const width = Number(stored);
    return stored !== null && Number.isFinite(width) ? clampNotesTreeWidth(width) : 232;
  } catch {
    return 232;
  }
}

function relativeTime(ts) {
  if (!ts) return '';
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60)     return 'just now';
  if (diff < 3600)   return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)} hr ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} day${Math.floor(diff / 86400) > 1 ? 's' : ''} ago`;
  return new Date(ts).toLocaleDateString();
}

// Document metrics for the meta line — words, lines (text blocks), characters
// and an estimated reading time (~200 wpm).
function noteMetrics(html) {
  const div = document.createElement('div');
  div.innerHTML = html || '';
  const text = div.textContent || '';
  const words = (text.match(/\S+/g) || []).length;
  const characters = text.trim().length;
  let lines = 0;
  div.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote, pre').forEach((b) => {
    if ((b.textContent || '').trim()) lines += 1;
  });
  return { words, characters, lines, readingMin: words ? Math.max(1, Math.round(words / 200)) : 0 };
}

// ── Sortable tree row (drag to reorder / reparent) ──────────────────────────
function SortableNoteRow({ item, activeUid, isDropInto, isDropOutOf, isCollapsed, editingUid, onSelect, onToggle, onCreate, onDelete, onOpenMenu, onOpenIconPicker, onStartRename, onRename }) {
  const { uid, depth, hasKids, note } = item;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: uid });
  // Vertical-only drag (locked by the modifier); only the dragged row moves, so
  // the drop target never slides away.
  const style = {
    transform: isDragging ? CSS.Translate.toString(transform) : undefined,
    transition: isDragging ? transition : undefined,
    paddingLeft: 6 + depth * INDENT_WIDTH,
    position: 'relative',
    zIndex: isDragging ? 5 : undefined,
  };
  return (
    <div
      ref={setNodeRef}
      className={`notes-tree__row${depth === 0 ? ' is-root' : ''}${uid === activeUid ? ' is-active' : ''}${isDragging ? ' is-dragging' : ''}${isDropInto ? ' is-drop-into' : ''}${isDropOutOf ? ' is-drop-outof' : ''}`}
      style={style}
      onClick={() => onSelect(uid)}
      onContextMenu={(event) => onOpenMenu(event, note, hasKids, isCollapsed)}
      {...attributes}
      {...listeners}
    >
      <button
        type="button"
        className="notes-tree__caret"
        style={{ visibility: hasKids ? 'visible' : 'hidden' }}
        onClick={(e) => { e.stopPropagation(); onToggle(uid); }}
        onPointerDown={(e) => e.stopPropagation()}
        tabIndex={-1}
        aria-label={isCollapsed ? 'Expand' : 'Collapse'}
      >
        <VscChevronRight style={{ transform: isCollapsed ? 'none' : 'rotate(90deg)', transition: 'transform 0.12s' }} />
      </button>
      {depth === 0 ? (
        <button
          type="button"
          className="notes-tree__icon-button notes-tree__icon--book"
          onClick={(event) => { event.stopPropagation(); onOpenIconPicker(event, note); }}
          onPointerDown={(event) => event.stopPropagation()}
          title="Change notebook icon"
          aria-label={`Change icon for ${note.title?.trim() || 'Untitled'}`}
        >
          <NotebookIcon iconKey={note.notebookIcon} colorKey={note.notebookIconColor} />
        </button>
      ) : <VscFile className="notes-tree__icon" />}
      {editingUid === uid ? (
        <input
          className="notes-tree__rename"
          autoFocus
          defaultValue={note.title || ''}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onFocus={(e) => e.target.select()}
          onBlur={(e) => onRename(uid, e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
            if (e.key === 'Escape') { e.preventDefault(); onRename(uid, note.title || ''); }
          }}
        />
      ) : (
        <span
          className="notes-tree__title"
          onDoubleClick={(e) => { e.stopPropagation(); onStartRename(uid); }}
          title="Double-click to rename · drag to move"
        >
          {note.title?.trim() || 'Untitled'}
        </span>
      )}
      <span className="notes-tree__actions">
        <button type="button" onClick={(e) => { e.stopPropagation(); onToggle(uid, true); onCreate(uid, true); }} onPointerDown={(e) => e.stopPropagation()} title="Add sub-page"><VscAdd /></button>
        <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(uid); }} onPointerDown={(e) => e.stopPropagation()} title="Delete page"><VscTrash /></button>
      </span>
    </div>
  );
}

// ── Editable page title ─────────────────────────────────────────────────────
function PageTitle({ value, onChange }) {
  const [draft, setDraft] = useState(value || '');
  const [editing, setEditing] = useState(false);
  useEffect(() => { setDraft(value || ''); }, [value]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onChange(trimmed);
    setEditing(false);
  };

  const sharedStyle = {
    fontSize: '1.9rem', fontWeight: 700, color: 'var(--theme-text-primary)',
    margin: '0 0 0.5rem 0', lineHeight: 1.2,
  };

  if (editing) {
    return (
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          if (e.key === 'Escape') { e.preventDefault(); setDraft(value || ''); setEditing(false); }
        }}
        autoFocus
        onFocus={(e) => e.target.select()}
        placeholder="Untitled"
        style={{ ...sharedStyle, background: 'transparent', border: 'none', width: '100%', padding: 0, outline: 'none', fontFamily: 'inherit' }}
      />
    );
  }
  return (
    <h1 onClick={() => setEditing(true)} title="Click to rename" style={{ ...sharedStyle, cursor: 'text', userSelect: 'none' }}>
      {value?.trim() || <span style={{ color: 'var(--theme-text-muted)', fontStyle: 'italic', fontWeight: 500 }}>Untitled</span>}
    </h1>
  );
}

// ── Active-page canvas ──────────────────────────────────────────────────────
function NoteCanvas({ index, card, notes, updateCardNote, updateCards, onCreateChild, onNavigate, onSendListToBoard, onBack, onForward, canBack, canForward }) {
  const { settings } = useSettings();
  const [paperless, setPaperless] = useState(settings.noteDefaultView === 'wide');
  const togglePaperless = () => setPaperless((p) => !p);

  const safeNote = card.note || { content: '', images: [], updatedAt: Date.now() };
  const baseHtml = isHtml(safeNote.content) ? safeNote.content : markdownToHtml(safeNote.content || '');
  const legacyImages = safeNote.images || [];
  const initialContent = legacyImages.length
    ? baseHtml + legacyImages.map((src) => `<p><img src="${src}"></p>`).join('')
    : baseHtml;

  useEffect(() => {
    if (legacyImages.length) updateCardNote(index, { ...safeNote, content: initialContent, images: [] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.uid]);

  const handleContent = (html) => updateCardNote(index, { ...safeNote, content: html, images: [] });
  const handleTitle = (newTitle) => updateCards((cards) => cards.map((c) => (c.uid === card.uid ? { ...c, title: newTitle } : c)));
  const metrics = noteMetrics(safeNote.content || '');

  return (
    <div
      key={card.uid}
      className={paperless ? 'note-canvas' : 'note-canvas note-paper'}
    >
      <div className="note-canvas__nav">
        <button type="button" className="note-nav-btn" onClick={onBack} disabled={!canBack} title="Back" aria-label="Back">
          <VscArrowLeft />
        </button>
        <button type="button" className="note-nav-btn" onClick={onForward} disabled={!canForward} title="Forward" aria-label="Forward">
          <VscArrowRight />
        </button>
      </div>

      <PageTitle value={card.title} onChange={handleTitle} />

      <div className="note-canvas__meta">
        <span>
          {safeNote.updatedAt && `Edited ${relativeTime(safeNote.updatedAt)}`}
          {metrics.words > 0 && (
            <span title={`${metrics.words} words · ${metrics.lines} lines · ${metrics.characters} characters · ~${metrics.readingMin} min read`}>
              {' · '}{metrics.words} word{metrics.words === 1 ? '' : 's'}
              {' · '}{metrics.lines} line{metrics.lines === 1 ? '' : 's'}
              {' · '}{metrics.characters} char{metrics.characters === 1 ? '' : 's'}
              {' · ~'}{metrics.readingMin} min read
            </span>
          )}
        </span>
        <div className="note-canvas__actions">
          <NoteExportMenu title={card.title?.trim() || 'Untitled'} html={initialContent} />
          <button type="button" className="note-view-toggle"
            onClick={togglePaperless}
            title={paperless ? 'Switch to paper view' : 'Switch to wide view'}>
            {paperless ? <><VscChromeRestore /> Paper</> : <><VscChromeMaximize /> Wide</>}
          </button>
        </div>
      </div>

      <Suspense fallback={<div style={{ padding: '2rem 0', color: 'var(--theme-text-muted)', fontSize: '0.85rem' }}>Loading editor…</div>}>
        <NoteEditor
          key={card.uid}
          content={initialContent}
          onChange={handleContent}
          paperless={paperless}
          notes={notes}
          onCreatePage={() => ({ uid: onCreateChild(card.uid, false), title: 'Untitled' })}
          onNavigatePage={onNavigate}
          onSendListToBoard={(items) => onSendListToBoard?.({ items, noteUid: card.uid })}
          placeholder="Type ‘/’ for commands, or just start writing. Markdown shortcuts and drag-and-drop images work too."
        />
      </Suspense>
    </div>
  );
}

// ── Main view (tree + canvas) ───────────────────────────────────────────────
function NotesView({ allCards, notes, activeUid, onSelectNote, onCreateNote, onDeleteNote, updateCardNote, updateCards, onSendListToBoard }) {
  const activeCard = notes.find((n) => n.uid === activeUid) || null;
  const activeIndex = activeCard ? allCards.findIndex((c) => c.uid === activeCard.uid) : -1;
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [pageContextMenu, setPageContextMenu] = useState(null);
  const [iconPicker, setIconPicker] = useState(null); // { uid, anchor: { x, y } }
  const [editingUid, setEditingUid] = useState(null);

  const renameNote = (uid, title) => {
    const t = (title || '').trim();
    if (t) updateCards((cards) => cards.map((c) => (c.uid === uid ? { ...c, title: t } : c)));
    setEditingUid(null);
  };

  const updateNotebookAppearance = (uid, patch) => {
    updateCards((cards) => cards.map((card) => (card.uid === uid ? { ...card, ...patch } : card)));
  };

  const openNotebookIconPicker = (event, note) => {
    if (note.parentUid) return;
    const rect = event.currentTarget?.getBoundingClientRect?.();
    setIconPicker({
      uid: note.uid,
      anchor: rect
        ? { x: rect.left, y: rect.bottom + 6 }
        : { x: event.clientX, y: event.clientY },
    });
  };

  // ── Tree drag-and-drop (vertical-locked; hover top/middle/bottom of a row to
  //    drop before / inside / after it) ─────────────────────────────────────────
  const [activeId, setActiveId]     = useState(null);
  const [dropTarget, setDropTarget] = useState(null); // { overUid, mode: 'before'|'inside'|'after' }
  const [pendingMove, setPendingMove] = useState(null); // reparent awaiting confirmation
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // The boundary modifier clamps the dragged row to the narrow sidebar, so its
  // delta.x can't grow — track the raw pointer X to detect rightward "nest" intent.
  const dragStartXRef = useRef(0);
  const dragXRef = useRef(0);
  useEffect(() => {
    if (!activeId) return undefined;
    const onMove = (e) => { dragXRef.current = e.clientX; };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [activeId]);

  const flattened = useMemo(() => flattenNoteTree(notes, collapsed), [notes, collapsed]);
  const flattenedTrimmed = useMemo(() => {
    if (!activeId) return flattened;
    const desc = descendantUids(flattened, activeId); // hide the dragged subtree
    return flattened.filter((f) => !desc.has(f.uid));
  }, [flattened, activeId]);
  const sortableUids = useMemo(() => flattenedTrimmed.map((f) => f.uid), [flattenedTrimmed]);

  const resetDrag = () => { setActiveId(null); setDropTarget(null); };

  const reorderNotes = (orderedUids, draggedUid, newParentUid) => {
    updateCards((cards) => {
      const noteCards = cards.filter((c) => (c.type || 'todo') === 'note');
      // Safety net: only apply when the new order is an exact permutation of the
      // notes (no missing/duplicate uids) — so a logic slip can never drop a note.
      if (!orderedUids || orderedUids.length !== noteCards.length || new Set(orderedUids).size !== noteCards.length) return cards;
      const noteMap = new Map(noteCards.map((c) => [c.uid, c]));
      if (!noteMap.has(draggedUid)) return cards;
      noteMap.set(draggedUid, { ...noteMap.get(draggedUid), parentUid: newParentUid || null });
      let i = 0;
      return cards.map((c) => ((c.type || 'todo') === 'note' ? noteMap.get(orderedUids[i++]) : c));
    });
  };

  // ── Move history (undo / redo for drag reparents & reorders) ────────────────
  // Always read the freshest notes (event handlers can hold stale closures).
  const notesRef = useRef(notes);
  useEffect(() => { notesRef.current = notes; });
  const undoRef = useRef([]);
  const redoRef = useRef([]);
  const [history, setHistory] = useState({ canUndo: false, canRedo: false });
  const syncHistory = () => setHistory({ canUndo: undoRef.current.length > 0, canRedo: redoRef.current.length > 0 });

  // A snapshot of the note order + each note's parent — enough to fully restore.
  const captureLayout = () => {
    const ns = notesRef.current;
    return {
      order: ns.map((n) => n.uid),
      parents: Object.fromEntries(ns.map((n) => [n.uid, n.parentUid || null])),
    };
  };

  // Re-apply a captured layout. Bails if it no longer matches the current notes
  // (e.g. a page was added/removed) so a stale snapshot can't corrupt state.
  const restoreLayout = (snap) => {
    updateCards((cards) => {
      const noteCards = cards.filter((c) => (c.type || 'todo') === 'note');
      const curUids = new Set(noteCards.map((c) => c.uid));
      if (snap.order.length !== noteCards.length || !snap.order.every((u) => curUids.has(u))) return cards;
      const noteMap = new Map(noteCards.map((c) => [c.uid, c]));
      snap.order.forEach((uid) => { noteMap.set(uid, { ...noteMap.get(uid), parentUid: snap.parents[uid] ?? null }); });
      let i = 0;
      return cards.map((c) => ((c.type || 'todo') === 'note' ? noteMap.get(snap.order[i++]) : c));
    });
  };

  // Apply a move and record it so it can be undone. `revealUid` (a new parent)
  // is expanded so the moved page stays visible.
  const commitMove = (orderedUids, draggedUid, newParent, revealUid) => {
    undoRef.current = [...undoRef.current, captureLayout()].slice(-50);
    redoRef.current = [];
    reorderNotes(orderedUids, draggedUid, newParent);
    if (revealUid) onToggle(revealUid, true);
    syncHistory();
  };

  const undoMove = () => {
    if (!undoRef.current.length) return;
    const target = undoRef.current[undoRef.current.length - 1];
    undoRef.current = undoRef.current.slice(0, -1);
    redoRef.current = [...redoRef.current, captureLayout()].slice(-50);
    restoreLayout(target);
    syncHistory();
  };

  const redoMove = () => {
    if (!redoRef.current.length) return;
    const target = redoRef.current[redoRef.current.length - 1];
    redoRef.current = redoRef.current.slice(0, -1);
    undoRef.current = [...undoRef.current, captureLayout()].slice(-50);
    restoreLayout(target);
    syncHistory();
  };

  // Adding/removing a page invalidates the snapshots — start history fresh.
  const noteCount = notes.length;
  useEffect(() => {
    undoRef.current = [];
    redoRef.current = [];
    syncHistory();
  }, [noteCount]);

  // ⌘Z / ⌘⇧Z (and ⌘Y) undo & redo moves — but never while typing in the editor
  // or an input, where those keys belong to the text editor's own history.
  const movesRef = useRef({ undo: undoMove, redo: redoMove });
  useEffect(() => { movesRef.current = { undo: undoMove, redo: redoMove }; });
  const pendingMoveRef = useRef(null);
  useEffect(() => { pendingMoveRef.current = pendingMove; }, [pendingMove]);
  useEffect(() => {
    const onKey = (e) => {
      if (pendingMoveRef.current) return; // a confirm dialog owns the keyboard
      const meta = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (!meta || (key !== 'z' && key !== 'y')) return;
      const el = document.activeElement;
      if (el && (el.isContentEditable || el.closest?.('.ProseMirror, input, textarea, [contenteditable="true"]'))) return;
      const isRedo = key === 'y' || (key === 'z' && e.shiftKey);
      if (isRedo) { if (redoRef.current.length) { e.preventDefault(); movesRef.current.redo(); } }
      else if (undoRef.current.length) { e.preventDefault(); movesRef.current.undo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Drag right onto a row → nest inside it; drag left → pop out of the parent;
  // otherwise reorder before/after by vertical position. (Only the dragged row
  // moves; targets stay put.)
  const onDragMove = ({ active, over }) => {
    const rawDeltaX = dragXRef.current - dragStartXRef.current;
    const dragged = notes.find((n) => n.uid === active.id);
    // Leftward pull out of the parent — works even when hovering its own row.
    if (rawDeltaX < -NEST_THRESHOLD && dragged?.parentUid) {
      setDropTarget({ mode: 'outdent', overUid: over?.id ?? null, outOfUid: dragged.parentUid });
      return;
    }
    if (!over || over.id === active.id) { setDropTarget(null); return; }
    if (rawDeltaX > NEST_THRESHOLD && !isDescendantOf(notes, active.id, over.id)) {
      setDropTarget({ overUid: over.id, mode: 'inside' });
      return;
    }
    const aRect = active.rect.current.translated;
    const oRect = over.rect;
    const ratio = (aRect && oRect) ? (aRect.top + aRect.height / 2 - oRect.top) / oRect.height : 0.5;
    setDropTarget({ overUid: over.id, mode: ratio < 0.5 ? 'before' : 'after' });
  };

  const onDragEnd = ({ active, over }) => {
    const dt = dropTarget;
    let res = null;
    if (dt && dt.mode === 'outdent') {
      res = applyZoneOrder(notes, active.id, null, 'outdent');
    } else if (over && over.id !== active.id && dt && dt.overUid === over.id
               && !(dt.mode === 'inside' && isDescendantOf(notes, active.id, over.id))) {
      res = applyZoneOrder(notes, active.id, dt.overUid, dt.mode);
    }
    if (res) {
      const dragged = notes.find((n) => n.uid === active.id);
      const curParent = dragged?.parentUid || null;
      const newParent = res.newParent || null;
      const revealUid = dt.mode === 'inside' ? dt.overUid : null;
      if (newParent !== curParent) {
        // Reparenting — confirm before moving the page under (or out of) another.
        setPendingMove({
          draggedUid: active.id,
          draggedTitle: dragged?.title?.trim() || 'Untitled',
          orderedUids: res.orderedUids,
          newParent,
          newParentTitle: newParent ? (notes.find((n) => n.uid === newParent)?.title?.trim() || 'Untitled') : null,
          revealUid,
        });
      } else {
        // Same parent — just a reorder; apply directly (still undoable).
        commitMove(res.orderedUids, active.id, newParent, revealUid);
      }
    }
    resetDrag();
  };

  const confirmPendingMove = () => {
    if (!pendingMove) return;
    commitMove(pendingMove.orderedUids, pendingMove.draggedUid, pendingMove.newParent, pendingMove.revealUid);
    setPendingMove(null);
  };

  const [treeWidth, setTreeWidth] = useState(initialNotesTreeWidth);
  const [isTreeResizing, setIsTreeResizing] = useState(false);
  const layoutRef = useRef(null);
  const resizeCleanupRef = useRef(null);

  // ── Back/forward page-navigation history ────────────────────────────────────
  const historyRef = useRef({ stack: [], index: -1 });
  const navLockRef  = useRef(false); // true while a back/forward jump is in flight
  const [navState, setNavState] = useState({ canBack: false, canForward: false });

  useEffect(() => {
    if (!activeUid) return;
    const h = historyRef.current;
    if (navLockRef.current) {
      navLockRef.current = false; // jump came from a back/forward button — don't re-record
    } else if (h.stack[h.index] !== activeUid) {
      h.stack = h.stack.slice(0, h.index + 1); // truncate any forward history
      h.stack.push(activeUid);
      h.index = h.stack.length - 1;
    }
    setNavState({ canBack: h.index > 0, canForward: h.index < h.stack.length - 1 });
  }, [activeUid]);

  const goBack = () => {
    const h = historyRef.current;
    if (h.index <= 0) return;
    h.index -= 1;
    navLockRef.current = true;
    onSelectNote(h.stack[h.index]);
  };
  const goForward = () => {
    const h = historyRef.current;
    if (h.index >= h.stack.length - 1) return;
    h.index += 1;
    navLockRef.current = true;
    onSelectNote(h.stack[h.index]);
  };

  const maxTreeWidth = () => {
    const layoutWidth = layoutRef.current?.getBoundingClientRect().width || NOTES_TREE_MAX + NOTES_CANVAS_MIN;
    return Math.max(NOTES_TREE_MIN, Math.min(NOTES_TREE_MAX, layoutWidth - NOTES_CANVAS_MIN));
  };

  useEffect(() => {
    try { localStorage.setItem(NOTES_TREE_WIDTH_KEY, String(Math.round(treeWidth))); } catch { /* storage unavailable */ }
  }, [treeWidth]);

  useEffect(() => {
    const layout = layoutRef.current;
    if (!layout || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => {
      setTreeWidth((width) => clampNotesTreeWidth(width, maxTreeWidth()));
    });
    observer.observe(layout);
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => resizeCleanupRef.current?.(), []);

  const startTreeResize = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    resizeCleanupRef.current?.();
    setIsTreeResizing(true);

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (moveEvent) => {
      const rect = layoutRef.current?.getBoundingClientRect();
      if (!rect) return;
      setTreeWidth(clampNotesTreeWidth(moveEvent.clientX - rect.left, maxTreeWidth()));
    };
    const cleanup = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onEnd);
      document.removeEventListener('pointercancel', onEnd);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      resizeCleanupRef.current = null;
    };
    const onEnd = () => {
      cleanup();
      setIsTreeResizing(false);
    };

    resizeCleanupRef.current = cleanup;
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onEnd);
    document.addEventListener('pointercancel', onEnd);
  };

  const resizeTreeWithKeyboard = (event) => {
    let nextWidth;
    if (event.key === 'ArrowLeft') nextWidth = treeWidth - 16;
    if (event.key === 'ArrowRight') nextWidth = treeWidth + 16;
    if (event.key === 'Home') nextWidth = NOTES_TREE_MIN;
    if (event.key === 'End') nextWidth = maxTreeWidth();
    if (nextWidth === undefined) return;
    event.preventDefault();
    setTreeWidth(clampNotesTreeWidth(nextWidth, maxTreeWidth()));
  };

  // Notion-style: a workspace always has a page — land straight in a new one.
  const autoCreatedRef = useRef(false);
  useEffect(() => {
    if (notes.length === 0 && !autoCreatedRef.current) {
      autoCreatedRef.current = true;
      onCreateNote(null);
    } else if (notes.length > 0) {
      autoCreatedRef.current = false;
    }
  }, [notes.length, onCreateNote]);

  const onToggle = (uid, forceOpen) => setCollapsed((prev) => {
    const next = new Set(prev);
    if (forceOpen) next.delete(uid);
    else if (next.has(uid)) next.delete(uid);
    else next.add(uid);
    return next;
  });

  const openPageContextMenu = (event, note, hasKids, isCollapsed) => {
    event.preventDefault();
    event.stopPropagation();
    const items = [
      { label: 'Open page', onClick: () => onSelectNote(note.uid) },
      { label: 'Rename', onClick: () => setEditingUid(note.uid) },
      { label: 'New sub-page', onClick: () => { onToggle(note.uid, true); onCreateNote(note.uid, true); } },
    ];
    if (!note.parentUid) {
      items.splice(2, 0, {
        label: 'Change icon and colour…',
        onClick: () => setIconPicker({ uid: note.uid, anchor: { x: event.clientX, y: event.clientY } }),
      });
    }
    if (hasKids) {
      items.push({ label: isCollapsed ? 'Expand sub-pages' : 'Collapse sub-pages', onClick: () => onToggle(note.uid) });
    }
    items.push({ divider: true });
    items.push({ label: 'Delete page', danger: true, onClick: () => onDeleteNote(note.uid) });
    setPageContextMenu({ x: event.clientX, y: event.clientY, items });
  };

  return (
    <div ref={layoutRef} className="notes-layout">
      <aside className="notes-tree-panel" style={{ width: treeWidth }}>
        <div className="notes-tree__head">
          <span>Notebooks</span>
          <div className="notes-tree__head-actions">
            <button type="button" onClick={undoMove} disabled={!history.canUndo} title="Undo move (⌘Z)" aria-label="Undo move"><VscDiscard /></button>
            <button type="button" onClick={redoMove} disabled={!history.canRedo} title="Redo move (⌘⇧Z)" aria-label="Redo move"><VscRedo /></button>
            <button type="button" onClick={() => onCreateNote(null, true)} title="New notebook" aria-label="New notebook"><VscAdd /></button>
          </div>
        </div>
        <div className="notes-tree__scroll">
          {notes.length === 0 ? (
            <div className="notes-tree__empty">No pages yet</div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              modifiers={[restrictToFirstScrollableAncestor]}
              onDragStart={({ active, activatorEvent }) => {
                setActiveId(active.id);
                const x = activatorEvent && 'clientX' in activatorEvent ? activatorEvent.clientX : 0;
                dragStartXRef.current = x;
                dragXRef.current = x;
              }}
              onDragMove={onDragMove}
              onDragEnd={onDragEnd}
              onDragCancel={resetDrag}
            >
              <SortableContext items={sortableUids} strategy={verticalListSortingStrategy}>
                {flattenedTrimmed.map((item) => (
                  <Fragment key={item.uid}>
                    {dropTarget && dropTarget.overUid === item.uid && dropTarget.mode === 'before' && (
                      <div className="notes-tree__drop-line" style={{ marginLeft: 6 + item.depth * INDENT_WIDTH }} />
                    )}
                    <SortableNoteRow
                      item={item}
                      activeUid={activeUid}
                      isDropInto={!!dropTarget && dropTarget.overUid === item.uid && dropTarget.mode === 'inside'}
                      isDropOutOf={!!dropTarget && dropTarget.mode === 'outdent' && dropTarget.outOfUid === item.uid}
                      isCollapsed={collapsed.has(item.uid)}
                      editingUid={editingUid}
                      onSelect={onSelectNote}
                      onToggle={onToggle}
                      onCreate={onCreateNote}
                      onDelete={onDeleteNote}
                      onOpenMenu={openPageContextMenu}
                      onOpenIconPicker={openNotebookIconPicker}
                      onStartRename={setEditingUid}
                      onRename={renameNote}
                    />
                    {dropTarget && dropTarget.overUid === item.uid && dropTarget.mode === 'after' && (
                      <div className="notes-tree__drop-line" style={{ marginLeft: 6 + item.depth * INDENT_WIDTH }} />
                    )}
                  </Fragment>
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>
      </aside>

      <div
        className={`notes-tree-resizer${isTreeResizing ? ' is-resizing' : ''}`}
        role="separator"
        aria-label="Resize notes sidebar"
        aria-orientation="vertical"
        aria-valuemin={NOTES_TREE_MIN}
        aria-valuemax={NOTES_TREE_MAX}
        aria-valuenow={Math.round(treeWidth)}
        aria-controls="notes-canvas-pane"
        tabIndex={0}
        title="Drag to resize the notes sidebar"
        onPointerDown={startTreeResize}
        onKeyDown={resizeTreeWithKeyboard}
      />

      <div id="notes-canvas-pane" className="notes-canvas-wrap">
        {activeCard && activeIndex >= 0 ? (
          <NoteCanvas
            index={activeIndex}
            card={activeCard}
            notes={notes}
            updateCardNote={updateCardNote}
            updateCards={updateCards}
            onCreateChild={onCreateNote}
            onNavigate={onSelectNote}
            onSendListToBoard={onSendListToBoard}
            onBack={goBack}
            onForward={goForward}
            canBack={navState.canBack}
            canForward={navState.canForward}
          />
        ) : (
          <div className="notes-canvas-empty">Creating a new page…</div>
        )}
      </div>
      {pageContextMenu && (
        <ContextMenu x={pageContextMenu.x} y={pageContextMenu.y}
          items={pageContextMenu.items} onClose={() => setPageContextMenu(null)} />
      )}
      {iconPicker && (() => {
        const notebook = notes.find((note) => note.uid === iconPicker.uid && !note.parentUid);
        return notebook ? (
          <NotebookIconPicker
            note={notebook}
            anchor={iconPicker.anchor}
            onUpdate={(patch) => updateNotebookAppearance(notebook.uid, patch)}
            onClose={() => setIconPicker(null)}
          />
        ) : null;
      })()}
      {pendingMove && (
        <MoveNoteConfirmModal
          title={pendingMove.draggedTitle}
          destinationTitle={pendingMove.newParentTitle}
          onConfirm={confirmPendingMove}
          onCancel={() => setPendingMove(null)}
        />
      )}
    </div>
  );
}

export default NotesView;

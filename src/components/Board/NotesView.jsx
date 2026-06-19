import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { VscAdd, VscTrash, VscChevronRight, VscFile, VscChromeMaximize, VscChromeRestore } from 'react-icons/vsc';
import { markdownToHtml, isHtml, htmlToText } from '../../utils/htmlEditor';
import { useSettings } from '../../contexts/SettingsContext';

// TipTap pulls in ProseMirror + lowlight — load it only when Notes is opened.
const NoteEditor = lazy(() => import('./NoteEditor'));

function relativeTime(ts) {
  if (!ts) return '';
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60)     return 'just now';
  if (diff < 3600)   return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)} hr ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} day${Math.floor(diff / 86400) > 1 ? 's' : ''} ago`;
  return new Date(ts).toLocaleDateString();
}

// ── Recursive page tree ─────────────────────────────────────────────────────
function NoteTree({ notes, parentUid, depth, activeUid, collapsed, onToggle, onSelect, onCreate, onDelete }) {
  const items = notes.filter((n) => (n.parentUid || null) === parentUid);
  return items.map((n) => {
    const hasKids = notes.some((c) => (c.parentUid || null) === n.uid);
    const isCollapsed = collapsed.has(n.uid);
    return (
      <div key={n.uid}>
        <div
          className={`notes-tree__row${n.uid === activeUid ? ' is-active' : ''}`}
          style={{ paddingLeft: 6 + depth * 14 }}
          onClick={() => onSelect(n.uid)}
        >
          <button
            type="button"
            className="notes-tree__caret"
            style={{ visibility: hasKids ? 'visible' : 'hidden' }}
            onClick={(e) => { e.stopPropagation(); onToggle(n.uid); }}
            tabIndex={-1}
            aria-label={isCollapsed ? 'Expand' : 'Collapse'}
          >
            <VscChevronRight style={{ transform: isCollapsed ? 'none' : 'rotate(90deg)', transition: 'transform 0.12s' }} />
          </button>
          <VscFile className="notes-tree__icon" />
          <span className="notes-tree__title">{n.title?.trim() || 'Untitled'}</span>
          <span className="notes-tree__actions">
            <button type="button" onClick={(e) => { e.stopPropagation(); onToggle(n.uid, true); onCreate(n.uid, true); }} title="Add sub-page"><VscAdd /></button>
            <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(n.uid); }} title="Delete page"><VscTrash /></button>
          </span>
        </div>
        {hasKids && !isCollapsed && (
          <NoteTree
            notes={notes} parentUid={n.uid} depth={depth + 1} activeUid={activeUid}
            collapsed={collapsed} onToggle={onToggle} onSelect={onSelect} onCreate={onCreate} onDelete={onDelete}
          />
        )}
      </div>
    );
  });
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
function NoteCanvas({ index, card, notes, updateCardNote, updateCards, onCreateChild, onNavigate }) {
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
  const charCount = htmlToText(safeNote.content || '').length;

  return (
    <div
      key={card.uid}
      className={paperless ? 'note-canvas' : 'note-canvas note-paper'}
      style={{ maxWidth: paperless ? '100%' : 860, margin: '0 auto', padding: paperless ? '1.25rem 1rem 2.5rem' : '2rem 2.25rem 2.5rem' }}
    >
      <PageTitle value={card.title} onChange={handleTitle} />

      <div style={{ fontSize: '0.7rem', color: 'var(--theme-text-muted)', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>
          {safeNote.updatedAt && `Edited ${relativeTime(safeNote.updatedAt)}`}
          {charCount > 0 && <span> · {charCount} character{charCount === 1 ? '' : 's'}</span>}
        </span>
        <button
          type="button"
          onClick={togglePaperless}
          title={paperless ? 'Switch to paper view' : 'Switch to wide view'}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'transparent', border: '1px solid var(--theme-border)', borderRadius: 999, color: 'var(--theme-text-muted)', cursor: 'pointer', fontSize: '0.7rem', padding: '2px 8px' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--theme-text-primary)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--theme-text-muted)'; }}
        >
          {paperless ? <><VscChromeRestore /> Paper</> : <><VscChromeMaximize /> Wide</>}
        </button>
      </div>

      <Suspense fallback={<div style={{ padding: '2rem 0', color: 'var(--theme-text-muted)', fontSize: '0.85rem' }}>Loading editor…</div>}>
        <NoteEditor
          key={card.uid}
          content={initialContent}
          onChange={handleContent}
          paperless={paperless}
          notes={notes}
          onCreatePage={() => ({ uid: onCreateChild(card.uid, false), title: 'New page' })}
          onNavigatePage={onNavigate}
          placeholder="Type ‘/’ for commands, or just start writing. Markdown shortcuts and drag-and-drop images work too."
        />
      </Suspense>
    </div>
  );
}

// ── Main view (tree + canvas) ───────────────────────────────────────────────
function NotesView({ allCards, notes, activeUid, onSelectNote, onCreateNote, onDeleteNote, updateCardNote, updateCards }) {
  const activeCard = notes.find((n) => n.uid === activeUid) || null;
  const activeIndex = activeCard ? allCards.findIndex((c) => c.uid === activeCard.uid) : -1;
  const [collapsed, setCollapsed] = useState(() => new Set());

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

  return (
    <div className="notes-layout">
      <aside className="notes-tree-panel">
        <div className="notes-tree__head">
          <span>Pages</span>
          <button type="button" onClick={() => onCreateNote(null, true)} title="New page" aria-label="New page"><VscAdd /></button>
        </div>
        <div className="notes-tree__scroll">
          {notes.length === 0 ? (
            <div className="notes-tree__empty">No pages yet</div>
          ) : (
            <NoteTree
              notes={notes} parentUid={null} depth={0} activeUid={activeUid}
              collapsed={collapsed} onToggle={onToggle} onSelect={onSelectNote}
              onCreate={onCreateNote} onDelete={onDeleteNote}
            />
          )}
        </div>
      </aside>

      <div className="notes-canvas-wrap">
        {activeCard && activeIndex >= 0 ? (
          <NoteCanvas
            index={activeIndex}
            card={activeCard}
            notes={notes}
            updateCardNote={updateCardNote}
            updateCards={updateCards}
            onCreateChild={onCreateNote}
            onNavigate={onSelectNote}
          />
        ) : (
          <div className="notes-canvas-empty">Creating a new page…</div>
        )}
      </div>
    </div>
  );
}

export default NotesView;

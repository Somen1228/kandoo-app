import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { VscAdd, VscClose, VscChromeMaximize, VscChromeRestore } from 'react-icons/vsc';
import RichEditor from './RichEditor';
import ImageModal from './ImageModal';
import {
  NoteToolbar,
  ImageStrip,
  compressImage,
  applyHighlighting,
} from './NoteCard';
import { sanitizeHtml, markdownToHtml, isHtml, htmlToText } from '../../utils/htmlEditor';

// "edited X ago" formatter (local copy — NoteCard has the same)
function relativeTime(ts) {
  if (!ts) return '';
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60)     return 'just now';
  if (diff < 3600)   return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)} hr ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} day${Math.floor(diff / 86400) > 1 ? 's' : ''} ago`;
  return new Date(ts).toLocaleDateString();
}

// ── Tabs strip ──────────────────────────────────────────────────────────────
function NotesTabs({ notes, activeUid, onSelect, onAdd, onDelete }) {
  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 4,
        borderBottom: '1px solid var(--theme-border)',
        marginBottom: '0.5rem',
        paddingBottom: 2,
      }}
    >
      {notes.map((n) => {
        const isActive = n.uid === activeUid;
        const label = n.title?.trim() || 'Untitled';
        return (
          <div
            key={n.uid}
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(n.uid)}
            title={label}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: '0.375rem',
              fontSize: '0.78rem',
              fontWeight: isActive ? 600 : 500,
              color: isActive ? 'var(--theme-text-primary)' : 'var(--theme-text-muted)',
              background: isActive ? 'var(--theme-bg-hover)' : 'transparent',
              border: '1px solid',
              borderColor: isActive ? 'var(--theme-border)' : 'transparent',
              cursor: 'pointer',
              maxWidth: 200,
              userSelect: 'none',
            }}
            onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--theme-bg-hover)'; }}
            onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {label}
            </span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(n.uid); }}
              title="Delete note"
              style={{
                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                color: 'var(--theme-text-muted)', display: 'flex', alignItems: 'center',
                fontSize: '0.85rem', opacity: 0.55,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = 1; e.currentTarget.style.color = 'var(--theme-danger)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = 0.55; e.currentTarget.style.color = 'var(--theme-text-muted)'; }}
            >
              <VscClose />
            </button>
          </div>
        );
      })}
      <button
        type="button"
        onClick={onAdd}
        title="New note"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '4px 10px',
          borderRadius: '0.375rem',
          background: 'transparent',
          color: 'var(--theme-text-muted)',
          border: '1px dashed var(--theme-border)',
          cursor: 'pointer',
          fontSize: '0.78rem',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--theme-accent)'; e.currentTarget.style.borderColor = 'var(--theme-accent)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--theme-text-muted)'; e.currentTarget.style.borderColor = 'var(--theme-border)'; }}
      >
        <VscAdd /> New
      </button>
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
        style={{
          fontSize: '1.9rem',
          fontWeight: 700,
          background: 'transparent',
          border: 'none',
          color: 'var(--theme-text-primary)',
          width: '100%',
          padding: 0,
          margin: '0 0 0.5rem 0',
          outline: 'none',
          fontFamily: 'inherit',
        }}
      />
    );
  }

  return (
    <h1
      onClick={() => setEditing(true)}
      title="Click to rename"
      style={{
        fontSize: '1.9rem',
        fontWeight: 700,
        color: 'var(--theme-text-primary)',
        margin: '0 0 0.5rem 0',
        cursor: 'text',
        lineHeight: 1.2,
        userSelect: 'none',
      }}
    >
      {value?.trim() || <span style={{ color: 'var(--theme-text-muted)', fontStyle: 'italic', fontWeight: 500 }}>Untitled</span>}
    </h1>
  );
}

// ── Active-note canvas (Minimal page) ──────────────────────────
function NoteCanvas({ index, card, updateCardNote, updateCards }) {
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const [viewing, setViewing] = useState(null);
  // Layout preference — persisted in localStorage so it sticks across notes/sessions
  const [paperless, setPaperless] = useState(() => {
    try { return localStorage.getItem('note_paperless') === '1'; } catch { return false; }
  });
  const togglePaperless = () => {
    setPaperless((p) => {
      const next = !p;
      try { localStorage.setItem('note_paperless', next ? '1' : '0'); } catch { /* quota */ }
      return next;
    });
  };
  const safeNote = card.note || { content: '', images: [], updatedAt: Date.now() };

  // Highlight code blocks on (re)mount and when switching active note
  useEffect(() => {
    const id = setTimeout(() => applyHighlighting(editorRef.current?.getElement()), 50);
    return () => clearTimeout(id);
  }, [card.uid]);

  const handleContent = (html) => {
    updateCardNote(index, { ...safeNote, content: sanitizeHtml(html), images: safeNote.images || [] });
  };
  const handleImages = (images) => {
    updateCardNote(index, { ...safeNote, images });
  };
  const handleTitle = (newTitle) => {
    updateCards((cards) => cards.map((c) => (c.uid === card.uid ? { ...c, title: newTitle } : c)));
  };

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    const out = [];
    for (const f of files) {
      try { out.push(await compressImage(f)); }
      catch (err) { toast.error(`${f.name}: ${err.message}`); }
    }
    if (out.length) handleImages([...(safeNote.images || []), ...out]);
    editorRef.current?.focus();
  };

  const initialHtml = isHtml(safeNote.content) ? safeNote.content : markdownToHtml(safeNote.content || '');
  const charCount = htmlToText(safeNote.content || '').length;

  return (
    <div
      key={card.uid}
      className={paperless ? '' : 'note-paper'}
      style={{
        maxWidth: paperless ? '100%' : 880,
        margin: '0 auto',
        padding: paperless ? '1.5rem 1.5rem 2.5rem' : '2rem 2.25rem 2.5rem',
      }}
    >
      <PageTitle value={card.title} onChange={handleTitle} />

      <div style={{
        fontSize: '0.7rem', color: 'var(--theme-text-muted)', marginBottom: '0.75rem',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>
          {safeNote.updatedAt && `Edited ${relativeTime(safeNote.updatedAt)}`}
          {charCount > 0 && <span> · {charCount} character{charCount === 1 ? '' : 's'}</span>}
        </span>
        <button
          type="button"
          onClick={togglePaperless}
          title={paperless ? 'Switch to paper view' : 'Switch to wide / paperless view'}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: 'transparent',
            border: '1px solid var(--theme-border)',
            borderRadius: 999,
            color: 'var(--theme-text-muted)',
            cursor: 'pointer',
            fontSize: '0.7rem',
            padding: '2px 8px',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--theme-text-primary)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--theme-text-muted)'; }}
        >
          {paperless ? <><VscChromeRestore /> Paper</> : <><VscChromeMaximize /> Wide</>}
        </button>
      </div>

      <NoteToolbar editorRef={editorRef} onUploadClick={() => fileInputRef.current?.click()} />

      <RichEditor
        ref={editorRef}
        initialHtml={initialHtml}
        onChange={handleContent}
        onBlur={() => applyHighlighting(editorRef.current?.getElement())}
        placeholder="Start writing — Enter for a new paragraph, ⌘B / ⌘I / ⌘U to format. Paste markdown and it'll convert automatically."
        markdownPaste
        style={{
          minHeight: '50vh',
          fontSize: '0.95rem',
          lineHeight: 1.65,
          color: 'var(--theme-text-primary)',
          padding: '0.25rem 0',
        }}
      />

      <ImageStrip
        images={safeNote.images}
        thumbSize={92}
        onRemove={(i) => handleImages(safeNote.images.filter((_, idx) => idx !== i))}
        onView={(i) => setViewing(i)}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={handleUpload}
      />

      {viewing !== null && createPortal(
        <ImageModal images={safeNote.images} initialIndex={viewing} onClose={() => setViewing(null)} />,
        document.body
      )}
    </div>
  );
}

// ── Main view ───────────────────────────────────────────────────────────────
function NotesView({
  allCards, notes, activeUid, onSelectNote, onAddNote, onDeleteNote,
  updateCardNote, updateCards,
}) {
  const activeCard = notes.find((n) => n.uid === activeUid) || null;
  const activeIndex = activeCard ? allCards.findIndex((c) => c.uid === activeCard.uid) : -1;

  return (
    <div className="pl-10 pr-4" style={{ minHeight: '60vh' }}>
      <NotesTabs
        notes={notes}
        activeUid={activeUid}
        onSelect={onSelectNote}
        onAdd={onAddNote}
        onDelete={onDeleteNote}
      />

      {!activeCard ? (
        <div className="text-center py-12" style={{ color: 'var(--theme-text-muted)' }}>
          <p style={{ fontSize: '0.9rem' }}>No notes yet.</p>
          <button
            onClick={onAddNote}
            className="mt-3 px-4 py-1.5 rounded-md text-sm"
            style={{ background: 'var(--theme-accent)', color: 'white', border: 'none', cursor: 'pointer' }}
          >
            + Create your first note
          </button>
        </div>
      ) : activeIndex >= 0 ? (
        <NoteCanvas
          index={activeIndex}
          card={activeCard}
          updateCardNote={updateCardNote}
          updateCards={updateCards}
        />
      ) : null}
    </div>
  );
}

export default NotesView;

import { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import {
  VscBold, VscItalic, VscClose,
  VscScreenFull, VscListUnordered, VscListOrdered, VscCode,
  VscClearAll, VscLink, VscHorizontalRule, VscQuote,
} from 'react-icons/vsc';
import {
  RiUnderline, RiStrikethrough, RiSuperscript, RiSubscript,
  RiAlignLeft, RiAlignCenter, RiAlignRight, RiAlignJustify,
  RiIndentIncrease, RiIndentDecrease,
  RiFontColor, RiMarkPenLine, RiCodeSSlashLine,
} from 'react-icons/ri';
import { IoImageOutline } from 'react-icons/io5';
import RichEditor from './RichEditor';
import ImageModal from './ImageModal';
import { sanitizeHtml, isHtml, markdownToHtml, htmlToText } from '../../utils/htmlEditor';

// ── Shared image compression util (mirrored from Card.jsx) ─────────────────
export const compressImage = (file) =>
  new Promise((resolve, reject) => {
    if (file.size > 10 * 1024 * 1024) { reject(new Error('Image must be smaller than 10 MB')); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.onload = ({ target: { result } }) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Not a valid image'));
      img.onload = () => {
        const MAX = 1200;
        const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(img.width  * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  });

// ── Code block insertion + lazy-loaded syntax highlighting ──────────────────

// Lazy-load highlight.js (~30KB gz). Only fetched when a note actually has
// or gains a code block.
let hljsPromise = null;
function loadHljs() {
  if (!hljsPromise) hljsPromise = import('highlight.js').then((m) => m.default);
  return hljsPromise;
}

function insertCodeBlock(editorRef) {
  // Insert a code block and a trailing paragraph so the cursor can escape it.
  // Browsers handle the cursor placement inside the inserted <code> element.
  const html =
    '<pre><code class="language-text">// type your code here</code></pre><p><br></p>';
  editorRef.current?.exec('insertHTML', html);
}

// Iterate <pre><code> blocks in the editor DOM and run hljs.highlightAuto.
// Skips re-highlighting blocks that already match their current text + lang.
export async function applyHighlighting(editorEl) {
  if (!editorEl) return;
  const codes = editorEl.querySelectorAll('pre > code');
  if (codes.length === 0) return;
  const hljs = await loadHljs();
  codes.forEach((code) => {
    // Reset to plain text so we re-detect cleanly (strips previous spans)
    const text = code.textContent;
    code.textContent = text;
    code.className = '';
    try {
      hljs.highlightElement(code);
    } catch {
      // ignore — keep plain text
    }
    const cls = code.className || '';
    const lang = (cls.match(/language-(\S+)/)?.[1]) || 'text';
    if (code.parentElement) code.parentElement.dataset.lang = lang;
  });
}

// ── Toolbar shared by inline and expanded views ─────────────────────────────
export function NoteToolbar({ editorRef, onUploadClick, compact = false }) {
  const apply = (cmd, value) => editorRef.current?.exec(cmd, value);
  const mod = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform) ? '⌘' : 'Ctrl';
  const textColorRef = useRef(null);
  const hiliteColorRef = useRef(null);

  const btnStyle = {
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: '0.25rem',
    color: 'var(--theme-text-secondary)',
    cursor: 'pointer',
    padding: compact ? '2px 5px' : '4px 7px',
    fontSize: compact ? '0.8rem' : '0.95rem',
    display: 'flex', alignItems: 'center', gap: 2,
    transition: 'background 0.12s',
  };
  const hover = (e) => { e.currentTarget.style.background = 'var(--theme-bg-hover)'; };
  const leave = (e) => { e.currentTarget.style.background = 'transparent'; };
  const Divider = () => (
    <span style={{ width: 1, background: 'var(--theme-border)', margin: '2px 4px', alignSelf: 'stretch' }} />
  );

  const Btn = ({ title, onClick, children }) => (
    <button type="button" style={btnStyle} title={title}
      onMouseEnter={hover} onMouseLeave={leave}
      onClick={onClick}>
      {children}
    </button>
  );

  const promptLink = () => {
    const sel = window.getSelection();
    const initial = sel?.toString()?.match(/^https?:\/\//i) ? sel.toString() : 'https://';
    const url = window.prompt('Link URL:', initial);
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      // require http(s) to keep sanitizer happy
      window.alert('Link must start with http:// or https://');
      return;
    }
    apply('createLink', url);
  };

  const onHeadingChange = (e) => {
    const v = e.target.value;
    e.target.value = ''; // reset so user can re-pick the same option
    if (v) apply('formatBlock', v);
  };

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: '2px', alignItems: 'center',
      borderBottom: '1px solid var(--theme-border)', paddingBottom: '4px', marginBottom: '6px',
    }}
      onMouseDown={(e) => e.preventDefault()}>
      {/* Heading selector */}
      <select
        defaultValue=""
        onChange={onHeadingChange}
        title="Heading"
        style={{
          background: 'var(--theme-bg-input)', color: 'var(--theme-text-primary)',
          border: '1px solid var(--theme-border)', borderRadius: 4,
          fontSize: compact ? '0.72rem' : '0.78rem', padding: '2px 4px',
          cursor: 'pointer', marginRight: 2,
        }}
      >
        <option value="" disabled>Style</option>
        <option value="P">Normal</option>
        <option value="H1">Heading 1</option>
        <option value="H2">Heading 2</option>
        <option value="H3">Heading 3</option>
        <option value="H4">Heading 4</option>
        <option value="H5">Heading 5</option>
        <option value="H6">Heading 6</option>
      </select>

      <Divider />

      {/* Inline text */}
      <Btn title={`Bold (${mod}+B)`}        onClick={() => apply('bold')}><VscBold /></Btn>
      <Btn title={`Italic (${mod}+I)`}      onClick={() => apply('italic')}><VscItalic /></Btn>
      <Btn title={`Underline (${mod}+U)`}   onClick={() => apply('underline')}><RiUnderline /></Btn>
      <Btn title="Strikethrough"            onClick={() => apply('strikeThrough')}><RiStrikethrough /></Btn>
      <Btn title="Superscript"              onClick={() => apply('superscript')}><RiSuperscript /></Btn>
      <Btn title="Subscript"                onClick={() => apply('subscript')}><RiSubscript /></Btn>
      <Btn title="Inline code"              onClick={() => apply('inlineCode')}><RiCodeSSlashLine /></Btn>
      <Btn title="Clear formatting"         onClick={() => apply('clearFormatting')}><VscClearAll /></Btn>

      <Divider />

      {/* Color + Highlight (custom only via native picker) */}
      <Btn title="Text colour" onClick={() => textColorRef.current?.click()}>
        <RiFontColor />
      </Btn>
      <input ref={textColorRef} type="color" defaultValue="#000000"
        onChange={(e) => apply('foreColor', e.target.value)}
        onMouseDown={(e) => e.stopPropagation()}
        style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }} />
      <Btn title="Highlight colour" onClick={() => hiliteColorRef.current?.click()}>
        <RiMarkPenLine />
      </Btn>
      <input ref={hiliteColorRef} type="color" defaultValue="#fff59d"
        onChange={(e) => {
          // hiliteColor in Firefox uses backColor; try hiliteColor first then fall back
          if (!document.execCommand('hiliteColor', false, e.target.value)) {
            apply('backColor', e.target.value);
          } else {
            apply('hiliteColor', e.target.value);
          }
        }}
        onMouseDown={(e) => e.stopPropagation()}
        style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }} />

      <Divider />

      {/* Lists */}
      <Btn title="Bullet list"   onClick={() => apply('insertUnorderedList')}><VscListUnordered /></Btn>
      <Btn title="Numbered list" onClick={() => apply('insertOrderedList')}><VscListOrdered /></Btn>

      <Divider />

      {/* Alignment */}
      <Btn title="Align left"    onClick={() => apply('justifyLeft')}><RiAlignLeft /></Btn>
      <Btn title="Align center"  onClick={() => apply('justifyCenter')}><RiAlignCenter /></Btn>
      <Btn title="Align right"   onClick={() => apply('justifyRight')}><RiAlignRight /></Btn>
      <Btn title="Justify"       onClick={() => apply('justifyFull')}><RiAlignJustify /></Btn>

      <Divider />

      {/* Indent */}
      <Btn title="Decrease indent" onClick={() => apply('outdent')}><RiIndentDecrease /></Btn>
      <Btn title="Increase indent" onClick={() => apply('indent')}><RiIndentIncrease /></Btn>

      <Divider />

      {/* Insert blocks */}
      <Btn title="Quote"                onClick={() => apply('formatBlock', 'BLOCKQUOTE')}><VscQuote /></Btn>
      <Btn title="Code block (auto language)" onClick={() => insertCodeBlock(editorRef)}><VscCode /></Btn>
      <Btn title="Horizontal rule"      onClick={() => apply('insertHorizontalRule')}><VscHorizontalRule /></Btn>
      <Btn title={`Hyperlink (${mod}+K)`} onClick={promptLink}><VscLink /></Btn>

      {onUploadClick && (
        <>
          <Divider />
          <Btn title="Add image" onClick={onUploadClick}><IoImageOutline /></Btn>
        </>
      )}
    </div>
  );
}

// ── Image strip (used inline + in expanded view) ────────────────────────────
export function ImageStrip({ images, onRemove, onView, thumbSize = 64 }) {
  if (!images || images.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px', justifyContent: 'flex-start' }}>
      {images.map((src, i) => (
        <div key={i} style={{ position: 'relative' }}>
          <img
            src={src}
            alt={`img-${i}`}
            onClick={(e) => { e.stopPropagation(); onView?.(i); }}
            style={{
              width: thumbSize, height: thumbSize,
              objectFit: 'cover', borderRadius: 4,
              border: '1px solid var(--theme-border)',
              cursor: onView ? 'pointer' : 'default', flexShrink: 0,
            }}
          />
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(i)}
              style={{
                position: 'absolute', top: -6, right: -6,
                background: 'var(--theme-danger)', border: 'none', borderRadius: '50%',
                color: 'white', width: 16, height: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', fontSize: 10, padding: 0,
              }}
            >
              <VscClose />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// "edited X ago" formatter
function relativeTime(ts) {
  if (!ts) return '';
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60)       return 'just now';
  if (diff < 3600)     return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400)    return `${Math.floor(diff / 3600)} hr ago`;
  if (diff < 604800)   return `${Math.floor(diff / 86400)} day${Math.floor(diff / 86400) > 1 ? 's' : ''} ago`;
  return new Date(ts).toLocaleDateString();
}

// ── Expanded (fullscreen) view ──────────────────────────────────────────────
function NoteExpandModal({ title, note, onChangeContent, onChangeImages, onClose }) {
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const [viewing, setViewing] = useState(null);
  const [tick, setTick] = useState(0); // re-render every minute so "edited X ago" stays fresh
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Apply syntax highlighting once the editor mounts inside the modal
  useEffect(() => {
    const id = setTimeout(() => applyHighlighting(editorRef.current?.getElement()), 50);
    return () => clearTimeout(id);
  }, []);

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    const out = [];
    for (const f of files) {
      try { out.push(await compressImage(f)); }
      catch (err) { toast.error(`${f.name}: ${err.message}`); }
    }
    if (out.length) onChangeImages([...(note.images || []), ...out]);
    editorRef.current?.focus();
  };

  const initialHtml = isHtml(note.content) ? note.content : markdownToHtml(note.content || '');

  return createPortal(
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1500,
        background: 'rgba(0,0,0,0.35)',
        backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <div style={{
        background: 'var(--theme-bg-primary)',
        border: '1px solid var(--theme-border)',
        borderRadius: '0.75rem',
        width: '100%', maxWidth: '1200px', height: '92vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '0.75rem 1rem',
          borderBottom: '1px solid var(--theme-border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--theme-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {title || 'Untitled note'}
            </h2>
            <span style={{ fontSize: '0.7rem', color: 'var(--theme-text-muted)' }}>
              {note.updatedAt && `edited ${relativeTime(note.updatedAt)}`}
              {tick >= 0 ? '' : ''}
            </span>
          </div>
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-text-secondary)', fontSize: '1.2rem', display: 'flex' }}>
            <VscClose />
          </button>
        </div>

        {/* Toolbar + editor + images */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem' }}>
          <NoteToolbar editorRef={editorRef} onUploadClick={() => fileInputRef.current?.click()} />
          <RichEditor
            ref={editorRef}
            initialHtml={initialHtml}
            onChange={(html) => onChangeContent(sanitizeHtml(html))}
            onBlur={() => applyHighlighting(editorRef.current?.getElement())}
            placeholder="Start typing your note…"
            autoFocus
            style={{
              minHeight: '50vh',
              padding: '4px 2px',
              fontSize: '0.95rem',
              lineHeight: 1.6,
              color: 'var(--theme-text-primary)',
            }}
          />
          <ImageStrip
            images={note.images}
            thumbSize={92}
            onRemove={(i) => onChangeImages(note.images.filter((_, idx) => idx !== i))}
            onView={(i) => setViewing(i)}
          />
        </div>

        {/* Footer */}
        <div style={{
          padding: '0.5rem 1rem', borderTop: '1px solid var(--theme-border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontSize: '0.72rem', color: 'var(--theme-text-muted)',
        }}>
          <span>{htmlToText(note.content || '').length} characters · autosaves</span>
          <span>Esc to close</span>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={handleUpload}
        />
      </div>

      {viewing !== null && (
        <ImageModal images={note.images} initialIndex={viewing} onClose={() => setViewing(null)} />
      )}
    </div>,
    document.body
  );
}

// ── Inline note body (renders inside the existing card frame) ───────────────
function NoteCard({ index, note, updateCardNote, title, cardColor: _cardColor }) {
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [viewing, setViewing] = useState(null);
  const safeNote = note || { content: '', images: [], updatedAt: Date.now() };

  // Inline editor is keyed by `expanded` so it remounts (picks up fresh content)
  // whenever the fullscreen view closes.
  const editorKey = expanded ? 'expanded' : 'inline';

  // Apply syntax highlighting once after (re)mount — covers reload and
  // returning from the fullscreen view with edited code blocks.
  useEffect(() => {
    if (expanded) return; // skip while modal is open
    const id = setTimeout(() => {
      applyHighlighting(editorRef.current?.getElement());
    }, 50); // wait for RichEditor's own useEffect that sets innerHTML
    return () => clearTimeout(id);
  }, [editorKey, expanded]);

  const handleContentChange = (html) => {
    updateCardNote(index, { ...safeNote, content: sanitizeHtml(html), images: safeNote.images || [] });
  };
  const handleImagesChange = (images) => {
    updateCardNote(index, { ...safeNote, images });
  };

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    const out = [];
    for (const f of files) {
      try { out.push(await compressImage(f)); }
      catch (err) { toast.error(`${f.name}: ${err.message}`); }
    }
    if (out.length) handleImagesChange([...(safeNote.images || []), ...out]);
    editorRef.current?.focus();
  };

  const initialHtml = isHtml(safeNote.content) ? safeNote.content : markdownToHtml(safeNote.content || '');

  return (
    <>
      {/* Body — replaces the task list in note-type cards */}
      <div style={{ padding: '0.5rem 0.6rem', display: 'flex', flexDirection: 'column' }}>
        {/* Toolbar + expand on the same row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <NoteToolbar
              editorRef={editorRef}
              onUploadClick={() => fileInputRef.current?.click()}
              compact
            />
          </div>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            title="Expand to fullscreen"
            style={{
              background: 'transparent', border: '1px solid var(--theme-border)',
              borderRadius: '0.25rem', cursor: 'pointer',
              padding: '4px 6px', display: 'flex', alignItems: 'center',
              color: 'var(--theme-text-secondary)',
              marginBottom: 6,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--theme-bg-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <VscScreenFull />
          </button>
        </div>

        {/* Editor — auto-grows, capped, then scrolls */}
        <div style={{ maxHeight: '24rem', overflowY: 'auto' }}>
          <RichEditor
            key={editorKey}
            ref={editorRef}
            initialHtml={initialHtml}
            onChange={handleContentChange}
            onBlur={() => applyHighlighting(editorRef.current?.getElement())}
            placeholder="Write a note…"
            style={{
              minHeight: '6rem',
              fontSize: '0.875rem',
              lineHeight: 1.5,
              color: 'var(--theme-text-primary)',
              padding: '2px 0',
            }}
          />
          <ImageStrip
            images={safeNote.images}
            onRemove={(i) => handleImagesChange(safeNote.images.filter((_, idx) => idx !== i))}
            onView={(i) => setViewing(i)}
          />
        </div>

        {/* Footer: last edited */}
        {safeNote.updatedAt && (
          <div style={{
            fontSize: '0.65rem', color: 'var(--theme-text-muted)',
            marginTop: 6, textAlign: 'right',
          }}>
            edited {relativeTime(safeNote.updatedAt)}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={handleUpload}
        />
      </div>

      {viewing !== null && createPortal(
        <ImageModal images={safeNote.images} initialIndex={viewing} onClose={() => setViewing(null)} />,
        document.body
      )}

      {expanded && (
        <NoteExpandModal
          title={title}
          note={safeNote}
          onChangeContent={(html) => updateCardNote(index, { ...safeNote, content: html })}
          onChangeImages={handleImagesChange}
          onClose={() => setExpanded(false)}
        />
      )}
    </>
  );
}

export default NoteCard;

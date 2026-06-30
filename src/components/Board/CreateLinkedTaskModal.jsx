import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  VscClose, VscNote, VscSearch, VscLink, VscBold, VscItalic,
  VscChevronDown, VscChevronUp,
} from 'react-icons/vsc';
import { RiUnderline } from 'react-icons/ri';
import { IoImageOutline } from 'react-icons/io5';
import RichEditor from './RichEditor.jsx';
import DatePicker from './DatePicker.jsx';
import PrioritySelector from './PrioritySelector.jsx';
import RecurrenceButton from './RecurrenceButton.jsx';
import SubtaskEditor from './SubtaskEditor.jsx';
import LabelPicker from './LabelPicker.jsx';
import { toast } from '../../utils/toast';
import { sanitizeHtml, htmlToText } from '../../utils/htmlEditor';
import { uploadImage, isStorageUrl, deleteImage } from '../../services/imageStorage';

export default function CreateLinkedTaskModal({
  open, notes = [], currentNoteUid, currentNoteTitle, onSubmit, onCancel,
}) {
  const [value, setValue] = useState('');
  const [images, setImages] = useState([]);
  const [due, setDue] = useState('');
  const [priority, setPriority] = useState(null);
  const [subtasks, setSubtasks] = useState([]);
  const [labels, setLabels] = useState([]);
  const [recurrence, setRecurrence] = useState(null);
  const [extraNoteUids, setExtraNoteUids] = useState(new Set());
  const [noteSearch, setNoteSearch] = useState('');
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [linkPopPos, setLinkPopPos] = useState(null); // { x, y } | null — portal coords
  const [linkUrl, setLinkUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  const editorRef = useRef(null);
  const fileRef = useRef(null);
  const linkUrlRef = useRef(null);
  const linkBtnRef = useRef(null);

  // Reset all state when modal opens
  useEffect(() => {
    if (!open) return;
    setValue('');
    setImages([]);
    setDue('');
    setPriority(null);
    setSubtasks([]);
    setLabels([]);
    setRecurrence(null);
    setExtraNoteUids(new Set());
    setNoteSearch('');
    setNotesExpanded(false);
    setLinkPopPos(null);
    setLinkUrl('');
    setUploading(false);
  }, [open]);

  // Close link popover on outside click (portal-safe: checks data attribute).
  // Using 'click' (not 'mousedown') so right-click → paste doesn't dismiss it.
  useEffect(() => {
    if (!linkPopPos) return;
    const handler = (e) => {
      if (e.target.closest?.('[data-ctm-link-pop]')) return;
      if (linkBtnRef.current?.contains(e.target)) return;
      setLinkPopPos(null);
    };
    const id = setTimeout(() => document.addEventListener('click', handler), 0);
    return () => { clearTimeout(id); document.removeEventListener('click', handler); };
  }, [linkPopPos]);

  const otherNotes = useMemo(() => {
    const term = noteSearch.trim().toLowerCase();
    const list = (notes || []).filter((n) => n.uid !== currentNoteUid);
    if (!term) return list;
    return list.filter((n) => (n.title || '').toLowerCase().includes(term));
  }, [notes, noteSearch, currentNoteUid]);

  if (!open) return null;

  const totalLinkedNotes = 1 + extraNoteUids.size;
  const allOtherNotes = (notes || []).filter((n) => n.uid !== currentNoteUid);

  const toggleNote = (uid) => {
    setExtraNoteUids((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      return next;
    });
  };

  const processUpload = async (files) => {
    setUploading(true);
    const toastId = files.length > 1
      ? toast.loading(`Uploading ${files.length} images…`)
      : toast.loading('Uploading image…');
    try {
      const results = await Promise.allSettled(files.map((f) => uploadImage(f)));
      const urls = [];
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') urls.push(r.value);
        else toast.error(`${files[i].name}: ${r.reason?.message || 'Upload failed'}`);
      });
      toast.dismiss(toastId);
      if (urls.length) setImages((prev) => [...prev, ...urls]);
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleImagePaste = async (files) => {
    await processUpload(Array.isArray(files) ? files : [files]);
    editorRef.current?.focus();
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length) await processUpload(files);
    editorRef.current?.focus();
  };

  const removeImage = (i) => {
    const url = images[i];
    if (isStorageUrl(url)) deleteImage(url);
    setImages((prev) => prev.filter((_, idx) => idx !== i));
  };

  const applyLink = () => {
    const v = linkUrl.trim();
    if (v) {
      const href = /^https?:\/\//i.test(v) ? v : `https://${v}`;
      editorRef.current?.insertLink(href);
    }
    setLinkPopPos(null);
    setLinkUrl('');
    editorRef.current?.focus();
  };

  const handleSubmit = () => {
    const clean = sanitizeHtml(value);
    const text = htmlToText(clean).replace(/[​-‍﻿]/g, '').trim();
    if (!text && images.length === 0) {
      toast.warning('Add some task content first.');
      editorRef.current?.focus();
      return;
    }
    const noteLinks = [
      { noteUid: currentNoteUid },
      ...Array.from(extraNoteUids).map((uid) => ({ noteUid: uid })),
    ];
    const cleanSubtasks = (subtasks || []).filter((s) => (s.text || '').trim());
    onSubmit({
      label: text.split('\n')[0].trim() || 'Task',
      value: clean,
      images,
      due: due || null,
      priority: priority || null,
      subtasks: cleanSubtasks,
      labels: labels?.length ? labels : [],
      recurrence: recurrence || null,
      noteLinks,
    });
  };

  const openLinkPop = () => {
    if (linkPopPos) {
      setLinkPopPos(null);
    } else {
      const r = linkBtnRef.current?.getBoundingClientRect();
      if (!r) return;
      setLinkPopPos({ x: r.left, y: r.bottom + 4 });
      setLinkUrl('');
      setTimeout(() => linkUrlRef.current?.focus(), 30);
    }
  };

  return <>{ createPortal(
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 3000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.35)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
    >
      <div className="ctm-modal">
        {/* ── Header ── */}
        <div className="ctm-head">
          <div className="ctm-head__text">
            <strong>New Kandoo task</strong>
            <span>Linked to this note automatically</span>
          </div>
          <button type="button" className="ctm-head__close" onClick={onCancel} aria-label="Cancel">
            <VscClose />
          </button>
        </div>

        {/* ── Formatting toolbar ── */}
        <div className="ctm-toolbar">
          <button type="button" className="ctm-tb" title="Bold (⌘B)" onMouseDown={(e) => e.preventDefault()} onClick={() => editorRef.current?.exec('bold')}>
            <VscBold />
          </button>
          <button type="button" className="ctm-tb" title="Italic (⌘I)" onMouseDown={(e) => e.preventDefault()} onClick={() => editorRef.current?.exec('italic')}>
            <VscItalic />
          </button>
          <button type="button" className="ctm-tb" title="Underline (⌘U)" onMouseDown={(e) => e.preventDefault()} onClick={() => editorRef.current?.exec('underline')}>
            <RiUnderline />
          </button>
          <span className="ctm-tb-sep" />
          <button
            ref={linkBtnRef}
            type="button"
            className={`ctm-tb${linkPopPos ? ' is-active' : ''}`}
            title="Hyperlink (⌘K)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={openLinkPop}
          >
            <VscLink />
          </button>
          <span style={{ flex: 1 }} />
          <PrioritySelector value={priority} onChange={setPriority} />
          <RecurrenceButton value={recurrence} onChange={setRecurrence} />
        </div>

        {/* ── Scrollable body ── */}
        <div className="ctm-body">

        {/* ── Rich editor ── */}
        <div className="ctm-editor-wrap">
          <RichEditor
            ref={editorRef}
            initialHtml=""
            onChange={setValue}
            onSave={handleSubmit}
            onCancel={onCancel}
            onRequestLink={openLinkPop}
            onImagePaste={handleImagePaste}
            autoFocus
            placeholder="What needs to be done?"
            className="task-rich-editor"
            style={{
              background: 'transparent',
              color: 'var(--theme-text-primary)',
              fontFamily: 'inherit',
              fontSize: '0.9rem',
              outline: 'none',
              border: 'none',
              minHeight: 72,
              padding: '10px 14px',
            }}
          />

          {images.length > 0 && (
            <div className="task-editor-attachments" style={{ padding: '0 12px 10px' }}>
              {images.map((src, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <img
                    src={src}
                    alt={`attachment-${i}`}
                    style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--theme-border)' }}
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    style={{
                      position: 'absolute', top: -6, right: -6,
                      background: 'var(--theme-danger)', border: 'none',
                      borderRadius: '50%', color: 'white',
                      width: 16, height: 16, padding: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', fontSize: 10, lineHeight: 1,
                    }}
                  >
                    <VscClose />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Subtasks ── */}
        <div className="ctm-section">
          <SubtaskEditor subtasks={subtasks} onChange={setSubtasks} />
        </div>

        {/* ── Labels ── */}
        <div className="ctm-section" style={{ padding: '6px 12px 8px' }}>
          <LabelPicker value={labels} onChange={setLabels} />
        </div>

        {/* ── Linked notes ── */}
        <div className="ctm-notes" style={{ borderTop: 'none' }}>
          <button
            type="button"
            className="ctm-notes__toggle"
            onClick={() => setNotesExpanded((p) => !p)}
          >
            <VscNote style={{ fontSize: '0.9em' }} />
            <span>Linked notes</span>
            <span className="ctm-notes__badge">{totalLinkedNotes}</span>
            <span style={{ flex: 1 }} />
            {notesExpanded ? <VscChevronUp style={{ fontSize: '0.8em' }} /> : <VscChevronDown style={{ fontSize: '0.8em' }} />}
          </button>

          {notesExpanded && (
            <div className="ctm-notes__body">
              {/* Current note — locked */}
              <div className="ctm-note-row is-locked">
                <span className="ctm-note-check is-checked">✓</span>
                <VscNote className="ctm-note-icon" />
                <span className="ctm-note-title">{currentNoteTitle || 'This note'}</span>
                <span className="ctm-note-current">current</span>
              </div>

              {allOtherNotes.length > 4 && (
                <div className="ctm-notes__search">
                  <VscSearch />
                  <input
                    value={noteSearch}
                    onChange={(e) => setNoteSearch(e.target.value)}
                    placeholder="Search notes…"
                  />
                </div>
              )}

              <div className="ctm-notes__list">
                {otherNotes.slice(0, 20).map((n) => {
                  const checked = extraNoteUids.has(n.uid);
                  return (
                    <div
                      key={n.uid}
                      className={`ctm-note-row${checked ? ' is-checked' : ''}`}
                      role="checkbox"
                      aria-checked={checked}
                      tabIndex={0}
                      onClick={() => toggleNote(n.uid)}
                      onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleNote(n.uid); } }}
                    >
                      <span className={`ctm-note-check${checked ? ' is-checked' : ''}`}>{checked ? '✓' : ''}</span>
                      <VscNote className="ctm-note-icon" />
                      <span className="ctm-note-title">{n.title || 'Untitled'}</span>
                    </div>
                  );
                })}
                {otherNotes.length === 0 && (
                  <div className="ctm-notes__empty">No other notes found.</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* end ctm-body */}
        </div>

        {/* ── Footer ── */}
        <div className="ctm-footer">
          <button
            type="button"
            className="ctm-footer__icon-btn"
            onClick={() => !uploading && fileRef.current?.click()}
            disabled={uploading}
            title="Attach image"
          >
            <IoImageOutline />
          </button>
          <DatePicker value={due} onChange={setDue} />
          <span style={{ flex: 1 }} />
          <button type="button" className="ctm-footer__cancel" onClick={onCancel}>Cancel</button>
          <button type="button" className="ctm-footer__submit" onClick={handleSubmit} disabled={uploading}>
            Add task
          </button>
        </div>

        <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleFileChange} />
      </div>
    </div>,
    document.body
  ) }
  {/* Link popover — separate portal so overflow:hidden on the modal can't clip it */}
  { linkPopPos && createPortal(
    <div
      data-ctm-link-pop
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
      style={{
        position: 'fixed',
        top: linkPopPos.y,
        left: linkPopPos.x,
        zIndex: 4000,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: 7,
        background: 'var(--theme-bg-modal)',
        border: '1px solid var(--theme-border)',
        borderRadius: 10,
        boxShadow: '0 8px 24px rgba(0,0,0,0.22)',
        minWidth: 280,
      }}
    >
      <input
        ref={linkUrlRef}
        value={linkUrl}
        onChange={(e) => setLinkUrl(e.target.value)}
        onPaste={(e) => { e.preventDefault(); const text = e.clipboardData.getData('text/plain'); if (text) setLinkUrl(text.trim()); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); applyLink(); }
          if (e.key === 'Escape') { setLinkPopPos(null); editorRef.current?.focus(); }
        }}
        placeholder="Paste or type a URL…"
        style={{
          flex: 1,
          background: 'var(--theme-bg-input)',
          border: '1px solid var(--theme-border)',
          borderRadius: 7,
          color: 'var(--theme-text-primary)',
          fontSize: '0.82rem',
          fontFamily: 'inherit',
          padding: '7px 9px',
          outline: 'none',
        }}
        onFocus={(e) => { e.target.style.borderColor = 'var(--theme-accent)'; }}
        onBlur={(e) => { e.target.style.borderColor = 'var(--theme-border)'; }}
      />
      <button
        type="button"
        onClick={applyLink}
        style={{
          padding: '7px 14px',
          border: 'none',
          borderRadius: 7,
          background: 'var(--theme-accent)',
          color: '#fff',
          fontSize: '0.8rem',
          fontWeight: 600,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        Add
      </button>
    </div>,
    document.body
  ) }
  </>;
}

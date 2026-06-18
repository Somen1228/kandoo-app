import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { sanitizeHtml } from '../../utils/htmlEditor';

// Lazy-load `marked` (~22KB gz) only when a paste actually needs it
let markedPromise = null;
function loadMarked() {
  if (!markedPromise) markedPromise = import('marked').then((m) => m.marked);
  return markedPromise;
}

// Heuristic: does pasted text look like markdown worth converting?
// Conservative — needs at least one strong block marker or 1+ inline markers
// (avoids converting random text that happens to contain a stray asterisk).
function looksLikeMarkdown(text) {
  if (!text || text.length < 3) return false;
  // Block-level patterns at the start of any line
  if (/^#{1,6}[ \t]+\S/m.test(text))    return true;  // heading
  if (/^[-*+][ \t]+\S/m.test(text))     return true;  // bullet list
  if (/^\d+\.[ \t]+\S/m.test(text))     return true;  // numbered list
  if (/^>[ \t]+\S/m.test(text))         return true;  // blockquote
  if (/^```/m.test(text))               return true;  // fenced code block
  if (/^---+$/m.test(text))             return true;  // horizontal rule
  // Inline patterns
  if (/\*\*[^*\n]+\*\*/.test(text))     return true;  // **bold**
  if (/\[[^\]]+\]\([^)\s]+\)/.test(text)) return true; // [link](url)
  if (/`[^`\n]+`/.test(text))           return true;  // `inline code`
  return false;
}

// WYSIWYG editor on top of contentEditable.
// Cmd/Ctrl+B/I/U → bold/italic/underline. Enter → save, Shift+Enter → newline.
// Paste is forced to plain text to keep storage clean.

const RichEditor = forwardRef(function RichEditor({
  initialHtml = '',
  onChange,
  onSave,
  onCancel,
  onBlur,
  className = '',
  style,
  placeholder = '',
  autoFocus = false,
  markdownPaste = false,
}, ref) {
  const editorRef = useRef(null);

  const updateEmptyState = () => {
    if (!editorRef.current) return;
    const empty = !editorRef.current.textContent?.trim();
    editorRef.current.setAttribute('data-empty', empty ? 'true' : 'false');
  };

  // execCommand has no inline-code; wrap selection in <code> manually.
  const wrapSelectionInCode = () => {
    const sel = window.getSelection();
    if (!sel?.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return;
    const text = range.toString();
    const code = document.createElement('code');
    code.textContent = text;
    range.deleteContents();
    range.insertNode(code);
    // Move cursor past the inserted element
    const after = document.createRange();
    after.setStartAfter(code);
    after.collapse(true);
    sel.removeAllRanges();
    sel.addRange(after);
  };

  useImperativeHandle(ref, () => ({
    focus: () => editorRef.current?.focus(),
    getElement: () => editorRef.current,
    getHtml: () => editorRef.current?.innerHTML || '',
    setHtml: (html) => {
      if (!editorRef.current) return;
      editorRef.current.innerHTML = html || '';
      updateEmptyState();
      onChange?.(editorRef.current.innerHTML);
    },
    exec: (cmd, value = null) => {
      const el = editorRef.current;
      if (!el) return;
      el.focus();
      if (cmd === 'inlineCode') {
        wrapSelectionInCode();
      } else if (cmd === 'clearFormatting') {
        // Remove inline formatting AND reset block to <p>
        document.execCommand('removeFormat', false);
        document.execCommand('formatBlock', false, 'P');
      } else {
        document.execCommand(cmd, false, value);
      }
      updateEmptyState();
      onChange?.(el.innerHTML);
    },
  }), [onChange]);

  // Seed initial content once. After mount, contentEditable owns the DOM.
  useEffect(() => {
    if (!editorRef.current) return;
    // Make execCommand emit inline styles (e.g. <span style="color">) instead of <font>.
    // This is per-document but safe to set repeatedly.
    try { document.execCommand('styleWithCSS', false, true); } catch { /* old browser */ }
    editorRef.current.innerHTML = initialHtml || '';
    updateEmptyState();
    if (autoFocus) {
      editorRef.current.focus();
      const range = document.createRange();
      range.selectNodeContents(editorRef.current);
      range.collapse(false); // cursor at end
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInput = () => {
    updateEmptyState();
    onChange?.(editorRef.current?.innerHTML || '');
  };

  const handleKeyDown = (e) => {
    // Cmd/Ctrl + B/I/U/K + Shift modifiers
    if ((e.metaKey || e.ctrlKey) && !e.altKey) {
      const k = e.key.toLowerCase();
      if (!e.shiftKey && (k === 'b' || k === 'i' || k === 'u')) {
        e.preventDefault();
        const cmd = { b: 'bold', i: 'italic', u: 'underline' }[k];
        document.execCommand(cmd, false);
        updateEmptyState();
        onChange?.(editorRef.current?.innerHTML || '');
        return;
      }
      // Cmd/Ctrl + Shift + X → strikethrough
      if (e.shiftKey && k === 'x') {
        e.preventDefault();
        document.execCommand('strikeThrough', false);
        updateEmptyState();
        onChange?.(editorRef.current?.innerHTML || '');
        return;
      }
    }

    if (e.key === 'Enter') {
      // Only intercept Enter when the parent wants a save-on-Enter behaviour
      // (task editing). For notes / general use, let the browser create
      // paragraphs/line breaks naturally.
      if (onSave && !e.shiftKey) {
        e.preventDefault();
        onSave();
        return;
      }
      if (onSave && e.shiftKey) {
        e.preventDefault();
        document.execCommand('insertLineBreak');
        updateEmptyState();
        onChange?.(editorRef.current?.innerHTML || '');
      }
      // No onSave → let the browser handle Enter / Shift+Enter normally
      return;
    }

    if (e.key === 'Escape') {
      // Same logic: only intercept when there's a parent to cancel into.
      // For notes the editor just loses focus (blur autosaves via onChange).
      if (onCancel) {
        e.preventDefault();
        onCancel();
      } else {
        editorRef.current?.blur();
      }
    }
  };

  // Paste handler:
  //  - Default: plain text only (safe; no rogue formatting from web pages)
  //  - With markdownPaste: detect markdown in clipboard text, convert via `marked`,
  //    then insertHTML so the editor renders the proper structure.
  const handlePaste = async (e) => {
    const cb = e.clipboardData || window.clipboardData;
    const text = cb.getData('text/plain');
    if (!text) return; // let browser handle non-text payloads
    e.preventDefault();

    if (markdownPaste && looksLikeMarkdown(text)) {
      try {
        const marked = await loadMarked();
        const rawHtml = marked.parse(text, { breaks: true, gfm: true });
        const clean = sanitizeHtml(rawHtml);
        editorRef.current?.focus();
        document.execCommand('insertHTML', false, clean);
      } catch {
        // If marked fails for any reason, fall back to plain-text paste
        document.execCommand('insertText', false, text);
      }
    } else {
      document.execCommand('insertText', false, text);
    }
    updateEmptyState();
    onChange?.(editorRef.current?.innerHTML || '');
  };

  return (
    <div
      ref={editorRef}
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      onBlur={onBlur}
      className={`rich-editor ${className}`}
      style={style}
      data-placeholder={placeholder}
      data-empty="true"
    />
  );
});

export default RichEditor;

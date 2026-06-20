import { useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import { Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import FontFamily from '@tiptap/extension-font-family';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import { createLowlight, common } from 'lowlight';
import { SlashCommand, SlashMenuPortal } from './slashCommand';
import { PageLink } from './pageLink';
import { ResizableImage } from './ResizableImage';
import ContextMenu from '../ContextMenu';
import { toast } from 'sonner';
import { compressImage } from './NoteCard';
import { useSettings } from '../../contexts/SettingsContext';
import {
  VscBold, VscItalic, VscListUnordered, VscListOrdered, VscCode, VscQuote,
  VscLink, VscHorizontalRule, VscClearAll, VscChecklist, VscTable,
  VscChevronLeft, VscChevronRight,
} from 'react-icons/vsc';
import {
  RiUnderline, RiStrikethrough, RiFontColor, RiMarkPenLine,
  RiAlignLeft, RiAlignCenter, RiAlignRight, RiCodeSSlashLine,
} from 'react-icons/ri';
import { IoImageOutline } from 'react-icons/io5';

const lowlight = createLowlight(common);

// ── Font-size mark (TextStyle-based; TipTap v2 has no built-in) ────────────
const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() { return { types: ['textStyle'] }; },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        fontSize: {
          default: null,
          parseHTML: (el) => el.style.fontSize || null,
          renderHTML: (attrs) => (attrs.fontSize ? { style: `font-size:${attrs.fontSize}` } : {}),
        },
      },
    }];
  },
  addCommands() {
    return {
      setFontSize: (size) => ({ chain }) => chain().setMark('textStyle', { fontSize: size }).run(),
      unsetFontSize: () => ({ chain }) =>
        chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    };
  },
});

const FONT_FAMILIES = [
  { label: 'Default font', value: '' },
  { label: 'Sans', value: 'Inter, -apple-system, sans-serif' },
  { label: 'Serif', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Mono', value: '"SF Mono", ui-monospace, monospace' },
];
const FONT_SIZES = ['', '12px', '13px', '14px', '16px', '18px', '20px', '24px', '30px'];

export default function NoteEditor({ content, onChange, placeholder, paperless, notes, onCreatePage, onNavigatePage }) {
  const fileRef = useRef(null);
  const editorRef = useRef(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [tableDialogOpen, setTableDialogOpen] = useState(false);
  const [editorContextMenu, setEditorContextMenu] = useState(null);
  const [tableContextMenu, setTableContextMenu] = useState(null);
  const [slashState, setSlashState] = useState(null);

  const handleSlashOpen   = useCallback((s) => setSlashState(s), []);
  const handleSlashUpdate = useCallback((s) => setSlashState(s), []);
  const handleSlashClose  = useCallback(() => setSlashState(null), []);
  const { settings } = useSettings();

  // Live title lookup for pageLink nodes (kept current as pages are renamed).
  const titlesRef = useRef({});
  useEffect(() => {
    const map = {};
    (notes || []).forEach((n) => { map[n.uid] = n.title; });
    titlesRef.current = map;
  }, [notes]);

  // Insert one or more image files at the cursor (used by toolbar, paste, drop).
  const insertImageFiles = async (files) => {
    const ed = editorRef.current;
    if (!ed) return;
    for (const f of files) {
      try {
        const src = await compressImage(f);
        ed.chain().focus().setImage({ src }).run();
      } catch (err) {
        toast.error(`${f.name}: ${err.message}`);
      }
    }
  };

  const writeClipboard = async (text, afterWrite) => {
    try {
      await navigator.clipboard.writeText(text);
      afterWrite?.();
    } catch {
      toast.error('Clipboard permission denied');
    }
  };

  const pasteClipboard = async (editor) => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) editor.chain().focus().insertContent(text).run();
    } catch {
      toast.error('Clipboard permission denied');
    }
  };

  const openEditorContextMenu = (view, event) => {
    event.preventDefault();
    const editor = editorRef.current;
    if (!editor) return true;
    const target = event.target instanceof Element ? event.target : null;
    const table = target?.closest('table');
    const imageNode = target?.closest('.note-image-node');
    const link = target?.closest('a[href]');
    const taskItem = target?.closest('li[data-type="taskItem"]');
    const hit = view.posAtCoords({ left: event.clientX, top: event.clientY });

    if (imageNode) {
      try {
        editor.commands.setNodeSelection(view.posAtDOM(imageNode, 0));
      } catch { /* keep the current node selection */ }
    } else if (hit) {
      const { from, to } = view.state.selection;
      if (hit.pos < from || hit.pos > to) editor.commands.setTextSelection(hit.pos);
    }

    setEditorContextMenu(null);
    setTableContextMenu(null);

    if (table) {
      setTableContextMenu({
        top: event.clientY,
        left: event.clientX,
      });
      return true;
    }

    const selection = editor.state.selection;
    const selectedText = selection.empty
      ? ''
      : editor.state.doc.textBetween(selection.from, selection.to, '\n');
    let items;

    if (imageNode) {
      items = [
        { label: 'Fit image', onClick: () => editor.chain().focus().updateAttributes('image', { cropRatio: '' }).run() },
        { label: 'Crop square (1:1)', onClick: () => editor.chain().focus().updateAttributes('image', { cropRatio: '1 / 1' }).run() },
        { label: 'Crop widescreen (16:9)', onClick: () => editor.chain().focus().updateAttributes('image', { cropRatio: '16 / 9' }).run() },
        { divider: true },
        { label: 'Set width to 50%', onClick: () => editor.chain().focus().updateAttributes('image', { width: 50 }).run() },
        { label: 'Set width to 75%', onClick: () => editor.chain().focus().updateAttributes('image', { width: 75 }).run() },
        { label: 'Set width to 100%', onClick: () => editor.chain().focus().updateAttributes('image', { width: 100 }).run() },
        { divider: true },
        { label: 'Delete image', danger: true, onClick: () => editor.chain().focus().deleteSelection().run() },
      ];
    } else if (link) {
      const href = link.getAttribute('href') || '';
      items = [
        { label: 'Edit link', onClick: () => setLinkDialogOpen(true) },
        { label: 'Copy link address', onClick: () => writeClipboard(href, () => toast.success('Link copied')) },
        { label: 'Remove link', danger: true, onClick: () => editor.chain().focus().extendMarkRange('link').unsetLink().run() },
      ];
    } else if (!selection.empty) {
      items = [
        { label: 'Cut', shortcut: '⌘X', onClick: () => writeClipboard(selectedText, () => editor.chain().focus().deleteSelection().run()) },
        { label: 'Copy', shortcut: '⌘C', onClick: () => writeClipboard(selectedText, () => toast.success('Copied')) },
        { divider: true },
        { label: 'Bold', shortcut: '⌘B', onClick: () => editor.chain().focus().toggleBold().run() },
        { label: 'Italic', shortcut: '⌘I', onClick: () => editor.chain().focus().toggleItalic().run() },
        { label: 'Underline', shortcut: '⌘U', onClick: () => editor.chain().focus().toggleUnderline().run() },
        { label: 'Add hyperlink…', onClick: () => setLinkDialogOpen(true) },
        { divider: true },
        { label: 'Clear formatting', onClick: () => editor.chain().focus().unsetAllMarks().clearNodes().run() },
      ];
    } else if (taskItem) {
      const checked = editor.getAttributes('taskItem').checked;
      items = [
        { label: checked ? 'Mark unchecked' : 'Mark checked', onClick: () => editor.chain().focus().updateAttributes('taskItem', { checked: !checked }).run() },
        { label: 'Remove checklist formatting', onClick: () => editor.chain().focus().liftListItem('taskItem').run() },
        { divider: true },
        { label: 'Paste', shortcut: '⌘V', onClick: () => pasteClipboard(editor) },
      ];
    } else {
      items = [
        { label: 'Paste', shortcut: '⌘V', onClick: () => pasteClipboard(editor) },
        { label: 'Select all', shortcut: '⌘A', onClick: () => editor.chain().focus().selectAll().run() },
        { divider: true },
        { label: 'Undo', shortcut: '⌘Z', onClick: () => editor.chain().focus().undo().run() },
        { label: 'Redo', shortcut: '⌘⇧Z', onClick: () => editor.chain().focus().redo().run() },
        { divider: true },
        { label: 'Insert image…', onClick: () => fileRef.current?.click() },
        { label: 'Insert table…', onClick: () => setTableDialogOpen(true) },
      ];
    }

    setEditorContextMenu({ x: event.clientX, y: event.clientY, items });
    return true;
  };

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Underline,
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
      }),
      ResizableImage.configure({ allowBase64: true }),
      Placeholder.configure({ placeholder: placeholder || 'Start writing…' }),
      TaskList,
      TaskItem.configure({ nested: true }),
      CodeBlockLowlight.configure({ lowlight }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      SlashCommand.configure({
        onImage: () => fileRef.current?.click(),
        onCreatePage,
        onInsertTable: () => setTableDialogOpen(true),
        onOpen:   handleSlashOpen,
        onUpdate: handleSlashUpdate,
        onClose:  handleSlashClose,
      }),
      PageLink.configure({
        getTitle: (uid) => titlesRef.current[uid] || 'Untitled page',
        onNavigate: (uid) => onNavigatePage?.(uid),
      }),
    ],
    content: content || '',
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: { class: 'note-prose', spellcheck: String(settings.noteSpellcheck) },
      handlePaste: (_view, event) => {
        const imgs = Array.from(event.clipboardData?.files || []).filter((f) =>
          f.type.startsWith('image/')
        );
        if (!imgs.length) return false;
        event.preventDefault();
        insertImageFiles(imgs);
        return true;
      },
      handleDrop: (_view, event) => {
        const imgs = Array.from(event.dataTransfer?.files || []).filter((f) =>
          f.type.startsWith('image/')
        );
        if (!imgs.length) return false;
        event.preventDefault();
        insertImageFiles(imgs);
        return true;
      },
      handleDOMEvents: {
        contextmenu: openEditorContextMenu,
      },
    },
  });

  useEffect(() => { editorRef.current = editor; }, [editor]);

  const onFilePick = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length) insertImageFiles(files);
  };

  return (
    <div className={`note-editor${paperless ? ' is-paperless' : ''}`}>
      {editor && (
        <Toolbar
          editor={editor}
          onImage={() => fileRef.current?.click()}
          onLink={() => setLinkDialogOpen(true)}
          onTable={() => setTableDialogOpen(true)}
        />
      )}
      {editor && (
        <BubbleMenu editor={editor} tippyOptions={{ duration: 120 }} className="note-bubble">
          <BubbleBtn editor={editor} cmd="toggleBold" name="bold" title="Bold"><VscBold /></BubbleBtn>
          <BubbleBtn editor={editor} cmd="toggleItalic" name="italic" title="Italic"><VscItalic /></BubbleBtn>
          <BubbleBtn editor={editor} cmd="toggleUnderline" name="underline" title="Underline"><RiUnderline /></BubbleBtn>
          <BubbleBtn editor={editor} cmd="toggleStrike" name="strike" title="Strikethrough"><RiStrikethrough /></BubbleBtn>
          <BubbleBtn editor={editor} cmd="toggleCode" name="code" title="Inline code"><RiCodeSSlashLine /></BubbleBtn>
          <button className="note-tb__btn" title="Link" onClick={() => setLinkDialogOpen(true)}><VscLink /></button>
        </BubbleMenu>
      )}
      <EditorContent editor={editor} />
      <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={onFilePick} />
      {editor && (
        <>
          <LinkDialog editor={editor} open={linkDialogOpen} onClose={() => setLinkDialogOpen(false)} />
          <TableDialog editor={editor} open={tableDialogOpen} onClose={() => setTableDialogOpen(false)} />
          {editorContextMenu && (
            <ContextMenu x={editorContextMenu.x} y={editorContextMenu.y}
              items={editorContextMenu.items} onClose={() => setEditorContextMenu(null)} />
          )}
          {tableContextMenu && (
            <TableMenu editor={editor} position={tableContextMenu}
              onClose={() => setTableContextMenu(null)} />
          )}
          <SlashMenuPortal state={slashState} />
        </>
      )}
    </div>
  );
}

// ── Toolbar ─────────────────────────────────────────────────────────────────
function Toolbar({ editor, onImage, onLink, onTable }) {
  const [openPalette, setOpenPalette] = useState(null);
  const [toolbarOverflow, setToolbarOverflow] = useState({ left: false, right: false });
  const toolbarRef = useRef(null);

  useEffect(() => {
    const element = toolbarRef.current;
    if (!element) return undefined;
    const update = () => {
      const maxScroll = Math.max(0, element.scrollWidth - element.clientWidth);
      setToolbarOverflow({
        left: element.scrollLeft > 2,
        right: element.scrollLeft < maxScroll - 2,
      });
    };
    const frame = requestAnimationFrame(update);
    const observer = new ResizeObserver(update);
    observer.observe(element);
    element.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      element.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  const scrollToolbar = (direction) => {
    const element = toolbarRef.current;
    if (!element) return;
    element.scrollBy({
      left: direction * Math.max(180, element.clientWidth * 0.65),
      behavior: 'smooth',
    });
  };

  const styleValue = editor.isActive('heading', { level: 1 }) ? 'h1'
    : editor.isActive('heading', { level: 2 }) ? 'h2'
    : editor.isActive('heading', { level: 3 }) ? 'h3'
    : 'p';

  const applyStyle = (v) => {
    const c = editor.chain().focus();
    if (v === 'p') c.setParagraph().run();
    else c.toggleHeading({ level: Number(v.slice(1)) }).run();
  };

  const fontFamily = editor.getAttributes('textStyle').fontFamily || '';
  const fontSize = editor.getAttributes('textStyle').fontSize || '';

  return (
    <div className="note-tb-shell">
      {toolbarOverflow.left && (
        <button type="button" className="note-tb__overflow note-tb__overflow--left"
          title="More formatting options to the left" aria-label="Scroll toolbar left"
          onMouseDown={(event) => event.preventDefault()} onClick={() => scrollToolbar(-1)}>
          <VscChevronLeft />
        </button>
      )}
      <div ref={toolbarRef} className="note-tb" onMouseDown={(e) => {
        if (!e.target.closest('select, input')) e.preventDefault();
      }}>
      <select className="note-tb__select note-tb__select--style" value={styleValue} onChange={(e) => applyStyle(e.target.value)} title="Paragraph style">
        <option value="p">Normal</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
      </select>

      <select className="note-tb__select note-tb__select--font" value={fontFamily}
        onChange={(e) => e.target.value
          ? editor.chain().focus().setFontFamily(e.target.value).run()
          : editor.chain().focus().unsetFontFamily().run()}
        title="Font">
        {FONT_FAMILIES.map((f) => <option key={f.label} value={f.value}>{f.label}</option>)}
      </select>

      <select className="note-tb__select note-tb__select--sm" value={fontSize}
        onChange={(e) => e.target.value
          ? editor.chain().focus().setFontSize(e.target.value).run()
          : editor.chain().focus().unsetFontSize().run()}
        title="Font size">
        <option value="">Size</option>
        {FONT_SIZES.filter(Boolean).map((s) => <option key={s} value={s}>{parseInt(s, 10)}</option>)}
      </select>

      <Sep />
      <TBtn editor={editor} run="toggleBold" active="bold" title="Bold (⌘B)"><VscBold /></TBtn>
      <TBtn editor={editor} run="toggleItalic" active="italic" title="Italic (⌘I)"><VscItalic /></TBtn>
      <TBtn editor={editor} run="toggleUnderline" active="underline" title="Underline (⌘U)"><RiUnderline /></TBtn>
      <TBtn editor={editor} run="toggleStrike" active="strike" title="Strikethrough"><RiStrikethrough /></TBtn>
      <TBtn editor={editor} run="toggleCode" active="code" title="Inline code"><RiCodeSSlashLine /></TBtn>

      <Sep />
      <ColorControl
        title="Text colour"
        icon={<RiFontColor />}
        open={openPalette === 'text'}
        onToggle={() => setOpenPalette((value) => value === 'text' ? null : 'text')}
        onClose={() => setOpenPalette(null)}
        colors={['#0f172a', '#475569', '#dc2626', '#d97706', '#16a34a', '#2563eb', '#7c3aed', '#db2777']}
        customDefault="#1e3a5f"
        onApply={(color) => editor.chain().focus().setColor(color).run()}
        onClear={() => editor.chain().focus().unsetColor().run()}
      />
      <ColorControl
        title="Highlight"
        icon={<RiMarkPenLine />}
        active={editor.isActive('highlight')}
        open={openPalette === 'highlight'}
        onToggle={() => setOpenPalette((value) => value === 'highlight' ? null : 'highlight')}
        onClose={() => setOpenPalette(null)}
        colors={['#fef08a', '#fed7aa', '#fecaca', '#fbcfe8', '#ddd6fe', '#bfdbfe', '#bbf7d0', '#d1d5db']}
        customDefault="#fbe8a6"
        onApply={(color) => editor.chain().focus().setHighlight({ color }).run()}
        onClear={() => editor.chain().focus().unsetHighlight().run()}
      />

      <Sep />
      <TBtn editor={editor} run="toggleBulletList" active="bulletList" title="Bullet list"><VscListUnordered /></TBtn>
      <TBtn editor={editor} run="toggleOrderedList" active="orderedList" title="Numbered list"><VscListOrdered /></TBtn>
      <TBtn editor={editor} run="toggleTaskList" active="taskList" title="Checklist"><VscChecklist /></TBtn>

      <Sep />
      <button className={`note-tb__btn${editor.isActive({ textAlign: 'left' }) ? ' is-active' : ''}`} title="Align left" onClick={() => editor.chain().focus().setTextAlign('left').run()}><RiAlignLeft /></button>
      <button className={`note-tb__btn${editor.isActive({ textAlign: 'center' }) ? ' is-active' : ''}`} title="Align center" onClick={() => editor.chain().focus().setTextAlign('center').run()}><RiAlignCenter /></button>
      <button className={`note-tb__btn${editor.isActive({ textAlign: 'right' }) ? ' is-active' : ''}`} title="Align right" onClick={() => editor.chain().focus().setTextAlign('right').run()}><RiAlignRight /></button>

      <Sep />
      <TBtn editor={editor} run="toggleBlockquote" active="blockquote" title="Quote"><VscQuote /></TBtn>
      <TBtn editor={editor} run="toggleCodeBlock" active="codeBlock" title="Code block"><VscCode /></TBtn>
      <button className="note-tb__btn" title="Horizontal rule" onClick={() => editor.chain().focus().setHorizontalRule().run()}><VscHorizontalRule /></button>
      <TableControl editor={editor} onInsert={onTable} />
      <button className={`note-tb__btn${editor.isActive('link') ? ' is-active' : ''}`} title="Link" onClick={onLink}><VscLink /></button>
      <button className="note-tb__btn" title="Image" onClick={onImage}><IoImageOutline /></button>

      <Sep />
        <button className="note-tb__btn" title="Clear formatting" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}><VscClearAll /></button>
      </div>
      {toolbarOverflow.right && (
        <button type="button" className="note-tb__overflow note-tb__overflow--right"
          title="More formatting options to the right" aria-label="Scroll toolbar right"
          onMouseDown={(event) => event.preventDefault()} onClick={() => scrollToolbar(1)}>
          <VscChevronRight />
        </button>
      )}
    </div>
  );
}

function ColorControl({ title, icon, active = false, open, onToggle, onClose, colors, customDefault, onApply, onClear }) {
  const [position, setPosition] = useState(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event) => {
      if (buttonRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return;
      onClose();
    };
    const closeOnEscape = (event) => { if (event.key === 'Escape') onClose(); };
    const closeOnViewportChange = () => onClose();
    document.addEventListener('mousedown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', closeOnViewportChange);
    window.addEventListener('scroll', closeOnViewportChange, true);
    return () => {
      document.removeEventListener('mousedown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', closeOnViewportChange);
      window.removeEventListener('scroll', closeOnViewportChange, true);
    };
  }, [onClose, open]);

  const activate = () => {
    if (open) { onClose(); return; }
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 176;
    const height = 144;
    const margin = 8;
    setPosition({
      left: Math.min(window.innerWidth - width - margin, Math.max(margin, rect.left)),
      top: Math.min(window.innerHeight - height - margin, Math.max(margin, rect.bottom + 7)),
    });
    onToggle();
  };

  return (
    <div className="note-color-control">
      <button ref={buttonRef} type="button" className={`note-tb__btn${active ? ' is-active' : ''}`}
        title={title} aria-expanded={open} onClick={activate}>
        {icon}
      </button>
      {open && position && createPortal(
        <div ref={menuRef} className="note-color-popover" style={position} onMouseDown={(event) => {
          if (!event.target.closest('input')) event.preventDefault();
        }}>
          <div className="note-color-popover__grid">
            {colors.map((color) => (
              <button key={color} type="button" className="note-color-swatch"
                style={{ background: color }} title={color}
                onClick={() => onApply(color)} />
            ))}
          </div>
          <div className="note-color-popover__footer">
            <label className="note-color-custom">
              Custom
              <input type="color" defaultValue={customDefault}
                onInput={(event) => onApply(event.target.value)} />
            </label>
            <button type="button" onClick={onClear}>Clear</button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function TableControl({ editor, onInsert }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const buttonRef = useRef(null);
  const inTable = editor.isActive('table');

  useEffect(() => {
    if (!inTable) setOpen(false);
  }, [inTable]);

  const activate = () => {
    if (!inTable) { onInsert(); return; }
    if (open) { setOpen(false); return; }
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition(clampTableMenuPosition(rect.right - 274, rect.bottom + 8));
    setOpen(true);
  };

  return (
    <div className="note-table-control">
      <button ref={buttonRef} type="button" className={`note-tb__btn${inTable ? ' is-active' : ''}`}
        title={inTable ? 'Table options' : 'Insert table'} aria-expanded={inTable ? open : undefined}
        onClick={activate}>
        <VscTable />
      </button>
      {inTable && open && position && (
        <TableMenu editor={editor} position={position} anchorRef={buttonRef}
          onClose={() => setOpen(false)} />
      )}
    </div>
  );
}

function clampTableMenuPosition(left, top) {
  const width = 274;
  const height = 272;
  const margin = 8;
  return {
    left: Math.min(window.innerWidth - width - margin, Math.max(margin, left)),
    top: Math.min(window.innerHeight - height - margin, Math.max(margin, top)),
  };
}

function TableMenu({ editor, position, onClose, anchorRef }) {
  const menuRef = useRef(null);

  useEffect(() => {
    const closeOutside = (event) => {
      if (anchorRef?.current?.contains(event.target) || menuRef.current?.contains(event.target)) return;
      onClose();
    };
    const closeOnEscape = (event) => { if (event.key === 'Escape') onClose(); };
    const closeOnViewportChange = () => onClose();
    document.addEventListener('mousedown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', closeOnViewportChange);
    window.addEventListener('scroll', closeOnViewportChange, true);
    return () => {
      document.removeEventListener('mousedown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', closeOnViewportChange);
      window.removeEventListener('scroll', closeOnViewportChange, true);
    };
  }, [anchorRef, onClose]);

  const run = (command, close = false) => {
    editor.chain().focus()[command]().run();
    if (close) onClose();
  };

  const safePosition = clampTableMenuPosition(position.left, position.top);
  return createPortal(
    <div ref={menuRef} className="note-table-popover" style={safePosition}
      onMouseDown={(event) => event.preventDefault()}>
      <div className="note-table-popover__head">
        <strong>Table options</strong>
        <button type="button" onClick={onClose} aria-label="Close table options">×</button>
      </div>

      <div className="note-table-popover__group">
        <span>Rows</span>
        <div>
          <button type="button" onClick={() => run('addRowBefore')}>+ Above</button>
          <button type="button" onClick={() => run('addRowAfter')}>+ Below</button>
          <button type="button" onClick={() => run('deleteRow')}>Delete</button>
        </div>
      </div>

      <div className="note-table-popover__group">
        <span>Columns</span>
        <div>
          <button type="button" onClick={() => run('addColumnBefore')}>+ Left</button>
          <button type="button" onClick={() => run('addColumnAfter')}>+ Right</button>
          <button type="button" onClick={() => run('deleteColumn')}>Delete</button>
        </div>
      </div>

      <button type="button" className="note-table-popover__wide"
        onClick={() => run('toggleHeaderRow')}>Toggle header row</button>
      <button type="button" className="note-table-popover__wide is-danger"
        onClick={() => run('deleteTable', true)}>Delete table</button>
    </div>,
    document.body
  );
}

function DialogShell({ title, children, onClose }) {
  useEffect(() => {
    const closeOnEscape = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return createPortal(
    <div className="note-tool-overlay" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div className="note-tool-dialog" role="dialog" aria-modal="true" aria-label={title}>
        <div className="note-tool-dialog__head">
          <strong>{title}</strong>
          <button type="button" onClick={onClose} aria-label="Close">×</button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

function normalizeLink(value) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^(https?:\/\/|mailto:)/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function LinkDialog({ editor, open, onClose }) {
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');

  useEffect(() => {
    if (!open) return;
    const { from, to, empty } = editor.state.selection;
    setUrl(editor.getAttributes('link').href || '');
    setLabel(empty ? '' : editor.state.doc.textBetween(from, to, ' '));
  }, [editor, open]);

  if (!open) return null;
  const selectionEmpty = editor.state.selection.empty;
  const hasLink = editor.isActive('link');

  const apply = (event) => {
    event.preventDefault();
    const href = normalizeLink(url);
    if (!href) { toast.error('Enter a link URL'); return; }

    const chain = editor.chain().focus();
    if (selectionEmpty && !hasLink) {
      chain.insertContent({
        type: 'text',
        text: label.trim() || href,
        marks: [{ type: 'link', attrs: { href } }],
      }).run();
    } else {
      chain.extendMarkRange('link').setLink({ href }).run();
    }
    onClose();
  };

  return (
    <DialogShell title="Add hyperlink" onClose={onClose}>
      <form onSubmit={apply}>
        <label className="note-tool-field">
          <span>URL</span>
          <input autoFocus type="text" inputMode="url" value={url} onChange={(event) => setUrl(event.target.value)}
            placeholder="https://example.com" />
        </label>
        {selectionEmpty && !hasLink && (
          <label className="note-tool-field">
            <span>Link text</span>
            <input value={label} onChange={(event) => setLabel(event.target.value)}
              placeholder="Optional display text" />
          </label>
        )}
        <div className="note-tool-actions">
          {hasLink && (
            <button type="button" onClick={() => {
              editor.chain().focus().extendMarkRange('link').unsetLink().run();
              onClose();
            }}>Remove link</button>
          )}
          <span />
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="is-primary">Apply link</button>
        </div>
      </form>
    </DialogShell>
  );
}

function TableDialog({ editor, open, onClose }) {
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [header, setHeader] = useState(true);

  if (!open) return null;

  const insert = (event) => {
    event.preventDefault();
    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: header }).run();
    onClose();
  };

  return (
    <DialogShell title="Insert table" onClose={onClose}>
      <form onSubmit={insert}>
        <div className="note-table-size-fields">
          <label className="note-tool-field">
            <span>Rows</span>
            <input autoFocus type="number" min="1" max="20" value={rows}
              onChange={(event) => setRows(Math.min(20, Math.max(1, Number(event.target.value) || 1)))} />
          </label>
          <label className="note-tool-field">
            <span>Columns</span>
            <input type="number" min="1" max="12" value={cols}
              onChange={(event) => setCols(Math.min(12, Math.max(1, Number(event.target.value) || 1)))} />
          </label>
        </div>
        <label className="note-tool-check">
          <input type="checkbox" checked={header} onChange={(event) => setHeader(event.target.checked)} />
          Include header row
        </label>
        <div className="note-tool-actions">
          <span />
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" className="is-primary">Insert {rows} × {cols}</button>
        </div>
      </form>
    </DialogShell>
  );
}

function TBtn({ editor, run, active, title, children }) {
  return (
    <button
      type="button"
      className={`note-tb__btn${editor.isActive(active) ? ' is-active' : ''}`}
      title={title}
      onClick={() => editor.chain().focus()[run]().run()}
    >
      {children}
    </button>
  );
}

function BubbleBtn({ editor, cmd, name, title, children }) {
  return (
    <button
      type="button"
      className={`note-tb__btn${editor.isActive(name) ? ' is-active' : ''}`}
      title={title}
      onClick={() => editor.chain().focus()[cmd]().run()}
    >
      {children}
    </button>
  );
}

const Sep = () => <span className="note-tb__sep" />;

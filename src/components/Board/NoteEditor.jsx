import { useRef, useEffect } from 'react';
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
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import { createLowlight, common } from 'lowlight';
import { SlashCommand } from './slashCommand';
import { PageLink } from './pageLink';
import { toast } from 'sonner';
import { compressImage } from './NoteCard';
import { useSettings } from '../../contexts/SettingsContext';
import {
  VscBold, VscItalic, VscListUnordered, VscListOrdered, VscCode, VscQuote,
  VscLink, VscHorizontalRule, VscClearAll, VscChecklist, VscTable,
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
      Image.configure({ allowBase64: true }),
      Placeholder.configure({ placeholder: placeholder || 'Start writing…' }),
      TaskList,
      TaskItem.configure({ nested: true }),
      CodeBlockLowlight.configure({ lowlight }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      SlashCommand.configure({ onImage: () => fileRef.current?.click(), onCreatePage }),
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
      {editor && <Toolbar editor={editor} onImage={() => fileRef.current?.click()} />}
      {editor && (
        <BubbleMenu editor={editor} tippyOptions={{ duration: 120 }} className="note-bubble">
          <BubbleBtn editor={editor} cmd="toggleBold" name="bold" title="Bold"><VscBold /></BubbleBtn>
          <BubbleBtn editor={editor} cmd="toggleItalic" name="italic" title="Italic"><VscItalic /></BubbleBtn>
          <BubbleBtn editor={editor} cmd="toggleUnderline" name="underline" title="Underline"><RiUnderline /></BubbleBtn>
          <BubbleBtn editor={editor} cmd="toggleStrike" name="strike" title="Strikethrough"><RiStrikethrough /></BubbleBtn>
          <BubbleBtn editor={editor} cmd="toggleCode" name="code" title="Inline code"><RiCodeSSlashLine /></BubbleBtn>
          <button className="note-tb__btn" title="Link" onClick={() => setLink(editor)}><VscLink /></button>
        </BubbleMenu>
      )}
      <EditorContent editor={editor} />
      <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={onFilePick} />
    </div>
  );
}

function setLink(editor) {
  const prev = editor.getAttributes('link').href || 'https://';
  const url = window.prompt('Link URL:', prev);
  if (url === null) return;
  if (url === '') { editor.chain().focus().unsetLink().run(); return; }
  if (!/^https?:\/\//i.test(url)) { window.alert('Link must start with http:// or https://'); return; }
  editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
}

// ── Toolbar ─────────────────────────────────────────────────────────────────
function Toolbar({ editor, onImage }) {
  const textColorRef = useRef(null);
  const hiliteColorRef = useRef(null);

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
    <div className="note-tb" onMouseDown={(e) => { if (e.target.tagName !== 'SELECT') e.preventDefault(); }}>
      <select className="note-tb__select" value={styleValue} onChange={(e) => applyStyle(e.target.value)} title="Paragraph style">
        <option value="p">Normal</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
      </select>

      <select className="note-tb__select" value={fontFamily}
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
      <button className="note-tb__btn" title="Text colour" onClick={() => textColorRef.current?.click()}><RiFontColor /></button>
      <input ref={textColorRef} type="color" defaultValue="#1e3a5f"
        onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
        style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }} />
      <button className={`note-tb__btn${editor.isActive('highlight') ? ' is-active' : ''}`} title="Highlight" onClick={() => hiliteColorRef.current?.click()}><RiMarkPenLine /></button>
      <input ref={hiliteColorRef} type="color" defaultValue="#fbe8a6"
        onChange={(e) => editor.chain().focus().toggleHighlight({ color: e.target.value }).run()}
        style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }} />

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
      <button className="note-tb__btn" title="Insert table" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><VscTable /></button>
      <button className="note-tb__btn" title="Link" onClick={() => setLink(editor)}><VscLink /></button>
      <button className="note-tb__btn" title="Image" onClick={onImage}><IoImageOutline /></button>

      <Sep />
      <button className="note-tb__btn" title="Clear formatting" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}><VscClearAll /></button>
    </div>
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

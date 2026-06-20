import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Extension } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import {
  VscSymbolString, VscListUnordered, VscListOrdered, VscChecklist,
  VscQuote, VscCode, VscHorizontalRule, VscTable, VscFile,
} from 'react-icons/vsc';
import { IoImageOutline } from 'react-icons/io5';

// ── Command catalogue ───────────────────────────────────────────────────────
const COMMANDS = [
  { title: 'Text', desc: 'Plain paragraph', kw: ['text', 'paragraph', 'p'], icon: <VscSymbolString />,
    run: (e, r) => e.chain().focus().deleteRange(r).setParagraph().run() },
  { title: 'Page', desc: 'Create a nested sub-page', kw: ['page', 'subpage', 'note', 'doc'], icon: <VscFile />,
    run: (e, r, ctx) => {
      const created = ctx?.onCreatePage?.();
      const chain = e.chain().focus().deleteRange(r);
      if (created) chain.insertContent({ type: 'pageLink', attrs: { uid: created.uid, title: created.title } });
      chain.run();
    } },
  { title: 'Heading 1', desc: 'Large section heading', kw: ['h1', 'heading', 'title'], icon: <b>H1</b>,
    run: (e, r) => e.chain().focus().deleteRange(r).toggleHeading({ level: 1 }).run() },
  { title: 'Heading 2', desc: 'Medium heading', kw: ['h2', 'heading'], icon: <b>H2</b>,
    run: (e, r) => e.chain().focus().deleteRange(r).toggleHeading({ level: 2 }).run() },
  { title: 'Heading 3', desc: 'Small heading', kw: ['h3', 'heading'], icon: <b>H3</b>,
    run: (e, r) => e.chain().focus().deleteRange(r).toggleHeading({ level: 3 }).run() },
  { title: 'Bullet list', desc: 'Simple bulleted list', kw: ['bullet', 'unordered', 'ul', 'list'], icon: <VscListUnordered />,
    run: (e, r) => e.chain().focus().deleteRange(r).toggleBulletList().run() },
  { title: 'Numbered list', desc: 'Ordered list', kw: ['numbered', 'ordered', 'ol', 'list'], icon: <VscListOrdered />,
    run: (e, r) => e.chain().focus().deleteRange(r).toggleOrderedList().run() },
  { title: 'To-do list', desc: 'Checklist with checkboxes', kw: ['todo', 'task', 'checkbox', 'check'], icon: <VscChecklist />,
    run: (e, r) => e.chain().focus().deleteRange(r).toggleTaskList().run() },
  { title: 'Quote', desc: 'Capture a quotation', kw: ['quote', 'blockquote'], icon: <VscQuote />,
    run: (e, r) => e.chain().focus().deleteRange(r).toggleBlockquote().run() },
  { title: 'Code block', desc: 'Syntax-highlighted code', kw: ['code', 'codeblock', 'pre'], icon: <VscCode />,
    run: (e, r) => e.chain().focus().deleteRange(r).toggleCodeBlock().run() },
  { title: 'Divider', desc: 'Visually divide blocks', kw: ['divider', 'hr', 'rule', 'line'], icon: <VscHorizontalRule />,
    run: (e, r) => e.chain().focus().deleteRange(r).setHorizontalRule().run() },
  { title: 'Table', desc: 'Choose rows and columns', kw: ['table', 'grid'], icon: <VscTable />,
    run: (e, r, ctx) => {
      e.chain().focus().deleteRange(r).run();
      if (ctx?.onInsertTable) ctx.onInsertTable();
      else e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    } },
  { title: 'Image', desc: 'Upload an image', kw: ['image', 'img', 'photo', 'picture'], icon: <IoImageOutline />,
    run: (e, r, ctx) => { e.chain().focus().deleteRange(r).run(); ctx?.onImage?.(); } },
];

// ── SlashMenu list (rendered inside the portal) ─────────────────────────────
const SlashMenu = forwardRef(function SlashMenu({ items, onSelect }, ref) {
  const [selected, setSelected] = useState(0);
  useEffect(() => setSelected(0), [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: (event) => {
      if (event.key === 'ArrowUp') { setSelected((s) => (s + items.length - 1) % items.length); return true; }
      if (event.key === 'ArrowDown') { setSelected((s) => (s + 1) % items.length); return true; }
      if (event.key === 'Enter') { if (items[selected]) { onSelect(items[selected]); } return true; }
      return false;
    },
  }));

  if (!items.length) return <div className="slash-menu"><div className="slash-menu__empty">No matches</div></div>;
  return (
    <div className="slash-menu">
      {items.map((item, i) => (
        <button
          key={item.title}
          className={`slash-menu__item${i === selected ? ' is-active' : ''}`}
          onMouseEnter={() => setSelected(i)}
          onMouseDown={(e) => { e.preventDefault(); onSelect(item); }}
        >
          <span className="slash-menu__icon">{item.icon}</span>
          <span className="slash-menu__text">
            <span className="slash-menu__title">{item.title}</span>
            <span className="slash-menu__desc">{item.desc}</span>
          </span>
        </button>
      ))}
    </div>
  );
});

// ── Portal component — lives in the React tree, positions via useLayoutEffect ─
// useLayoutEffect fires after React + TipTap have both committed to the DOM,
// so clientRect() is reliable here (no timing race with the suggestion mark).
export function SlashMenuPortal({ state }) {
  const popupRef = useRef(null);
  const menuRef  = useRef(null);

  // Register the keyboard handler with the extension after every state change.
  // This runs in useLayoutEffect so menuRef.current is already set.
  useLayoutEffect(() => {
    if (!state) return;
    state.setKeyHandler?.((event) => menuRef.current?.onKeyDown(event) ?? false);
  }, [state]);

  // Position the popup after every state change (items filter, new open, etc.)
  // useLayoutEffect fires AFTER TipTap has committed its DOM update, so
  // clientRect() reliably returns the suggestion mark's real coordinates here.
  useLayoutEffect(() => {
    const el = popupRef.current;
    if (!el || !state) return;

    const rect = state.clientRect?.();
    if (!rect || (rect.top === 0 && rect.left === 0 && rect.bottom === 0)) return;

    const margin = 8;
    const width  = el.offsetWidth  || 260;
    const height = el.offsetHeight || 300;
    let left = rect.left;
    let top  = rect.bottom + 6;

    if (left + width > window.innerWidth - margin)  left = window.innerWidth  - width  - margin;
    if (top + height > window.innerHeight - margin) top  = rect.top - height - 6;

    el.style.left = `${Math.max(margin, left)}px`;
    el.style.top  = `${Math.max(margin, top)}px`;
    el.style.visibility = 'visible';
  }, [state]);

  if (!state) return null;

  return createPortal(
    <div
      ref={popupRef}
      className="slash-popup"
      style={{ position: 'fixed', zIndex: 2000, visibility: 'hidden' }}
    >
      <SlashMenu
        ref={menuRef}
        items={state.items}
        onSelect={state.onSelect}
      />
    </div>,
    document.body
  );
}

// ── The extension ───────────────────────────────────────────────────────────
// Instead of managing its own DOM/ReactRenderer, this extension just calls
// onOpen/onUpdate/onClose so the host React component can manage state.
export const SlashCommand = Extension.create({
  name: 'slashCommand',
  addOptions() {
    return { onImage: null, onCreatePage: null, onInsertTable: null, onOpen: null, onUpdate: null, onClose: null };
  },
  addProseMirrorPlugins() {
    const ext = this;
    // keyHandler is set by the portal component so the extension can forward
    // keyboard events (ArrowUp/Down/Enter) into the React menu.
    let keyHandler = null;

    return [
      Suggestion({
        editor: this.editor,
        char: '/',
        startOfLine: false,
        allowSpaces: false,
        items: ({ query }) => {
          const q = query.toLowerCase();
          if (!q) return COMMANDS;
          return COMMANDS.filter(
            (c) => c.title.toLowerCase().includes(q) || c.kw.some((k) => k.includes(q))
          );
        },
        command: ({ editor, range, props: item }) => {
          const ctx = {
            onImage: ext.options.onImage,
            onCreatePage: ext.options.onCreatePage,
            onInsertTable: ext.options.onInsertTable,
          };
          item.run(editor, range, ctx);
        },
        render: () => ({
          onStart: (props) => {
            const ctx = {
              onImage: ext.options.onImage,
              onCreatePage: ext.options.onCreatePage,
              onInsertTable: ext.options.onInsertTable,
            };
            ext.options.onOpen?.({
              items: props.items,
              clientRect: props.clientRect,
              onSelect: (item) => {
                item.run(props.editor, props.range, ctx);
                ext.options.onClose?.();
              },
              setKeyHandler: (fn) => { keyHandler = fn; },
            });
          },
          onUpdate: (props) => {
            const ctx = {
              onImage: ext.options.onImage,
              onCreatePage: ext.options.onCreatePage,
              onInsertTable: ext.options.onInsertTable,
            };
            ext.options.onUpdate?.({
              items: props.items,
              clientRect: props.clientRect,
              onSelect: (item) => {
                item.run(props.editor, props.range, ctx);
                ext.options.onClose?.();
              },
              setKeyHandler: (fn) => { keyHandler = fn; },
            });
          },
          onKeyDown: ({ event }) => {
            if (event.key === 'Escape') { ext.options.onClose?.(); return true; }
            return keyHandler?.(event) ?? false;
          },
          onExit: () => {
            keyHandler = null;
            ext.options.onClose?.();
          },
        }),
      }),
    ];
  },
});

export default SlashCommand;

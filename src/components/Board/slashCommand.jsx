import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { Extension } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import { ReactRenderer } from '@tiptap/react';
import {
  VscSymbolString, VscListUnordered, VscListOrdered, VscChecklist,
  VscQuote, VscCode, VscHorizontalRule, VscTable, VscFile,
} from 'react-icons/vsc';
import { IoImageOutline } from 'react-icons/io5';

// ── Command catalogue (Notion-style "/" blocks) ─────────────────────────────
// Each `run(editor, range, ctx)` first removes the typed "/query", then applies
// the block. `ctx.onImage` opens the editor's file picker.
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
  { title: 'Table', desc: 'Insert a 3×3 table', kw: ['table', 'grid'], icon: <VscTable />,
    run: (e, r) => e.chain().focus().deleteRange(r).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { title: 'Image', desc: 'Upload an image', kw: ['image', 'img', 'photo', 'picture'], icon: <IoImageOutline />,
    run: (e, r, ctx) => { e.chain().focus().deleteRange(r).run(); ctx?.onImage?.(); } },
];

// ── Popup list component ────────────────────────────────────────────────────
const SlashMenu = forwardRef(function SlashMenu({ items, command }, ref) {
  const [selected, setSelected] = useState(0);
  useEffect(() => setSelected(0), [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === 'ArrowUp') { setSelected((s) => (s + items.length - 1) % items.length); return true; }
      if (event.key === 'ArrowDown') { setSelected((s) => (s + 1) % items.length); return true; }
      if (event.key === 'Enter') { if (items[selected]) command(items[selected]); return true; }
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
          onMouseDown={(e) => { e.preventDefault(); command(item); }}
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

function rectIsInEditor(rect, editorRect) {
  return rect && editorRect
    && rect.left >= editorRect.left - 1
    && rect.right <= editorRect.right + 1
    && rect.top >= editorRect.top - 1
    && rect.bottom <= editorRect.bottom + 1;
}

function getAnchorRect({ editor, range, clientRect }) {
  const editorRect = editor?.view?.dom?.getBoundingClientRect();
  const markerRect = clientRect?.();

  if (rectIsInEditor(markerRect, editorRect)) return markerRect;

  // TipTap's temporary suggestion marker can briefly report (0, 0), which
  // puts the menu at the viewport edge. The document position is stable and
  // gives us the actual caret coordinates in that case.
  if (editor?.view && range) {
    const caretRect = editor.view.coordsAtPos(range.to);
    if (rectIsInEditor(caretRect, editorRect)) return caretRect;
  }
  return null;
}

function positionPopup(el, props) {
  const rect = getAnchorRect(props);
  if (!rect) return false;
  const margin = 8;
  const width = el.offsetWidth || 260;
  const height = el.offsetHeight || 280;
  let left = rect.left;
  let top = rect.bottom + 6;
  if (left + width > window.innerWidth - margin) left = window.innerWidth - width - margin;
  if (top + height > window.innerHeight - margin) top = rect.top - height - 6; // flip above
  el.style.position = 'fixed';
  el.style.left = `${Math.max(margin, left)}px`;
  el.style.top = `${Math.max(margin, top)}px`;
  el.style.zIndex = '2000';
  return true;
}

function makeRenderer() {
  let component;
  let el;
  let positionFrame;

  const schedulePosition = (props, attempt = 0) => {
    cancelAnimationFrame(positionFrame);
    positionFrame = requestAnimationFrame(() => {
      positionFrame = null;
      if (!el) return;
      if (positionPopup(el, props)) {
        el.style.visibility = 'visible';
      } else if (attempt < 2) {
        schedulePosition(props, attempt + 1);
      }
    });
  };

  return {
    onStart: (props) => {
      component = new ReactRenderer(SlashMenu, { props, editor: props.editor });
      el = document.createElement('div');
      el.className = 'slash-popup';
      el.style.visibility = 'hidden';
      document.body.appendChild(el);
      el.appendChild(component.element);
      schedulePosition(props);
    },
    onUpdate: (props) => {
      component?.updateProps(props);
      schedulePosition(props);
    },
    onKeyDown: (props) => {
      if (props.event.key === 'Escape') { el?.remove(); el = null; return true; }
      return component?.ref?.onKeyDown(props) ?? false;
    },
    onExit: () => {
      cancelAnimationFrame(positionFrame);
      positionFrame = null;
      el?.remove();
      el = null;
      component?.destroy();
      component = null;
    },
  };
}

// ── The extension ───────────────────────────────────────────────────────────
export const SlashCommand = Extension.create({
  name: 'slashCommand',
  addOptions() {
    return { onImage: null, onCreatePage: null };
  },
  addProseMirrorPlugins() {
    const ctx = { onImage: this.options.onImage, onCreatePage: this.options.onCreatePage };
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
        command: ({ editor, range, props }) => props.run(editor, range, ctx),
        render: makeRenderer,
      }),
    ];
  },
});

export default SlashCommand;

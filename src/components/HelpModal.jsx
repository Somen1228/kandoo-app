/* eslint-disable react/no-unescaped-entities */
import { useState, useRef, useEffect } from 'react';
import {
  VscClose, VscRocket, VscPreview, VscEdit, VscChecklist, VscBold,
  VscSearch, VscDiscard, VscArchive, VscMortarBoard, VscNote, VscSave,
} from 'react-icons/vsc';
import { IoImageOutline, IoColorPaletteOutline, IoSwapHorizontalOutline } from 'react-icons/io5';

// Small helpers for consistent inline styling
const Kbd = ({ children }) => (
  <kbd style={{
    fontFamily: 'monospace', fontSize: '0.78em',
    background: 'var(--theme-bg-hover)',
    border: '1px solid var(--theme-border)',
    borderRadius: '4px',
    padding: '1px 6px',
    color: 'var(--theme-text-primary)',
    whiteSpace: 'nowrap',
  }}>{children}</kbd>
);

const Tip = ({ children }) => (
  <div style={{
    marginTop: '0.75rem',
    padding: '0.6rem 0.8rem',
    background: 'var(--theme-bg-secondary)',
    borderLeft: '3px solid var(--theme-accent)',
    borderRadius: '0.25rem',
    fontSize: '0.85rem',
    color: 'var(--theme-text-secondary)',
    lineHeight: 1.55,
  }}>{children}</div>
);

const Steps = ({ items }) => (
  <ol style={{ paddingLeft: '1.25rem', margin: '0.5rem 0', color: 'var(--theme-text-primary)', fontSize: '0.9rem', lineHeight: 1.7 }}>
    {items.map((it, i) => <li key={i} style={{ marginBottom: '0.25rem' }}>{it}</li>)}
  </ol>
);

const H2 = ({ children }) => (
  <h2 style={{ fontSize: '1.4rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--theme-text-primary)' }}>{children}</h2>
);

const P = ({ children }) => (
  <p style={{ color: 'var(--theme-text-secondary)', fontSize: '0.92rem', lineHeight: 1.6, margin: '0.5rem 0' }}>{children}</p>
);

const SubH = ({ children }) => (
  <h3 style={{ fontSize: '0.85rem', fontWeight: 600, marginTop: '1.25rem', marginBottom: '0.25rem', color: 'var(--theme-text-primary)', letterSpacing: '0.03em', textTransform: 'uppercase', opacity: 0.75 }}>{children}</h3>
);

// ── Section content ─────────────────────────────────────────────────────────

const SECTIONS = [
  {
    id: 'getting-started',
    icon: <VscRocket />,
    label: 'Getting started',
    content: (
      <>
        <H2>Welcome to Kandoo</H2>
        <P>Kandoo is a calm, focused Kanban board for managing tasks. Pick a tab from the left to learn about each feature.</P>
        <SubH>The basics</SubH>
        <Steps items={[
          <>A starter board is created the first time Kandoo opens.</>,
          <>Click a card to add tasks. Drag cards or tasks to reorder.</>,
          <>Everything autosaves privately on this Mac. No account or internet connection is required.</>,
          <>Use JSON export to keep a separate backup or move boards to another Mac.</>,
        ]} />
        <Tip>Press <Kbd>⌘ / Ctrl</Kbd> + <Kbd>Shift</Kbd> + <Kbd>1</Kbd> anywhere to reopen this guide.</Tip>
      </>
    ),
  },
  {
    id: 'boards',
    icon: <VscPreview />,
    label: 'Boards',
    content: (
      <>
        <H2>Boards</H2>
        <P>Boards are the top-level workspace — think "project" or "area of focus". Each board holds its own cards and tasks.</P>
        <SubH>Create</SubH>
        <Steps items={[
          <>Hover the left edge to open the sidebar.</>,
          <>Click <strong>+ New Project</strong>.</>,
        ]} />
        <SubH>Rename</SubH>
        <P>Three ways:</P>
        <Steps items={[
          <>Double-click the board title in the header.</>,
          <>Double-click the board name in the sidebar.</>,
          <>Right-click the sidebar entry → <strong>Rename board</strong>.</>,
        ]} />
        <SubH>Delete</SubH>
        <P>Right-click a sidebar entry → <strong>Delete board</strong>. A confirmation modal appears. (Disabled if it's your only board.)</P>
        <SubH>Switch</SubH>
        <P>Click any board in the sidebar to switch. The active board is highlighted.</P>
      </>
    ),
  },
  {
    id: 'cards',
    icon: <VscEdit />,
    label: 'Cards (columns)',
    content: (
      <>
        <H2>Cards</H2>
        <P>Cards are the vertical columns inside a board — typically representing a workflow stage like "To-do" / "In Progress" / "Done".</P>
        <SubH>Create</SubH>
        <Steps items={[<>Click <strong>+ Add Card</strong> at the end of the board, type a title, pick a colour.</>]} />
        <SubH>Rename</SubH>
        <Steps items={[
          <>Double-click the card title.</>,
          <>Or right-click the header → <strong>Rename card</strong>.</>,
          <>Or click the three-dots menu → <strong>Rename Card</strong>.</>,
        ]} />
        <SubH>Change colour</SubH>
        <P>Right-click header → <strong>Change colour</strong> (or use the dots menu). Pick a preset swatch or click the rainbow circle for any custom hex. Title text auto-contrasts to stay readable.</P>
        <SubH>Delete</SubH>
        <P>Right-click → <strong>Delete card</strong>. Default columns (To-do / In-Progress / Done) are protected — rename them first if you want to delete.</P>
        <SubH>Reorder</SubH>
        <P>Drag the card header sideways to move it. The other cards animate out of the way.</P>
      </>
    ),
  },
  {
    id: 'tasks',
    icon: <VscChecklist />,
    label: 'Tasks',
    content: (
      <>
        <H2>Tasks</H2>
        <P>Tasks are the items inside cards. They support rich text and image attachments.</P>
        <SubH>Create</SubH>
        <Steps items={[
          <>Click <strong>+ Create Task</strong> at the bottom of a card.</>,
          <>Press <Kbd>N</Kbd> to quick-add a task to the first card of the active board.</>,
          <>Right-click <strong>Create Task</strong> → <strong>Paste as task</strong> to drop clipboard text in directly.</>,
        ]} />
        <SubH>Edit</SubH>
        <Steps items={[
          <>Double-click the task text.</>,
          <>Or click the pencil icon on the task.</>,
          <>Or right-click → <strong>Edit task</strong>.</>,
        ]} />
        <SubH>Mark done</SubH>
        <P>Click the check icon (or right-click → <strong>Mark as done</strong>). Done tasks are dimmed and struck-through. The state persists across reloads and is searchable with <Kbd>has:done</Kbd>.</P>
        <SubH>Other actions</SubH>
        <P>Right-click any task for: <strong>Copy text</strong>, <strong>Duplicate</strong>, <strong>Delete</strong>.</P>
        <SubH>Reorder & move</SubH>
        <P>Drag a task within its card to reorder, or drag it across to another card. Tasks slide out of the way as you move.</P>
      </>
    ),
  },
  {
    id: 'notes',
    icon: <VscNote />,
    label: (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        Notes
        <span style={{
          fontSize: '0.55rem', letterSpacing: '0.05em', fontWeight: 700,
          padding: '1px 5px', borderRadius: 999,
          background: 'var(--theme-accent)', color: 'white', textTransform: 'uppercase',
        }}>Beta</span>
      </span>
    ),
    content: (
      <>
        <H2>
          Notes <span style={{
            fontSize: '0.65rem', letterSpacing: '0.05em', fontWeight: 700,
            padding: '2px 8px', borderRadius: 999,
            background: 'var(--theme-accent)', color: 'white',
            textTransform: 'uppercase', verticalAlign: 'middle', marginLeft: 6,
          }}>Beta</span>
        </H2>
        <P>
          Each board has a <strong>Notes</strong> tab next to <strong>Todos</strong>. Notes are
          free-form rich-text pages — think Google Keep or a tiny Notion — with their own toolbar,
          image attachments, code blocks, and markdown auto-conversion on paste.
        </P>

        <SubH>Switch to notes</SubH>
        <P>
          Click the <strong>Notes</strong> tab at the top of any board. You&apos;ll see a row of
          note tabs and the active note&apos;s canvas below.
        </P>

        <SubH>Create / delete</SubH>
        <Steps items={[
          <>Click <strong>+ New</strong> at the end of the tabs row. A small dialog asks for a title — no colour required.</>,
          <>The newly created note becomes active automatically.</>,
          <>Click the <strong>×</strong> on any tab to delete that note. <Kbd>⌘/Ctrl + Z</Kbd> restores it.</>,
        ]} />

        <SubH>Rename</SubH>
        <P>
          Click the large title at the top of the canvas to edit it inline. <Kbd>Enter</Kbd> saves,
          <Kbd>Esc</Kbd> cancels.
        </P>

        <SubH>Editor &amp; toolbar</SubH>
        <P>The notes toolbar includes:</P>
        <Steps items={[
          <>Heading selector (Normal / H1–H6)</>,
          <>Bold, italic, underline, strikethrough, superscript, subscript, inline code, clear formatting</>,
          <>Text colour &amp; highlight palettes, including custom colours</>,
          <>Bullet, numbered, and aligned checklist items</>,
          <>Alignment (left / center / right / justify), indent / outdent</>,
          <>Quote, code block with auto language detection, horizontal rule, hyperlink</>,
          <>Configurable tables with row, column, header, and delete controls</>,
          <>Image upload — auto-compressed, then resizable with crop-ratio and focal-position controls</>,
        ]} />
        <P>
          The toolbar stays on one compact row. On narrower windows, scroll it horizontally with
          a trackpad or <Kbd>Shift + wheel</Kbd> instead of losing writing space to wrapped rows.
        </P>

        <SubH>Right-click menus</SubH>
        <P>
          Right-click selected text, links, checklist items, images, tables, or the empty writing
          canvas for actions specific to that content. Pages in the Notes sidebar also have their
          own context menu.
        </P>

        <SubH>Markdown auto-paste</SubH>
        <P>
          Paste markdown into a note (e.g. <Kbd># Title</Kbd>, <Kbd>**bold**</Kbd>,
          <Kbd>- list</Kbd>, <Kbd>```code```</Kbd>) and it converts to rich text automatically.
          Plain text pastes as plain text.
        </P>

        <SubH>Paper vs Wide layout</SubH>
        <P>
          Use the <Kbd>⛶ Wide</Kbd> / <Kbd>⧉ Paper</Kbd> toggle in the meta row (next to
          &quot;Edited X ago&quot;) to switch between a centered themed-paper page (default) and a
          full-width canvas. Preference is saved per device.
        </P>

        <SubH>Search</SubH>
        <P>
          Notes are searched alongside todos. Matches in note content show up in the same result
          counter; the cross-board dropdown also covers them.
        </P>

        <Tip>
          Select an image to reveal resize and crop controls. Place the cursor inside a table
          and click the highlighted table icon to add or remove rows and columns. Type <Kbd>/</Kbd>
          for block commands.
        </Tip>
      </>
    ),
  },
  {
    id: 'rich-text',
    icon: <VscBold />,
    label: 'Rich text',
    content: (
      <>
        <H2>Rich text editor</H2>
        <P>The task editor supports bold, italic, and underline — like a tiny WYSIWYG box.</P>
        <SubH>Toolbar</SubH>
        <P>While editing or creating a task, click the <strong>B / I / U</strong> buttons above the text area to format selected text.</P>
        <SubH>Keyboard shortcuts</SubH>
        <P style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span><Kbd>⌘ / Ctrl</Kbd> + <Kbd>B</Kbd> Bold</span>
          <span><Kbd>⌘ / Ctrl</Kbd> + <Kbd>I</Kbd> Italic</span>
          <span><Kbd>⌘ / Ctrl</Kbd> + <Kbd>U</Kbd> Underline</span>
        </P>
        <SubH>Other</SubH>
        <P><Kbd>Enter</Kbd> saves the task. <Kbd>Shift</Kbd> + <Kbd>Enter</Kbd> inserts a line break. <Kbd>Esc</Kbd> cancels.</P>
        <Tip>Pasted text is automatically converted to plain text — no rogue formatting from web pages or docs.</Tip>
      </>
    ),
  },
  {
    id: 'images',
    icon: <IoImageOutline />,
    label: 'Images',
    content: (
      <>
        <H2>Image attachments</H2>
        <P>Attach images to any task. They&apos;re compressed and stored alongside the task data on this Mac.</P>
        <SubH>Upload</SubH>
        <Steps items={[
          <>Start editing a task (or creating a new one).</>,
          <>Click the dashed <strong>+ Add image</strong> button below the text area.</>,
          <>Pick one or more images (max 10 MB each, multi-select supported).</>,
          <>Images are auto-compressed to ≤ 900px, JPEG, ~82% quality.</>,
        ]} />
        <SubH>View</SubH>
        <P>Click any thumbnail in a task → opens a full-screen viewer with prev/next arrows, dot navigation, and arrow-key controls. <Kbd>Esc</Kbd> closes.</P>
        <SubH>Remove</SubH>
        <P>While editing, click the red × on any thumbnail.</P>
        <SubH>Search</SubH>
        <P>Use <Kbd>has:image</Kbd> in the search bar to find tasks with attachments.</P>
      </>
    ),
  },
  {
    id: 'drag-drop',
    icon: <IoSwapHorizontalOutline />,
    label: 'Drag & drop',
    content: (
      <>
        <H2>Drag & drop</H2>
        <P>Powered by @dnd-kit — supports mouse, touch, and keyboard.</P>
        <SubH>Cards</SubH>
        <P>Grab a card by its title bar and drag sideways to reorder columns.</P>
        <SubH>Tasks</SubH>
        <Steps items={[
          <>Drag a task <strong>up or down</strong> to reorder within its card.</>,
          <>Drag a task <strong>onto another card</strong> to move it. Other tasks slide out of the way live as you drag.</>,
        ]} />
        <Tip>Drag activates after moving ~8px so clicks still work for buttons inside tasks.</Tip>
      </>
    ),
  },
  {
    id: 'search',
    icon: <VscSearch />,
    label: 'Search',
    content: (
      <>
        <H2>Search</H2>
        <P>Search the active board (and peek at matches across other boards) with multi-keyword AND, filters, and jump-to-match navigation.</P>
        <SubH>Open</SubH>
        <P>Click the search pill, or press <Kbd>⌘ / Ctrl</Kbd> + <Kbd>K</Kbd>, or just <Kbd>/</Kbd>.</P>
        <SubH>Multi-keyword</SubH>
        <P>Space-separated words must <strong>all</strong> appear in the task (order doesn't matter).</P>
        <P><Kbd>urgent bug</Kbd> → tasks containing both "urgent" and "bug" somewhere.</P>
        <SubH>Filters</SubH>
        <Steps items={[
          <><Kbd>has:image</Kbd> — tasks with image attachments.</>,
          <><Kbd>has:done</Kbd> — completed tasks.</>,
          <>Combine freely: <Kbd>review has:image</Kbd>.</>,
        ]} />
        <SubH>Modes</SubH>
        <P>The funnel icon next to the search bar toggles:</P>
        <Steps items={[
          <><strong>Highlight</strong> (default) — all tasks visible, matches highlighted in yellow.</>,
          <><strong>Filter</strong> — non-matching tasks and empty cards hidden.</>,
        ]} />
        <SubH>Jump between matches</SubH>
        <P><Kbd>Enter</Kbd> jumps to the next match (scrolls into view, accent-bordered). <Kbd>Shift</Kbd> + <Kbd>Enter</Kbd> for previous. Cycles. The counter shows "2 / 5".</P>
        <SubH>Other boards</SubH>
        <P>When other boards also have matches, a <Kbd>+N ▾</Kbd> chip appears next to the filter button. Click → dropdown listing those boards with match counts. Click a board to switch to it.</P>
      </>
    ),
  },
  {
    id: 'undo',
    icon: <VscDiscard />,
    label: 'Undo / Redo',
    content: (
      <>
        <H2>Undo / Redo</H2>
        <P>Every meaningful change is added to a history stack — drag-drop, edit, delete, rename, colour change, anything.</P>
        <P style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span><Kbd>⌘ / Ctrl</Kbd> + <Kbd>Z</Kbd> Undo</span>
          <span><Kbd>⌘ / Ctrl</Kbd> + <Kbd>Shift</Kbd> + <Kbd>Z</Kbd> Redo</span>
          <span><Kbd>⌘ / Ctrl</Kbd> + <Kbd>Y</Kbd> Redo (Windows-style)</span>
        </P>
        <SubH>Granularity</SubH>
        <P>Rapid changes (e.g. dragging) collapse into one undo step thanks to a 400 ms debounce. History caps at 50 steps.</P>
        <Tip>Browser's native <Kbd>⌘+Z</Kbd> still works while typing in a text field — Kandoo's undo only fires when no input is focused.</Tip>
      </>
    ),
  },
  {
    id: 'themes',
    icon: <IoColorPaletteOutline />,
    label: 'Themes',
    content: (
      <>
        <H2>Themes</H2>
        <P>Multiple bundled themes — light, dark, and accent variants. Every UI surface follows the active theme via CSS variables.</P>
        <SubH>Switch</SubH>
        <P>Click the colour-filter icon in the header → pick a theme. Or press <Kbd>T</Kbd> to cycle through them.</P>
        <SubH>Card colours</SubH>
        <P>Card background colours adapt automatically (lighter palette in light themes, deeper palette in dark themes). Custom hex colours you pick are kept as-is, with the title text auto-contrasting.</P>
      </>
    ),
  },
  {
    id: 'export-import',
    icon: <VscArchive />,
    label: 'Export / Import',
    content: (
      <>
        <H2>Export / Import</H2>
        <P>Back up your boards as files or move them between Kandoo installations.</P>
        <SubH>Export</SubH>
        <Steps items={[
          <>Click the <strong>Export</strong> icon in the header.</>,
          <>Pick <strong>JSON</strong> (full backup — re-importable) or <strong>XLSX</strong> (Excel / Google Sheets).</>,
          <>Choose <strong>current board</strong> or <strong>all boards</strong>.</>,
          <>Click <strong>Download</strong>.</>,
        ]} />
        <SubH>XLSX structure</SubH>
        <P>Each board becomes a sheet. Card titles become columns. Tasks become rows. Rich-text formatting is flattened to plain text; image attachments are noted as "[N images]". Drag-drop into Google Sheets or open in Excel.</P>
        <SubH>Import</SubH>
        <Steps items={[
          <>Click <strong>Export</strong> icon → <strong>Import</strong> section → <strong>Select File</strong>.</>,
          <>Pick a previously exported JSON file.</>,
          <>Review the preview ("About to import 3 boards: Foo, Bar, Baz") and confirm.</>,
        ]} />
        <Tip>Imported boards are <strong>appended</strong>, never overwriting. IDs are regenerated to prevent collisions; duplicate titles get an <em>(imported)</em> suffix.</Tip>
      </>
    ),
  },
  {
    id: 'local-storage',
    icon: <VscSave />,
    label: 'Local storage',
    content: (
      <>
        <H2>Local storage</H2>
        <P>Kandoo is local-first. The desktop app does not require an account, server, or internet connection.</P>
        <SubH>How it works</SubH>
        <Steps items={[
          <>The macOS app stores the workspace in a SQLite database inside Kandoo&apos;s application data folder.</>,
          <>Changes autosave shortly after you edit a board, card, task, or note.</>,
          <>The save indicator in the header shows whether changes are saved or still being written.</>,
          <>JSON exports are complete, re-importable backups. Keep one somewhere separate from this Mac.</>,
        ]} />
        <Tip>Cloud backup and multi-device sync can be added later as an optional service without changing local ownership of the workspace.</Tip>
      </>
    ),
  },
  {
    id: 'shortcuts',
    icon: <VscMortarBoard />,
    label: 'Keyboard shortcuts',
    content: (
      <>
        <H2>Keyboard shortcuts</H2>
        <P>Quick reference — these work anywhere on the board:</P>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.5rem', fontSize: '0.88rem' }}>
          <tbody>
            {[
              ['Open this Help guide',  <><Kbd>⌘ / Ctrl</Kbd> + <Kbd>Shift</Kbd> + <Kbd>1</Kbd></>],
              ['Focus search',          <><Kbd>⌘ / Ctrl</Kbd> + <Kbd>K</Kbd> or <Kbd>/</Kbd></>],
              ['Quick-add task',        <Kbd key="quick-add">N</Kbd>],
              ['Cycle theme',           <Kbd key="cycle-theme">T</Kbd>],
              ['Undo',                  <><Kbd>⌘ / Ctrl</Kbd> + <Kbd>Z</Kbd></>],
              ['Redo',                  <><Kbd>⌘ / Ctrl</Kbd> + <Kbd>Shift</Kbd> + <Kbd>Z</Kbd></>],
              ['Bold / Italic / Underline (while editing)', <><Kbd>⌘ / Ctrl</Kbd> + <Kbd>B</Kbd> / <Kbd>I</Kbd> / <Kbd>U</Kbd></>],
              ['Save edit / Next match', <Kbd key="save-edit">Enter</Kbd>],
              ['Previous match',         <><Kbd>Shift</Kbd> + <Kbd>Enter</Kbd></>],
              ['Newline in editor',      <><Kbd>Shift</Kbd> + <Kbd>Enter</Kbd></>],
              ['Close overlay / cancel', <Kbd key="close-overlay">Esc</Kbd>],
            ].map(([label, keys], i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--theme-border)' }}>
                <td style={{ padding: '8px 0', color: 'var(--theme-text-secondary)' }}>{label}</td>
                <td style={{ padding: '8px 0', textAlign: 'right' }}>{keys}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    ),
  },
];

function HelpModal({ isOpen, onClose }) {
  const [activeId, setActiveId] = useState(SECTIONS[0].id);
  const modalRef = useRef(null);
  const contentRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const onMouse = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', onMouse);
    return () => document.removeEventListener('mousedown', onMouse);
  }, [isOpen, onClose]);

  // Scroll content to top whenever section changes
  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [activeId]);

  if (!isOpen) return null;
  const active = SECTIONS.find((s) => s.id === activeId) || SECTIONS[0];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div
        ref={modalRef}
        style={{
          background: 'var(--theme-bg-primary)',
          border: '1px solid var(--theme-border)',
          borderRadius: '0.75rem',
          width: '92%', maxWidth: '1000px',
          height: '85vh',
          boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '1rem 1.25rem',
          borderBottom: '1px solid var(--theme-border)',
        }}>
          <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--theme-text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <VscMortarBoard /> Kandoo Help
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-text-secondary)', fontSize: '1.25rem', display: 'flex' }}
            title="Close (Esc)"
          >
            <VscClose />
          </button>
        </div>

        {/* Body: sidebar + content */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* Sidebar */}
          <nav style={{
            width: '220px',
            borderRight: '1px solid var(--theme-border)',
            overflowY: 'auto',
            padding: '0.5rem',
            background: 'var(--theme-bg-secondary)',
            flexShrink: 0,
          }}>
            {SECTIONS.map((s) => {
              const isActive = s.id === activeId;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveId(s.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    width: '100%', padding: '8px 10px',
                    borderRadius: '0.375rem',
                    background: isActive ? 'var(--theme-bg-hover)' : 'transparent',
                    border: 'none', cursor: 'pointer',
                    color: isActive ? 'var(--theme-text-primary)' : 'var(--theme-text-secondary)',
                    fontSize: '0.85rem',
                    fontWeight: isActive ? 600 : 400,
                    textAlign: 'left',
                    marginBottom: '2px',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--theme-bg-hover)'; }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{ display: 'flex', fontSize: '1rem', color: isActive ? 'var(--theme-accent)' : 'inherit' }}>{s.icon}</span>
                  {s.label}
                </button>
              );
            })}
          </nav>

          {/* Content */}
          <div
            ref={contentRef}
            style={{
              flex: 1, overflowY: 'auto',
              padding: '1.5rem 1.75rem',
            }}
          >
            {active.content}
            <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--theme-border)', fontSize: '0.75rem', color: 'var(--theme-text-muted)', textAlign: 'center' }}>
              For a full backup, export all boards as JSON from the header.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HelpModal;

/* eslint-disable react/no-unescaped-entities */
import { useState, useRef, useEffect } from 'react';
import {
  VscClose, VscRocket, VscPreview, VscEdit, VscChecklist, VscBold,
  VscSearch, VscDiscard, VscArchive, VscMortarBoard, VscNote, VscSave,
  VscSettingsGear, VscLayoutSidebarLeft, VscCalendar, VscDebugStart,
} from 'react-icons/vsc';
import { IoImageOutline, IoColorPaletteOutline, IoSwapHorizontalOutline } from 'react-icons/io5';

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
        <P>Kandoo is a local-first, all-in-one productivity app for students — Kanban boards, rich notes, and cloud sync in one place. No internet required to get started.</P>
        <SubH>The basics</SubH>
        <Steps items={[
          <>Sign in with Google or email to enable real-time sync across devices, or hit <strong>Continue offline</strong> to stay local.</>,
          <>Your workspace opens to the <strong>Kanban board</strong>. Use the left sidebar to switch boards, open Notes, or jump to Today's tasks.</>,
          <>Everything saves locally first (SQLite on desktop, localStorage on web). Signed-in users also sync to Firestore in real time.</>,
          <>Use the <strong>Settings</strong> gear at the bottom of the sidebar to customise the app — themes, fonts, density, and more.</>,
        ]} />
        <SubH>Navigation at a glance</SubH>
        <Steps items={[
          <><strong>Sidebar left panel</strong> — boards list, Notes, schedule sections (Today / Upcoming / Overdue).</>,
          <><strong>Toolbar</strong> — search, export/import, undo/redo, theme picker.</>,
          <><strong>Menu-bar tray icon</strong> — quick Today view and fast task add without opening the full app.</>,
        ]} />
        <Tip>Press <Kbd>⌘ / Ctrl</Kbd> + <Kbd>Shift</Kbd> + <Kbd>1</Kbd> anywhere to reopen this guide.</Tip>
      </>
    ),
  },
  {
    id: 'ui',
    icon: <VscLayoutSidebarLeft />,
    label: 'UI & Navigation',
    content: (
      <>
        <H2>UI & Navigation</H2>
        <P>Kandoo's desktop app uses a native macOS shell — traffic lights, drag region, and a persistent resizable sidebar.</P>

        <SubH>Sidebar</SubH>
        <Steps items={[
          <>The sidebar is always visible. Drag its right edge to resize (210–360 px). Kandoo remembers your preferred width.</>,
          <>Click the collapse arrow at the top to hide it entirely — drag the edge back out to restore.</>,
          <>At the top: your boards list. Below: <strong>Notes</strong>. Below that: <strong>smart schedule sections</strong> (Today, Upcoming, Overdue).</>,
          <>The Kandoo logo lives at the sidebar footer. Hover it to see it smile.</>,
        ]} />

        <SubH>Smart schedule sections</SubH>
        <P>The sidebar shows live counts for tasks due today, upcoming, and overdue across your active board. Click a section to filter the board to only those tasks.</P>
        <Steps items={[
          <><strong>Today</strong> — tasks due today.</>,
          <><strong>Upcoming</strong> — tasks due in the next 7 days.</>,
          <><strong>Overdue</strong> — tasks past their due date.</>,
          <><strong>Done</strong> — completed tasks.</>,
        ]} />

        <SubH>Toolbar</SubH>
        <P>The top toolbar contains search, export, undo/redo, and theme controls. It's also the drag handle for moving the window — click and drag the empty space to reposition Kandoo on screen.</P>

        <SubH>Menu-bar tray widget</SubH>
        <P>Kandoo lives in your Mac menu bar even when the main window is closed. <strong>Left-click</strong> the tray icon to open the compact Today panel — see overdue + today tasks and add new ones instantly. <strong>Right-click</strong> for Open / Quit.</P>
        <Tip>Closing the main window doesn't quit Kandoo — it hides to the menu bar. Use right-click → Quit to fully exit.</Tip>
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
        <P>Boards are the top-level workspace — think "project" or "area of focus". Each board holds its own columns and tasks.</P>
        <SubH>Create</SubH>
        <Steps items={[
          <>Click <strong>+ New Project</strong> at the bottom of the sidebar boards list.</>,
        ]} />
        <SubH>Rename</SubH>
        <Steps items={[
          <>Double-click the board title in the main header.</>,
          <>Or double-click the board name in the sidebar.</>,
          <>Or right-click the sidebar entry → <strong>Rename board</strong>.</>,
        ]} />
        <SubH>Delete</SubH>
        <P>Right-click a sidebar entry → <strong>Delete board</strong>. Disabled if it's your only board.</P>
        <SubH>Switch</SubH>
        <P>Click any board in the sidebar. The active board is highlighted with the accent colour.</P>
      </>
    ),
  },
  {
    id: 'cards',
    icon: <VscEdit />,
    label: 'Columns',
    content: (
      <>
        <H2>Columns (Cards)</H2>
        <P>Columns are the vertical swimlanes inside a board — typically representing a workflow stage like To-do / In Progress / Done.</P>
        <SubH>Create</SubH>
        <Steps items={[<>Click <strong>+ Add Card</strong> at the end of the board, type a title, pick a colour.</>]} />
        <SubH>Rename</SubH>
        <Steps items={[
          <>Double-click the column title.</>,
          <>Or right-click the header → <strong>Rename card</strong>.</>,
        ]} />
        <SubH>Change colour</SubH>
        <P>Right-click header → <strong>Change colour</strong>. Pick a preset swatch or click the rainbow circle for a custom hex. Title text auto-contrasts.</P>
        <SubH>Delete & reorder</SubH>
        <P>Right-click → <strong>Delete card</strong>. Drag the header sideways to reorder columns.</P>
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
        <P>Tasks live inside columns. They support rich text, image attachments, and due dates.</P>

        <SubH>Create</SubH>
        <Steps items={[
          <>Click <strong>+ Create Task</strong> at the bottom of a column.</>,
          <>Press <Kbd>N</Kbd> to quick-add to the first column of the active board.</>,
          <>Right-click <strong>Create Task</strong> → <strong>Paste as task</strong> to drop clipboard text directly.</>,
        ]} />

        <SubH>Edit</SubH>
        <Steps items={[
          <>Double-click the task text, or click the pencil icon, or right-click → <strong>Edit task</strong>.</>,
          <>While editing, format selected text with <Kbd>⌘B</Kbd> bold, <Kbd>⌘I</Kbd> italic, <Kbd>⌘U</Kbd> underline.</>,
          <><Kbd>Enter</Kbd> saves. <Kbd>Shift+Enter</Kbd> inserts a line break. <Kbd>Esc</Kbd> cancels.</>,
        ]} />

        <SubH>Due dates</SubH>
        <Steps items={[
          <>While editing a task, click the <strong>calendar icon</strong> to pick a due date.</>,
          <>Tasks automatically get a colour-coded chip: <strong>red</strong> = overdue, <strong>amber</strong> = due today, <strong>blue</strong> = upcoming.</>,
          <>Due tasks appear in the sidebar's <strong>Today / Upcoming / Overdue</strong> sections for quick access.</>,
        ]} />

        <SubH>Mark done</SubH>
        <P>Click the check icon (or right-click → <strong>Mark as done</strong>). Done tasks are dimmed and struck through. Searchable with <Kbd>has:done</Kbd>.</P>

        <SubH>Delete behaviour</SubH>
        <P>Controlled in <strong>Settings → Behavior</strong>:</P>
        <Steps items={[
          <><strong>Undo toast</strong> (default) — task disappears with a brief "Undo" toast at the bottom. Click it within 4 seconds to restore.</>,
          <><strong>Confirm dialog</strong> — classic confirmation popup before deleting.</>,
        ]} />

        <SubH>Other actions</SubH>
        <P>Right-click any task for: <strong>Copy text</strong>, <strong>Duplicate</strong>, <strong>Delete</strong>.</P>

        <SubH>Reorder & move</SubH>
        <P>Drag a task up/down to reorder, or across to another column. Tasks animate out of the way live.</P>
      </>
    ),
  },
  {
    id: 'due-dates',
    icon: <VscCalendar />,
    label: 'Due dates & Schedule',
    content: (
      <>
        <H2>Due dates & Schedule</H2>
        <P>Every task can have a due date. Kandoo automatically classifies tasks and surfaces them in the sidebar.</P>

        <SubH>Setting a due date</SubH>
        <Steps items={[
          <>Open a task for editing.</>,
          <>Click the <strong>calendar icon</strong> next to the text area.</>,
          <>Pick a date from the date picker. Clear it by selecting an empty value.</>,
        ]} />

        <SubH>Due date chips</SubH>
        <P>Tasks with due dates show a small chip on their card:</P>
        <Steps items={[
          <><span style={{ color: '#ef4444' }}>●</span> <strong>Red</strong> — overdue (past the due date).</>,
          <><span style={{ color: '#f59e0b' }}>●</span> <strong>Amber</strong> — due today.</>,
          <><span style={{ color: '#3b82f6' }}>●</span> <strong>Blue</strong> — upcoming (within 7 days).</>,
        ]} />

        <SubH>Schedule sections in sidebar</SubH>
        <P>The sidebar shows live counts and lets you filter the board by schedule:</P>
        <Steps items={[
          <>Click <strong>Today</strong> → board shows only tasks due today.</>,
          <>Click <strong>Upcoming</strong> → tasks due in the next 7 days.</>,
          <>Click <strong>Overdue</strong> → tasks past their due date.</>,
          <>Click <strong>Done</strong> → all completed tasks.</>,
          <>Click the same section again (or click a board name) to clear the filter.</>,
        ]} />

        <SubH>Menu-bar Today widget</SubH>
        <P>Left-click the menu-bar tray icon to see all today + overdue tasks at a glance and add new ones — without opening the full app.</P>

        <Tip>Enable <strong>Quick-add sets due = today</strong> in Settings → Behavior so every task added from the tray widget is automatically due today.</Tip>
      </>
    ),
  },
  {
    id: 'notes',
    icon: <VscNote />,
    label: 'Notes',
    content: (
      <>
        <H2>Notes</H2>
        <P>A fully-featured note-taking workspace built into Kandoo — nested pages, slash commands, rich formatting, code blocks, tables, and inline images, all in one place.</P>

        <SubH>Open Notes</SubH>
        <P>Click <strong>Notes</strong> in the sidebar. A two-pane view opens: the <strong>Pages tree</strong> on the left and the <strong>writing canvas</strong> on the right.</P>

        <SubH>Pages tree</SubH>
        <Steps items={[
          <>Click <strong>+</strong> at the top of the tree to create a top-level page.</>,
          <>Hover any page and click its <strong>+</strong> to nest a sub-page inside it.</>,
          <>Click the arrow beside a page to expand/collapse its children.</>,
          <>Click a page title to rename it inline.</>,
          <>Trash icon on hover to delete a page and all its children.</>,
        ]} />

        <SubH>Slash commands ( / )</SubH>
        <P>Type <Kbd>/</Kbd> anywhere in the canvas to open the block command menu:</P>
        <Steps items={[
          <><strong>/page</strong> — insert a link to a new sub-page (creates it automatically).</>,
          <><strong>/h1, /h2, /h3</strong> — headings.</>,
          <><strong>/bullet, /numbered, /todo</strong> — list types.</>,
          <><strong>/code</strong> — syntax-highlighted code block.</>,
          <><strong>/quote</strong> — block quote.</>,
          <><strong>/table</strong> — insert a table.</>,
          <><strong>/image</strong> — open image picker.</>,
          <><strong>/divider</strong> — horizontal rule.</>,
        ]} />

        <SubH>Toolbar formatting</SubH>
        <Steps items={[
          <>Font family and size selectors.</>,
          <>Bold, italic, underline, strikethrough, superscript, subscript, inline code.</>,
          <>Text colour and highlight palettes.</>,
          <>Alignment (left / center / right / justify), indent / outdent.</>,
          <>Bullet, numbered, and to-do (checklist) lists.</>,
          <>Block quote, code block, horizontal rule, hyperlink.</>,
          <>Table controls — insert rows/columns, toggle headers, delete.</>,
          <>Image upload — paste, drag-drop, or click to pick.</>,
        ]} />

        <SubH>Bubble menu</SubH>
        <P>Select any text to get a floating quick-format bar — bold, italic, underline, colour, and link in one click.</P>

        <SubH>Paper vs Wide layout</SubH>
        <P>Toggle between <strong>Paper</strong> (centred, themed page feel) and <strong>Wide</strong> (full-width canvas) using the toggle next to "Edited X ago". Preference is saved per device. Default controlled in <strong>Settings → Editor</strong>.</P>

        <SubH>Inline images</SubH>
        <P>Paste an image, drag-drop a file, or use <Kbd>/image</Kbd> to insert at the cursor position. Images are stored as compressed base64 inside the note.</P>

        <Tip>Type <Kbd>/</Kbd> to insert anything — headings, lists, code blocks, pages — without touching the toolbar.</Tip>
      </>
    ),
  },
  {
    id: 'settings',
    icon: <VscSettingsGear />,
    label: 'Settings',
    content: (
      <>
        <H2>Settings</H2>
        <P>Open Settings by clicking the <strong>gear icon</strong> at the bottom of the sidebar. Four panels give you full control over how Kandoo looks and behaves.</P>

        <SubH>Appearance</SubH>
        <Steps items={[
          <><strong>Theme</strong> — choose from all bundled light/dark themes via the grid.</>,
          <><strong>Accent colour</strong> — 8 presets or pick any custom colour. Applied across the entire UI.</>,
          <><strong>Density</strong> — Normal or Compact. Compact reduces spacing throughout for more content on screen.</>,
          <><strong>Reduce motion</strong> — disables animations for accessibility.</>,
          <><strong>Custom theme</strong> — import/export theme JSON to share or back up your theme.</>,
        ]} />

        <SubH>Editor</SubH>
        <Steps items={[
          <><strong>Note font family</strong> — Default, Sans, Serif, or Mono.</>,
          <><strong>Font size</strong> — slider from 12px to 24px.</>,
          <><strong>Line height</strong> — slider from 1.4 to 2.0.</>,
          <><strong>Default layout</strong> — Paper or Wide for new notes.</>,
          <><strong>Spellcheck</strong> — enable/disable browser spellcheck in the notes editor.</>,
        ]} />

        <SubH>Behavior & Shortcuts</SubH>
        <Steps items={[
          <><strong>Task delete mode</strong> — Undo toast (default) or Confirm dialog.</>,
          <><strong>Quick-add sets due = today</strong> — tasks added from the tray widget automatically get today's date.</>,
          <><strong>Keyboard shortcuts</strong> — full reference table built in.</>,
        ]} />

        <SubH>Data & About</SubH>
        <Steps items={[
          <>Export / import all boards as JSON.</>,
          <>Copy the SQLite database path (for manual backup on desktop).</>,
          <><strong>Reset settings</strong> — restore all settings to defaults.</>,
          <><strong>Reset workspace</strong> — two-step confirmation to wipe and start fresh.</>,
          <>App version and build info.</>,
        ]} />
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
        <P>Attach images to tasks, or insert them inline in notes.</P>

        <SubH>In tasks</SubH>
        <Steps items={[
          <>Start editing a task.</>,
          <>Click the dashed <strong>+ Add image</strong> button below the text area.</>,
          <>Pick one or more images (max 10 MB each). Auto-compressed to ≤ 900px JPEG.</>,
          <>Click any thumbnail to open a full-screen viewer with prev/next and arrow-key controls.</>,
          <>While editing, click the red × on a thumbnail to remove it.</>,
        ]} />

        <SubH>In notes</SubH>
        <Steps items={[
          <>Paste an image directly from clipboard.</>,
          <>Drag and drop an image file onto the canvas.</>,
          <>Type <Kbd>/image</Kbd> and pick a file.</>,
          <>Images insert at the cursor — not at the end.</>,
        ]} />

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
        <SubH>Columns</SubH>
        <P>Grab a column by its title bar and drag sideways to reorder.</P>
        <SubH>Tasks</SubH>
        <Steps items={[
          <>Drag a task <strong>up or down</strong> to reorder within its column.</>,
          <>Drag a task <strong>onto another column</strong> to move it. Tasks slide out of the way live.</>,
        ]} />
        <Tip>Drag activates after moving ~8px so clicks still register for buttons inside tasks.</Tip>
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
        <P>Search the active board (and peek at other boards) with multi-keyword AND logic, filters, and jump-to-match navigation.</P>
        <SubH>Open</SubH>
        <P>Click the search pill, or press <Kbd>⌘ / Ctrl</Kbd> + <Kbd>K</Kbd>, or just <Kbd>/</Kbd>.</P>
        <SubH>Multi-keyword</SubH>
        <P>Space-separated words must <strong>all</strong> appear in the task. <Kbd>urgent bug</Kbd> → tasks containing both words.</P>
        <SubH>Filters</SubH>
        <Steps items={[
          <><Kbd>has:image</Kbd> — tasks with image attachments.</>,
          <><Kbd>has:done</Kbd> — completed tasks.</>,
          <>Combine: <Kbd>review has:image</Kbd>.</>,
        ]} />
        <SubH>Modes</SubH>
        <Steps items={[
          <><strong>Highlight</strong> (default) — all tasks visible, matches highlighted.</>,
          <><strong>Filter</strong> — non-matching tasks hidden.</>,
        ]} />
        <SubH>Jump between matches</SubH>
        <P><Kbd>Enter</Kbd> → next match. <Kbd>Shift+Enter</Kbd> → previous. Counter shows "2 / 5".</P>
        <SubH>Other boards</SubH>
        <P>A <Kbd>+N ▾</Kbd> chip appears when other boards have matches. Click to see them and switch.</P>
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
        <P>Every meaningful change is tracked — drag-drop, edit, delete, rename, colour change, due date.</P>
        <P style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span><Kbd>⌘ / Ctrl</Kbd> + <Kbd>Z</Kbd> Undo</span>
          <span><Kbd>⌘ / Ctrl</Kbd> + <Kbd>Shift</Kbd> + <Kbd>Z</Kbd> Redo</span>
          <span><Kbd>⌘ / Ctrl</Kbd> + <Kbd>Y</Kbd> Redo</span>
        </P>
        <SubH>Granularity</SubH>
        <P>Rapid changes collapse into one step (400ms debounce). History caps at 50 steps.</P>
        <Tip>Browser's native <Kbd>⌘+Z</Kbd> still works while typing inside a text field — Kandoo's undo only fires when no input is focused.</Tip>
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
        <P>Multiple bundled themes with full accent colour customisation. Every surface follows the active theme via CSS variables.</P>
        <SubH>Switch theme</SubH>
        <P>Click the colour-filter icon in the toolbar, or press <Kbd>T</Kbd> to cycle. Or go to <strong>Settings → Appearance</strong> for the full grid.</P>
        <SubH>Accent colour</SubH>
        <P>Settings → Appearance → Accent. Choose one of 8 presets or any custom hex. The accent applies to active states, chips, highlights, and the sidebar indicator.</P>
        <SubH>Density</SubH>
        <P><strong>Normal</strong> (default) vs <strong>Compact</strong> — compact reduces padding throughout so more fits on screen. Toggle in Settings → Appearance.</P>
        <SubH>Reduce motion</SubH>
        <P>Disables all transitions and animations. Good for accessibility or preference. Toggle in Settings → Appearance.</P>
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
        <P>Back up your boards or move them between Kandoo installs.</P>
        <SubH>Export</SubH>
        <Steps items={[
          <>Click the <strong>Export</strong> icon in the toolbar.</>,
          <>Pick <strong>JSON</strong> (full backup, re-importable) or <strong>XLSX</strong> (spreadsheet format).</>,
          <>Choose current board or all boards → <strong>Download</strong>.</>,
        ]} />
        <SubH>Import</SubH>
        <Steps items={[
          <>Export icon → Import section → <strong>Select File</strong>.</>,
          <>Pick a previously exported JSON file and confirm the preview.</>,
        ]} />
        <Tip>Imported boards are <strong>appended</strong> — never overwrite. IDs are regenerated to prevent collisions.</Tip>
      </>
    ),
  },
  {
    id: 'sync',
    icon: <VscSave />,
    label: 'Sync & Storage',
    content: (
      <>
        <H2>Sync & Storage</H2>
        <P>Kandoo is local-first. The desktop app works fully offline. Cloud sync is optional and activates when you sign in.</P>
        <SubH>How local storage works</SubH>
        <Steps items={[
          <><strong>Desktop</strong> — workspace stored in SQLite inside Kandoo's app data folder.</>,
          <><strong>Web</strong> — workspace stored in browser localStorage.</>,
          <>Changes autosave 500ms after you stop editing.</>,
          <>The save indicator in the sidebar footer shows the current state.</>,
        ]} />
        <SubH>Cloud sync (Firestore)</SubH>
        <Steps items={[
          <>Sign in with Google or email to enable sync.</>,
          <>Every save is pushed to Firestore under your account (private, only you can access it).</>,
          <>Changes made on one device appear on all other open devices in real time — no refresh needed.</>,
          <>If you edit offline, changes sync automatically when you reconnect.</>,
        ]} />
        <SubH>Conflict resolution</SubH>
        <P>If two devices edited the same workspace while offline, Kandoo detects the conflict and gives three options in Settings → Account &amp; Sync: <strong>Load cloud</strong> (replaces local), <strong>Upload this device</strong> (replaces cloud), or <strong>Merge both</strong> — which combines boards and tasks from both sides. Items only on one device are added; if the same task was edited on both, the local version is kept; note card content keeps the local version.</P>
        <SubH>Guest / offline mode</SubH>
        <P>Continue without signing in — data stays local only. If you later sign in, your local workspace migrates to the cloud automatically.</P>
        <Tip>Go to <strong>Settings → Data</strong> to export a JSON backup, copy the SQLite path, or reset your workspace.</Tip>
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
              ['Open this Help guide',                   <><Kbd>⌘ / Ctrl</Kbd> + <Kbd>Shift</Kbd> + <Kbd>1</Kbd></>],
              ['Focus search',                           <><Kbd>⌘ / Ctrl</Kbd> + <Kbd>K</Kbd> or <Kbd>/</Kbd></>],
              ['Quick-add task',                         <Kbd key="n">N</Kbd>],
              ['Cycle theme',                            <Kbd key="t">T</Kbd>],
              ['Undo',                                   <><Kbd>⌘ / Ctrl</Kbd> + <Kbd>Z</Kbd></>],
              ['Redo',                                   <><Kbd>⌘ / Ctrl</Kbd> + <Kbd>Shift</Kbd> + <Kbd>Z</Kbd></>],
              ['Bold (while editing)',                   <><Kbd>⌘ / Ctrl</Kbd> + <Kbd>B</Kbd></>],
              ['Italic (while editing)',                 <><Kbd>⌘ / Ctrl</Kbd> + <Kbd>I</Kbd></>],
              ['Underline (while editing)',              <><Kbd>⌘ / Ctrl</Kbd> + <Kbd>U</Kbd></>],
              ['Slash command menu (in notes)',          <Kbd key="slash">/</Kbd>],
              ['Save edit / next search match',         <Kbd key="enter">Enter</Kbd>],
              ['Previous search match',                  <><Kbd>Shift</Kbd> + <Kbd>Enter</Kbd></>],
              ['Dismiss panel / cancel edit',            <Kbd key="esc">Esc</Kbd>],
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

const TOUR_AUTO_KEY = 'kandoo-tour-auto';

function HelpModal({ isOpen, onClose, defaultSection = null, onLaunchTour, onFeedback }) {
  const [activeId, setActiveId] = useState('tutorial');
  const [tourAutoShow, setTourAutoShow] = useState(() => localStorage.getItem(TOUR_AUTO_KEY) !== '0');
  const modalRef = useRef(null);
  const contentRef = useRef(null);

  const handleTourAutoToggle = (checked) => {
    setTourAutoShow(checked);
    if (checked) {
      localStorage.removeItem(TOUR_AUTO_KEY);
    } else {
      localStorage.setItem(TOUR_AUTO_KEY, '0');
    }
  };

  const tutorialSection = {
    id: 'tutorial',
    icon: <VscDebugStart />,
    label: 'Tutorial',
    content: (
      <div>
        <H2>Interactive Tutorial</H2>
        <P>Take the guided tour to discover Kandoo's key features — boards, tasks, notes, and sync — in under a minute.</P>

        <div style={{
          margin: '1.5rem 0',
          padding: '1.25rem 1.5rem',
          border: '1px solid var(--theme-border)',
          borderRadius: '0.75rem',
          background: 'var(--theme-bg-secondary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--theme-text-primary)', marginBottom: 4 }}>
              Launch guided tour
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--theme-text-secondary)' }}>
              6 steps · ~30 seconds · highlights key features with animations
            </div>
          </div>
          <button
            onClick={() => { onClose(); onLaunchTour?.(); }}
            style={{
              padding: '9px 22px',
              borderRadius: 10,
              border: 'none',
              background: 'var(--theme-accent)',
              color: 'white',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 600,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <VscDebugStart style={{ fontSize: '1rem' }} />
            Start tour
          </button>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.85rem 1rem',
          border: '1px solid var(--theme-border)',
          borderRadius: '0.5rem',
          background: 'var(--theme-bg-secondary)',
        }}>
          <div>
            <div style={{ fontSize: '0.86rem', fontWeight: 500, color: 'var(--theme-text-primary)' }}>Show tutorial on startup</div>
            <div style={{ fontSize: '0.76rem', color: 'var(--theme-text-secondary)', marginTop: 2 }}>Automatically launch the tour each time you open Kandoo</div>
          </div>
          <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <input
              type="checkbox"
              checked={tourAutoShow}
              onChange={e => handleTourAutoToggle(e.target.checked)}
              style={{ width: 0, height: 0, opacity: 0, position: 'absolute' }}
            />
            <div style={{
              width: 38, height: 22, borderRadius: 11,
              background: tourAutoShow ? 'var(--theme-accent)' : 'var(--theme-border)',
              transition: 'background 0.2s',
              position: 'relative',
            }}>
              <div style={{
                position: 'absolute',
                top: 3, left: tourAutoShow ? 19 : 3,
                width: 16, height: 16,
                borderRadius: '50%',
                background: 'white',
                boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                transition: 'left 0.2s',
              }} />
            </div>
          </label>
        </div>
      </div>
    ),
  };

  const allSections = [tutorialSection, ...SECTIONS];

  useEffect(() => {
    if (!isOpen) return;
    const onMouse = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', onMouse);
    return () => document.removeEventListener('mousedown', onMouse);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && defaultSection) {
      const match = allSections.find(s => s.id === defaultSection);
      if (match) setActiveId(match.id);
    } else if (isOpen && !defaultSection) {
      setActiveId('tutorial');
    }
  }, [isOpen, defaultSection]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [activeId]);

  if (!isOpen) return null;
  const active = allSections.find((s) => s.id === activeId) || allSections[0];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.35)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
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
            {allSections.map((s) => {
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
            <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--theme-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--theme-text-muted)' }}>
                Kandoo v1.1.0 — local-first, cloud-synced, built for students.
              </span>
              {onFeedback && (
                <button
                  onClick={() => { onClose(); onFeedback(); }}
                  style={{
                    padding: '5px 14px', borderRadius: 20,
                    border: '1.5px solid var(--theme-border)',
                    background: 'transparent', color: 'var(--theme-text-secondary)',
                    fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--theme-accent)'; e.currentTarget.style.color = 'var(--theme-accent)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--theme-border)'; e.currentTarget.style.color = 'var(--theme-text-secondary)'; }}
                >
                  Send Feedback
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HelpModal;

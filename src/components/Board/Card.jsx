import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import { createPortal } from "react-dom";
import { SortableContext, useSortable, verticalListSortingStrategy, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { toast } from '../../utils/toast';
import { generateTaskID } from "../../utils/taskIdGenerator";
import { renderTaskValue } from "../../utils/richText";
import { sanitizeHtml, markdownToHtml, isHtml, htmlToText } from "../../utils/htmlEditor";
import { matchesTask, matchesCardTitle } from "../../utils/search";
import { classifyTask, dueTone, toDueString, formatDueShort } from "../../utils/dueDate";
import {
  completionTimingLabel,
  completionTimingTone,
  getCompletionTiming,
  isDoneColumnTitle,
  markTaskCompleted,
  markTaskOpen,
  withDueHistory,
} from "../../utils/taskLifecycle";
import { CARD_HUES, resolveCardColor, normalizeCardColor, isDarkSurface } from "../../themes/cardPalettes";
import { useTheme } from "../../contexts/ThemeContext";
import { useSettings } from "../../contexts/SettingsContext";
import { uploadImage, deleteImage, isStorageUrl } from "../../services/imageStorage";
import { isProtectedCoreColumn } from "../../utils/coreColumns";
import {
  VscEdit, VscCheck, VscTrash, VscSave, VscCopy, VscClose,
  VscBold, VscItalic, VscCalendar, VscNote, VscLink, VscPin, VscPinned, VscChevronDown, VscDebugRestart, VscChecklist, VscSync,
} from "react-icons/vsc";
import { IoDuplicateOutline } from "react-icons/io5";
import { IoImageOutline } from "react-icons/io5";
import { IoColorPaletteOutline } from "react-icons/io5";
import { RiUnderline } from "react-icons/ri";
import DeleteWarningModal from "./DeleteWarningModal.jsx";
import DefaultModal from "./DefaultModal.jsx";
import ContextMenu from "../ContextMenu.jsx";
import ImageModal from "./ImageModal.jsx";
import RichEditor from "./RichEditor.jsx";
import NoteCard from "./NoteCard.jsx";
import DatePicker from "./DatePicker.jsx";
import PrioritySelector from "./PrioritySelector.jsx";
import SubtaskEditor from "./SubtaskEditor.jsx";
import LabelPicker from "./LabelPicker.jsx";
import RecurrenceButton from "./RecurrenceButton.jsx";
import { getPriority, PRIORITIES } from "../../utils/taskPriority";
import { advanceDue, recurrenceLabel } from "../../utils/recurrence";
import NotePickerModal from "./NotePickerModal.jsx";
import LinkedNotesPopover from "./LinkedNotesPopover.jsx";
import PasteSplitModal from "./PasteSplitModal.jsx";
import TaskTimelineModal from "./TaskTimelineModal.jsx";
import PinIcon from "../icons/PinIcon.jsx";

// A task's note links live in `noteLinks` (array). Older tasks used a single
// `noteLink` object — read both so nothing breaks during the transition.
function getNoteLinks(task) {
  if (Array.isArray(task?.noteLinks)) return task.noteLinks;
  if (task?.noteLink?.noteUid) return [task.noteLink];
  return [];
}

// A task has no real content when there's no visible text (zero-width chars
// don't count) and no images. Used to stop empty tasks being created or saved.
function isEmptyTaskContent(html, images) {
  const text = htmlToText(html).replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  return text.length === 0 && (images?.length ?? 0) === 0;
}

function TaskLabelChips({ labels }) {
  const [popover, setPopover] = useState(null);
  const popoverRef = useRef(null);

  useEffect(() => {
    if (!popover) return undefined;
    const close = (event) => {
      if (popoverRef.current?.contains(event.target)) return;
      setPopover(null);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setPopover(null);
    };
    const closeOnScroll = () => setPopover(null);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', closeOnEscape);
    window.addEventListener('scroll', closeOnScroll, true);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('scroll', closeOnScroll, true);
    };
  }, [popover]);

  if (!Array.isArray(labels) || labels.length === 0) return null;
  const [first, ...rest] = labels;
  const filterByLabel = (e, name) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('kandoo:set-label-filter', { detail: name }));
    setPopover(null);
  };
  const openLabels = (e) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const width = 220;
    setPopover({
      left: Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8),
      top: Math.min(rect.bottom + 6, window.innerHeight - 220),
      width,
    });
  };

  return (
    <>
      <span className="mac-task-labels" title={labels.map((label) => label.name).join(', ')}>
        <button
          type="button"
          className="mac-label-chip"
          style={{ '--label-color': first.color }}
          title={`Filter by “${first.name}” across boards`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => filterByLabel(e, first.name)}
        >
          <span className="mac-label-chip__dot" />
          <span className="mac-label-chip__name">{first.name}</span>
        </button>
        {rest.length > 0 && (
          <button
            type="button"
            className="mac-label-chip mac-label-chip--more"
            title={labels.map((label) => label.name).join(', ')}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={openLabels}
          >
            +{rest.length}
          </button>
        )}
      </span>
      {popover && createPortal(
        <div
          ref={popoverRef}
          className="mac-label-popover"
          style={{ left: popover.left, top: popover.top, width: popover.width }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="mac-label-popover__title">Labels</div>
          <div className="mac-label-popover__list">
            {labels.map((label) => (
              <button
                key={label.id || label.name}
                type="button"
                className="mac-label-popover__item"
                style={{ '--label-color': label.color }}
                onClick={(e) => filterByLabel(e, label.name)}
              >
                <span className="mac-label-chip__dot" />
                <span>{label.name}</span>
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

function CardColorPicker({ x, y, currentColor, isDark, onPick, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const activeKey = normalizeCardColor(currentColor);

  // Clamp to viewport
  const W = 250, H = 96;
  const left = Math.min(x, window.innerWidth  - W - 8);
  const top  = Math.min(y, window.innerHeight - H - 8);

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed', top, left, width: W,
        background: 'var(--theme-bg-modal)',
        border: '1px solid var(--theme-border)',
        borderRadius: '0.65rem',
        padding: '0.75rem',
        boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
        zIndex: 2000,
        display: 'flex', flexDirection: 'column', gap: '0.6rem',
      }}
    >
      <div style={{ fontSize: '0.65rem', color: 'var(--theme-text-muted)', letterSpacing: '0.08em', fontWeight: 600 }}>
        CARD COLOUR
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px' }}>
        {CARD_HUES.map(({ key, label }) => {
          const swatch = resolveCardColor(key, isDark);
          const active = activeKey === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => { onPick(key); onClose(); }}
              title={label}
              aria-label={label}
              style={{
                width: '30px', height: '30px',
                borderRadius: '50%',
                background: swatch.header,
                border: active
                  ? '2px solid var(--theme-accent)'
                  : '1.5px solid var(--theme-border)',
                boxShadow: active ? '0 0 0 3px color-mix(in srgb, var(--theme-accent) 22%, transparent)' : 'none',
                cursor: 'pointer', padding: 0, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'transform 0.12s, box-shadow 0.12s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.12)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              {active && (
                <VscCheck style={{ color: swatch.headerText, fontSize: '0.9rem' }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Formatting toolbar — delegates to RichEditor's exec API.
// onMouseDown preventDefault keeps the editor focused while clicking buttons.
// Exposes openLink() so Cmd+K (from the editor) can pop the hyperlink input.
const TOOLBAR_BTN = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--theme-text-muted)', padding: '3px 6px',
  borderRadius: 5, fontSize: '0.85rem',
  display: 'flex', alignItems: 'center', lineHeight: 1,
  transition: 'color 0.12s, background 0.12s',
};
const FormattingToolbar = forwardRef(function FormattingToolbar({ editorRef, onLinkNote, priority, onPriority, recurrence, onRecurrence }, ref) {
  const apply = (cmd) => editorRef.current?.exec(cmd);
  const mod = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform) ? '⌘' : 'Ctrl';
  const [pop, setPop] = useState(null); // { type: 'menu' | 'link', x, y } | null
  const [url, setUrl] = useState('');
  const linkBtnRef = useRef(null);
  const inputRef = useRef(null);

  const openAt = useCallback((type) => {
    const r = linkBtnRef.current?.getBoundingClientRect();
    if (!r) return;
    setPop({ type, x: r.left, y: r.bottom + 4 });
    if (type === 'link') { setUrl(''); setTimeout(() => inputRef.current?.focus(), 30); }
  }, []);
  const openLink = useCallback(() => openAt('link'), [openAt]);
  const close = useCallback(() => setPop(null), []);
  useImperativeHandle(ref, () => ({ openLink }), [openLink]);

  const applyLink = () => {
    const v = url.trim();
    if (v) {
      const href = /^https?:\/\//i.test(v) ? v : `https://${v}`;
      editorRef.current?.insertLink(href);
    }
    close();
  };

  // Close the popover on outside click or scroll.
  // Using 'click' (not 'mousedown') so right-click → paste doesn't dismiss it.
  useEffect(() => {
    if (!pop) return;
    const onDoc = (e) => {
      if (e.target.closest?.('[data-fmt-pop]')) return;
      if (linkBtnRef.current?.contains(e.target)) return;
      close();
    };
    const id = setTimeout(() => {
      document.addEventListener('click', onDoc);
      window.addEventListener('scroll', close, true);
    }, 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener('click', onDoc);
      window.removeEventListener('scroll', close, true);
    };
  }, [pop, close]);

  const fmtBtn = (cmd, icon, label) => (
    <button
      type="button"
      title={`${label} (${mod}+${label[0]})`}
      onMouseDown={e => e.preventDefault()}
      onClick={() => apply(cmd)}
      style={TOOLBAR_BTN}
      onMouseEnter={e => { e.currentTarget.style.color = 'var(--theme-text-primary)'; e.currentTarget.style.background = 'var(--theme-bg-hover)'; }}
      onMouseLeave={e => { e.currentTarget.style.color = 'var(--theme-text-muted)'; e.currentTarget.style.background = 'none'; }}
    >
      {icon}
    </button>
  );

  const menuItem = (icon, text, kbd, onClick) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 9, width: '100%',
        background: 'none', border: 'none', cursor: 'pointer',
        color: 'var(--theme-text-primary)', fontSize: '0.82rem', fontFamily: 'inherit',
        padding: '8px 10px', borderRadius: 7, textAlign: 'left', whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--theme-bg-hover)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
    >
      <span style={{ color: 'var(--theme-text-muted)', display: 'flex' }}>{icon}</span>
      <span style={{ flex: 1 }}>{text}</span>
      {kbd && <span style={{ color: 'var(--theme-text-muted)', fontSize: '0.72rem' }}>{kbd}</span>}
    </button>
  );

  return (
    <div style={{ display: 'flex', gap: 1, padding: '4px 8px 3px', borderBottom: '1px solid var(--theme-border)' }}>
      {fmtBtn('bold',      <VscBold />,      'Bold')}
      {fmtBtn('italic',    <VscItalic />,    'Italic')}
      {fmtBtn('underline', <RiUnderline />,  'Underline')}
      <button
        ref={linkBtnRef}
        type="button"
        title={`Link (${mod}+K)`}
        onMouseDown={e => e.preventDefault()}
        onClick={() => (pop ? close() : openAt('menu'))}
        style={TOOLBAR_BTN}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--theme-text-primary)'; e.currentTarget.style.background = 'var(--theme-bg-hover)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--theme-text-muted)'; e.currentTarget.style.background = 'none'; }}
      >
        <VscLink />
      </button>

      {/* Task metadata lives up here so the footer stays uncluttered. */}
      {(onPriority || onRecurrence) && (
        <>
          <div style={{ flex: 1 }} />
          {onPriority && <PrioritySelector value={priority} onChange={onPriority} />}
          {onRecurrence && <RecurrenceButton value={recurrence} onChange={onRecurrence} />}
        </>
      )}

      {pop && createPortal(
        <div
          data-fmt-pop
          onMouseDown={e => { if (pop.type === 'menu') e.preventDefault(); e.stopPropagation(); }}
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed', top: pop.y, left: pop.x, zIndex: 10200,
            background: 'var(--theme-bg-modal)',
            border: '1px solid var(--theme-border)',
            borderRadius: 10, boxShadow: '0 10px 30px rgba(0,0,0,0.22)',
            padding: pop.type === 'menu' ? 5 : 7, minWidth: pop.type === 'menu' ? 188 : 256,
          }}
        >
          {pop.type === 'menu' ? (
            <>
              {menuItem(<VscLink />, 'Add hyperlink', `${mod}K`, openLink)}
              {onLinkNote && menuItem(<VscNote />, 'Link a note', null, () => { close(); onLinkNote(); })}
            </>
          ) : (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                ref={inputRef}
                value={url}
                onChange={e => setUrl(e.target.value)}
                onPaste={e => { e.preventDefault(); const text = e.clipboardData.getData('text/plain'); if (text) setUrl(text.trim()); }}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyLink(); } else if (e.key === 'Escape') { e.preventDefault(); close(); } }}
                placeholder="Paste or type a URL…"
                style={{
                  flex: 1, background: 'var(--theme-bg-input)',
                  border: '1px solid var(--theme-border)', borderRadius: 7,
                  color: 'var(--theme-text-primary)', fontSize: '0.82rem',
                  fontFamily: 'inherit', padding: '7px 9px', outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={applyLink}
                style={{
                  padding: '7px 14px', borderRadius: 7, border: 'none',
                  background: 'var(--theme-accent)', color: '#fff',
                  fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                }}
              >
                Add
              </button>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
});


// Sortable wrapper for individual task rows
function SortableTask({ task, cardUid, isEditing, className, style, onContextMenu, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task", task, cardUid },
    disabled: isEditing,
  });

  return (
    <li
      ref={setNodeRef}
      data-task-id={task.id}
      className={className}
      style={{ ...style, transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      {...attributes}
      {...(isEditing ? {} : listeners)}
      onContextMenu={onContextMenu}
    >
      {children}
    </li>
  );
}

function Card({
  index, uid, type = 'todo', title, color, isPinned = false,
  pinnedCardCount = 0, maxPinnedCards = 3, onTogglePin,
  isVisible, tasks, note,
  updateCardTasks, updateCardNote, updateCards, searchTerm,
  query, filterMode = false, labelFilter = null, scheduleView = null, currentMatchTaskId = null,
  focusedTask = null,
  quickAddSignal = 0, dragHandleProps = {}, onMoveToDone, onMoveTask,
  navigateToNote, getNoteTitle, notes = [], layout = 'grid',
  allCards = [],
  compact = false, collapsed = false, onToggleCollapsed,
}) {
  const isNote = type === 'note';
  const { currentTheme } = useTheme();
  const { settings } = useSettings();
  // Explicit drop target for the empty-state tile, so a card with no tasks is
  // still a reliable drop zone in every layout (the sortable card shell alone
  // is an awkward target when collapsed, e.g. a short lane card).
  const { setNodeRef: setEmptyDropRef, isOver: isEmptyOver } = useDroppable({
    id: `card-empty-${uid}`,
    data: { type: 'card', cardUid: uid },
  });
  const [uploading, setUploading]             = useState(false);
  const [isMounted, setIsMounted]             = useState(false);
  const [toggleAddTask, setToggleAddTask]     = useState(false);
  const [isEditingTitle, setIsEditingTitle]   = useState(false);
  const [editingTitleValue, setEditingTitleValue] = useState("");
  const [colorPickerPos, setColorPickerPos]   = useState(null);
  const [notePicker, setNotePicker] = useState(null); // { kind: 'task'|'new', taskId? } | null
  const [newTaskNoteLinks, setNewTaskNoteLinks] = useState([]); // pending links for the task being created
  const [linkedPopover, setLinkedPopover] = useState(null); // { taskId, x, y } | null
  const [pasteSplit, setPasteSplit] = useState(null); // { lines, text } | null
  const [flashTaskId, setFlashTaskId] = useState(null);
  const [completingTaskId, setCompletingTaskId] = useState(null);
  const [timelineTask, setTimelineTask] = useState(null);
  const [taskValue, setTaskValue]             = useState(""); // HTML string
  const [newTaskImages, setNewTaskImages]     = useState([]);
  const [newTaskDue, setNewTaskDue]           = useState(""); // "YYYY-MM-DD" or ""
  const [newTaskPriority, setNewTaskPriority] = useState(null); // 'high'|'medium'|'low'|null
  const [newTaskSubtasks, setNewTaskSubtasks] = useState([]);
  const [newTaskLabels, setNewTaskLabels]     = useState([]);
  const [newTaskRecurrence, setNewTaskRecurrence] = useState(null);
  const [editingTaskId, setEditingTaskId]     = useState(null);
  const [editingTaskValue, setEditingTaskValue]   = useState(""); // HTML string
  const [editingTaskImages, setEditingTaskImages] = useState([]);
  const [editingTaskDue, setEditingTaskDue]       = useState(""); // "YYYY-MM-DD" or ""
  const [editingTaskPriority, setEditingTaskPriority] = useState(null);
  const [editingTaskSubtasks, setEditingTaskSubtasks] = useState([]);
  const [editingTaskLabels, setEditingTaskLabels]     = useState([]);
  const [editingTaskRecurrence, setEditingTaskRecurrence] = useState(null);
  // (done state is now persisted as task.done — see toggleDoneTask)
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);
  const [toDelete, setToDelete]               = useState("");
  const [defaultModal, setDefaultModal]       = useState(false);
  const [ctxMenu, setCtxMenu]                 = useState(null);
  const [viewingImages, setViewingImages]     = useState(null); // { images, index }

  const inputRef      = useRef(null);
  const editFormRef   = useRef(null);
  const menuTriggerRef = useRef(null);
  const editEditorRef = useRef(null);
  const newEditorRef  = useRef(null);
  const editToolbarRef = useRef(null);
  const newToolbarRef  = useRef(null);
  const editFileInputRef = useRef(null);
  const newFileInputRef  = useRef(null);
  const completionMoveTimerRef = useRef(null);

  const isProtectedColumn = isProtectedCoreColumn({ uid, title });
  const isDoneColumn = isDoneColumnTitle(title);
  const moveTargetCards = allCards.filter((card) => (card.type || 'todo') !== 'note' && card.uid !== uid);

  // Pre-fill due date / label when the add-task form opens.
  useEffect(() => {
    if (toggleAddTask && settings.quickAddDueToday) {
      setNewTaskDue(prev => prev || toDueString(new Date()));
    }
    if (!toggleAddTask) {
      setNewTaskDue("");
    }
    if (toggleAddTask && labelFilter) {
      const labelObj = (settings.labels || []).find((l) => l.name === labelFilter);
      if (labelObj) {
        setNewTaskLabels((prev) =>
          prev.some((l) => l.name === labelFilter) ? prev : [...prev, labelObj]
        );
      }
    }
  }, [toggleAddTask, settings.quickAddDueToday, labelFilter, settings.labels]);

  // ── Context menus ──────────────────────────────────────────────────────────

  const copyTaskText = async (value) => {
    try {
      const text = isHtml(value) ? htmlToText(value) : value;
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Couldn't copy — clipboard permission denied");
    }
  };

  const startEditingTitle = () => {
    setEditingTitleValue(title);
    setIsEditingTitle(true);
  };

  const saveCardTitle = () => {
    const trimmed = editingTitleValue.trim();
    if (trimmed && trimmed !== title) {
      updateCards(cards =>
        cards.map((c, i) => (i === index ? { ...c, title: trimmed } : c))
      );
    }
    setIsEditingTitle(false);
  };

  const cancelEditCardTitle = () => {
    setIsEditingTitle(false);
    setEditingTitleValue("");
  };

  const updateCardColor = (newColor) => {
    updateCards((cards) =>
      cards.map((c, i) => (i === index ? { ...c, color: newColor } : c))
    );
  };

  const toggleCardPinned = () => {
    setCtxMenu(null);
    if (!isPinned && pinnedCardCount >= maxPinnedCards) {
      toast.warning(`You can pin up to ${maxPinnedCards} cards per board.`);
      return;
    }
    onTogglePin?.(uid);
    toast.success(isPinned ? "Card unpinned" : "Card pinned to the top");
  };

  const duplicateTask = (task) => {
    const now = Date.now();
    const newTask = { id: generateTaskID(), value: task.value, images: task.images || [], due: task.due || null, createdAt: now, updatedAt: now };
    updateCardTasks(index, { ...tasks, [newTask.id]: newTask });
  };

  // Write a task's note links, migrating away from the legacy single field.
  const writeTaskLinks = (taskId, links) => {
    const t = tasks[taskId];
    if (!t) return;
    const next = { ...t, updatedAt: Date.now() };
    if (links.length) next.noteLinks = links;
    else delete next.noteLinks;
    delete next.noteLink;
    updateCardTasks(index, { ...tasks, [taskId]: next });
  };

  // Add the note if not linked, remove it if already linked.
  const toggleTaskNoteLink = (taskId, noteUid) => {
    const links = getNoteLinks(tasks[taskId]);
    const exists = links.some((l) => l.noteUid === noteUid);
    writeTaskLinks(taskId, exists
      ? links.filter((l) => l.noteUid !== noteUid)
      : [...links, { noteUid }]);
  };

  const removeTaskNoteLink = (taskId, noteUid) =>
    writeTaskLinks(taskId, getNoteLinks(tasks[taskId]).filter((l) => l.noteUid !== noteUid));

  // Pending note links for the not-yet-created task (attached in addTask).
  const toggleNewTaskNoteLink = (noteUid) =>
    setNewTaskNoteLinks((prev) => prev.some((l) => l.noteUid === noteUid)
      ? prev.filter((l) => l.noteUid !== noteUid)
      : [...prev, { noteUid }]);

  const openTaskContextMenu = (e, task) => {
    e.preventDefault();
    e.stopPropagation();
    const linkedCount = getNoteLinks(task).length;
    const moveItems = moveTargetCards.map((targetCard) => ({
      label: `Move to ${targetCard.title || 'Untitled'}`,
      icon: '↳',
      onClick: () => onMoveTask?.(uid, task.id, targetCard.uid),
    }));
    setCtxMenu({
      x: e.clientX, y: e.clientY,
      items: [
        ...(!isDoneColumn ? [{ label: "Edit task", icon: <VscEdit />, onClick: () => startEditingTask(task.id, task.value, task.images) }] : []),
        { label: task.done ? "Reopen task" : "Mark as done", icon: task.done ? <VscDebugRestart /> : <VscCheck />, onClick: () => toggleDoneTask(task.id) },
        { label: "Copy text",   icon: <VscCopy />,          onClick: () => copyTaskText(task.value) },
        { label: "Duplicate",   icon: <IoDuplicateOutline />, onClick: () => duplicateTask(task) },
        { label: "Task timeline", icon: <VscCalendar />, onClick: () => setTimelineTask(task) },
        ...(moveItems.length ? [{ divider: true }, { label: "Move to", icon: '⇄', disabled: true }, ...moveItems] : []),
        { divider: true },
        { label: "Priority", disabled: true },
        ...PRIORITIES.map((p) => ({
          label: `${task.priority === p.id ? '✓ ' : ''}${p.label}`,
          icon: <span style={{ width: 10, height: 10, borderRadius: '50%', background: p.color, display: 'inline-block' }} />,
          onClick: () => setTaskPriority(task.id, task.priority === p.id ? null : p.id),
        })),
        { divider: true },
        { label: linkedCount ? `Linked notes (${linkedCount})…` : "Link a note…", icon: <VscLink />, onClick: () => setNotePicker({ kind: 'task', taskId: task.id }) },
        { divider: true },
        { label: "Delete task", icon: <VscTrash />, danger: true, onClick: () => deleteTask(task.id) },
      ],
    });
  };

  const buildCardMenuItems = (clickX, clickY) => {
    const items = [
      { label: "Rename card",   icon: <VscEdit />,              onClick: startEditingTitle },
      { label: "Change colour", icon: <IoColorPaletteOutline />, onClick: () => setColorPickerPos({ x: clickX, y: clickY }) },
      { label: isPinned ? "Unpin card" : "Pin card to top", icon: isPinned ? <VscPinned /> : <VscPin />, onClick: toggleCardPinned },
    ];
    if (isNote) {
      items.push({ divider: true });
      items.push({ label: "Clear note", icon: <VscTrash />, danger: true, onClick: clearNote });
    } else {
      items.push({ label: "Add task", icon: "＋", onClick: () => setToggleAddTask(true) });
      items.push({ divider: true });
      items.push({ label: "Delete all tasks", icon: <VscTrash />, danger: true, onClick: deleteAllTasks });
    }
    if (!isProtectedColumn) {
      items.push({ label: "Delete card", icon: <VscTrash />, danger: true, onClick: handleDeleteCard });
    }
    return items;
  };

  const openCardContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({
      kind: 'card-context',
      x: e.clientX,
      y: e.clientY,
      items: buildCardMenuItems(e.clientX, e.clientY),
    });
  };

  const toggleCardOptionsMenu = (e) => {
    e.stopPropagation();
    if (ctxMenu?.kind === 'card-options') {
      setCtxMenu(null);
      return;
    }
    const rect = menuTriggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(8, rect.right - 176);
    const y = rect.bottom + 5;
    setCtxMenu({
      kind: 'card-options',
      x,
      y,
      items: buildCardMenuItems(x, y),
    });
  };

  const openCreateTaskContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({
      x: e.clientX, y: e.clientY,
      items: [
        { label: "New task", icon: "＋", onClick: () => setToggleAddTask(true) },
        {
          label: "Paste as task",
          icon: "📋",
          onClick: async () => {
            try {
              const text = await navigator.clipboard.readText();
              if (text.trim()) {
                const now = Date.now();
                const newTask = { id: generateTaskID(), value: text.trim(), images: [], createdAt: now, updatedAt: now };
                updateCardTasks(index, { ...tasks, [newTask.id]: newTask });
                toast.success("Task created from clipboard");
              } else {
                toast.warning("Clipboard is empty");
              }
            } catch {
              toast.error("Clipboard access denied");
            }
          },
        },
      ],
    });
  };

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (isVisible) setTimeout(() => setIsMounted(true), 10);
  }, [isVisible]);

  useEffect(() => {
    if (quickAddSignal > 0) setToggleAddTask(true);
  }, [quickAddSignal]);

  useEffect(() => {
    if (!focusedTask?.taskId || focusedTask.cardUid !== uid) return undefined;
    setFlashTaskId(focusedTask.taskId);
    const scrollTimer = window.setTimeout(() => {
      const selector = `[data-task-id="${String(focusedTask.taskId).replace(/"/g, '\\"')}"]`;
      document.querySelector(selector)?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }, 80);
    const clearTimer = window.setTimeout(() => setFlashTaskId(null), 2600);
    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearTimer);
    };
  }, [focusedTask?.cardUid, focusedTask?.nonce, focusedTask?.taskId, uid]);

  useEffect(() => {
    const handler = (e) => {
      if (inputRef.current && !inputRef.current.contains(e.target)) setToggleAddTask(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Task CRUD ──────────────────────────────────────────────────────────────

  const addTask = (e) => {
    e?.preventDefault?.();
    const clean = sanitizeHtml(taskValue);
    if (isEmptyTaskContent(clean, newTaskImages)) { setToggleAddTask(false); return; }
    const now = Date.now();
    let task = {
      id: generateTaskID(), value: clean, images: newTaskImages,
      due: null, createdAt: now, updatedAt: now,
      ...(newTaskPriority ? { priority: newTaskPriority } : {}),
      ...(newTaskSubtasks.length ? { subtasks: newTaskSubtasks.filter((s) => s.text.trim()) } : {}),
      ...(newTaskLabels.length ? { labels: newTaskLabels } : {}),
      ...(newTaskRecurrence ? { recurrence: newTaskRecurrence } : {}),
      ...(newTaskNoteLinks.length ? { noteLinks: newTaskNoteLinks } : {}),
    };
    if (newTaskDue) task = withDueHistory(task, newTaskDue, now);
    const newTask = {
      ...task,
    };
    updateCardTasks(index, { ...tasks, [newTask.id]: newTask });
    setTaskValue("");
    setNewTaskImages([]);
    setNewTaskNoteLinks([]);
    setNewTaskPriority(null);
    setNewTaskSubtasks([]);
    const nextLabels = labelFilter
      ? (settings.labels || []).filter((l) => l.name === labelFilter)
      : [];
    setNewTaskLabels(nextLabels);
    setNewTaskRecurrence(null);
    setNewTaskDue(settings.quickAddDueToday ? toDueString(new Date()) : "");
    newEditorRef.current?.setHtml('');
    newEditorRef.current?.focus();
    setToggleAddTask(true);
  };

  const addMultipleTasks = (lines) => {
    const now = Date.now();
    const newTasks = { ...tasks };
    lines.forEach(line => {
      let task = { id: generateTaskID(), value: line, images: [], due: null, createdAt: now, updatedAt: now };
      if (newTaskDue) task = withDueHistory(task, newTaskDue, now);
      newTasks[task.id] = task;
    });
    updateCardTasks(index, newTasks);
    setTaskValue('');
    newEditorRef.current?.setHtml('');
    newEditorRef.current?.focus();
    toast.success(`Added ${lines.length} tasks`);
  };

  const deleteTask = useCallback((taskId) => {
    const removed = tasks[taskId];
    // "Confirm" mode asks first; "Undo" mode deletes immediately + offers a toast.
    if (settings.taskDeleteMode === 'confirm' && removed) {
      if (!window.confirm('Delete this task?')) return;
    }
    const updated = { ...tasks };
    delete updated[taskId];
    updateCardTasks(index, updated);
    if (removed && settings.taskDeleteMode !== 'confirm') {
      // Undo restores the task in its original position (spread keeps key order).
      toast('Task deleted', {
        action: {
          label: 'Undo',
          onClick: () => updateCardTasks(index, { ...tasks, [taskId]: removed }),
        },
      });
    }
  }, [index, settings.taskDeleteMode, tasks, updateCardTasks]);

  const startEditingTask = (taskId, taskVal, taskImages = []) => {
    setEditingTaskId(taskId);
    // Convert legacy markdown tasks to HTML for the rich editor
    const initialHtml = isHtml(taskVal) ? (taskVal || '') : markdownToHtml(taskVal || '');
    setEditingTaskValue(initialHtml);
    setEditingTaskImages(taskImages || []);
    setEditingTaskDue(tasks[taskId]?.due || "");
    setEditingTaskPriority(tasks[taskId]?.priority || null);
    setEditingTaskSubtasks(tasks[taskId]?.subtasks || []);
    setEditingTaskLabels(tasks[taskId]?.labels || []);
    setEditingTaskRecurrence(tasks[taskId]?.recurrence || null);
  };

  const cancelEditingTask = () => {
    setEditingTaskId(null);
    setEditingTaskValue("");
    setEditingTaskImages([]);
    setEditingTaskDue("");
    setEditingTaskPriority(null);
    setEditingTaskSubtasks([]);
    setEditingTaskLabels([]);
    setEditingTaskRecurrence(null);
  };

  // Set/clear a task's priority directly (context menu) without entering edit mode.
  const setTaskPriority = useCallback((taskId, level) => {
    const current = tasks[taskId];
    if (!current) return;
    const next = { ...current, updatedAt: Date.now() };
    if (level) next.priority = level; else delete next.priority;
    updateCardTasks(index, { ...tasks, [taskId]: next });
  }, [index, tasks, updateCardTasks]);

  // Toggle a single subtask's done state directly from the task display.
  const toggleSubtask = useCallback((taskId, subtaskId) => {
    const current = tasks[taskId];
    if (!current?.subtasks?.length) return;
    const subtasks = current.subtasks.map((s) => (s.id === subtaskId ? { ...s, done: !s.done } : s));
    updateCardTasks(index, { ...tasks, [taskId]: { ...current, subtasks, updatedAt: Date.now() } });
  }, [index, tasks, updateCardTasks]);

  const saveEditedTask = useCallback((taskId) => {
    const clean = sanitizeHtml(editingTaskValue);
    // Emptied out → treat as a delete (routed through deleteTask so the user's
    // confirm/undo preference still applies) rather than saving a blank task.
    if (isEmptyTaskContent(clean, editingTaskImages)) {
      cancelEditingTask();
      deleteTask(taskId);
      return;
    }
    const now = Date.now();
    const currentTask = tasks[taskId];
    const base = { ...currentTask, value: clean, images: editingTaskImages, updatedAt: now };
    if (editingTaskPriority) base.priority = editingTaskPriority; else delete base.priority;
    const cleanSubtasks = (editingTaskSubtasks || []).filter((s) => s.text.trim());
    if (cleanSubtasks.length) base.subtasks = cleanSubtasks; else delete base.subtasks;
    if (editingTaskLabels?.length) base.labels = editingTaskLabels; else delete base.labels;
    if (editingTaskRecurrence) base.recurrence = editingTaskRecurrence; else delete base.recurrence;
    const nextTask = withDueHistory(base, editingTaskDue || null, now);
    updateCardTasks(index, {
      ...tasks,
      [taskId]: nextTask,
    });
    setEditingTaskId(null);
    setEditingTaskValue("");
    setEditingTaskImages([]);
    setEditingTaskDue("");
    setEditingTaskPriority(null);
    setEditingTaskSubtasks([]);
    setEditingTaskLabels([]);
    setEditingTaskRecurrence(null);
  }, [deleteTask, editingTaskDue, editingTaskImages, editingTaskLabels, editingTaskPriority, editingTaskRecurrence, editingTaskSubtasks, editingTaskValue, index, tasks, updateCardTasks]);

  useEffect(() => {
    if (!editingTaskId) return undefined;
    const handlePointerDown = (event) => {
      if (uploading) return;
      if (editFormRef.current?.contains(event.target)) return;
      if (event.target.closest?.('[data-fmt-pop], .mac-date-popover, .context-menu, [role="dialog"]')) return;
      saveEditedTask(editingTaskId);
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [editingTaskId, saveEditedTask, uploading]);

  const handleDeleteCard = () => { setCtxMenu(null); setToDelete("card");  setShowDeleteWarning(true); };
  const deleteAllTasks   = () => { setCtxMenu(null); setToDelete("tasks"); Object.keys(tasks).length > 0 ? setShowDeleteWarning(true) : setDefaultModal(true); };
  const clearNote        = () => {
    setCtxMenu(null);
    updateCardNote?.(index, { content: '', images: [] });
    toast.success('Note cleared');
  };
  const toggleDoneTask = (taskId) => {
    if (completingTaskId === taskId) return;
    const task = tasks[taskId];
    const nowDone = !task?.done;
    // Recurring task completed → advance its due date and keep it open instead of
    // marking it done / moving it to the Done column.
    if (nowDone && task?.recurrence) {
      const nowTs = Date.now();
      const nextDue = advanceDue(task.due, task.recurrence);
      const next = withDueHistory({ ...task, done: false, updatedAt: nowTs }, nextDue, nowTs);
      updateCardTasks(index, { ...tasks, [taskId]: next });
      toast.success(`Repeats ${formatDueShort(nextDue)}`);
      return;
    }
    if (!nowDone && isDoneColumn && onMoveTask) {
      const fallbackUid = allCards.find((card) => card.uid === task.previousCardUid && (card.type || 'todo') !== 'note')?.uid
        || allCards.find((card) => (card.type || 'todo') !== 'note' && /^to-?do$/i.test((card.title || '').trim()))?.uid
        || allCards.find((card) => (card.type || 'todo') !== 'note' && card.uid !== uid)?.uid;
      const reopened = markTaskOpen(task);
      if (fallbackUid) {
        onMoveTask(uid, taskId, fallbackUid, reopened);
      } else {
        updateCardTasks(index, { ...tasks, [taskId]: reopened });
      }
      return;
    }
    const updated = nowDone
      ? markTaskCompleted(task, { uid, title })
      : markTaskOpen(task);
    updateCardTasks(index, { ...tasks, [taskId]: updated });
    if (nowDone && onMoveToDone) {
      setCompletingTaskId(taskId);
      if (completionMoveTimerRef.current) window.clearTimeout(completionMoveTimerRef.current);
      completionMoveTimerRef.current = window.setTimeout(() => {
        onMoveToDone(taskId, updated);
        setCompletingTaskId((current) => (current === taskId ? null : current));
        completionMoveTimerRef.current = null;
      }, 520);
    }
  };

  useEffect(() => {
    if (completingTaskId && !tasks[completingTaskId]) setCompletingTaskId(null);
  }, [completingTaskId, tasks]);

  useEffect(() => () => {
    if (completionMoveTimerRef.current) window.clearTimeout(completionMoveTimerRef.current);
  }, []);

  const updateTaskDue = useCallback((taskId, nextDue) => {
    const currentTask = tasks[taskId];
    if (!currentTask) return;
    const now = Date.now();
    let nextTask = withDueHistory(
      { ...currentTask, updatedAt: now },
      nextDue || null,
      now
    );
    if (nextTask.done && nextTask.completedAt) {
      nextTask = {
        ...nextTask,
        completionTiming: getCompletionTiming(nextTask.due, nextTask.completedAt),
      };
    }
    updateCardTasks(index, { ...tasks, [taskId]: nextTask });
  }, [index, tasks, updateCardTasks]);

  // ── Image upload ───────────────────────────────────────────────────────────

  const processUpload = async (files, onDone) => {
    setUploading(true);
    const toastId = files.length > 1
      ? toast.loading(`Uploading ${files.length} images…`)
      : toast.loading('Uploading image…');
    try {
      const results = await Promise.allSettled(
        files.map(f => uploadImage(f))
      );
      const urls = [];
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') urls.push(r.value);
        else toast.error(`${files[i].name}: ${r.reason?.message || 'Upload failed'}`);
      });
      toast.dismiss(toastId);
      if (urls.length) onDone(urls);
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleEditUpload = async (e) => {
    const files = Array.from(e.target.files);
    e.target.value = '';
    await processUpload(files, (urls) => setEditingTaskImages(prev => [...prev, ...urls]));
    editEditorRef.current?.focus();
  };

  const handleNewUpload = async (e) => {
    const files = Array.from(e.target.files);
    e.target.value = '';
    await processUpload(files, (urls) => setNewTaskImages(prev => [...prev, ...urls]));
    newEditorRef.current?.focus();
  };

  const handleEditImagePaste = async (files) => {
    await processUpload(files, (urls) => setEditingTaskImages(prev => [...prev, ...urls]));
    editEditorRef.current?.focus();
  };

  const handleNewImagePaste = async (files) => {
    await processUpload(files, (urls) => setNewTaskImages(prev => [...prev, ...urls]));
    newEditorRef.current?.focus();
  };

  const removeEditingImage = (i) => {
    const url = editingTaskImages[i];
    if (isStorageUrl(url)) deleteImage(url);
    setEditingTaskImages(prev => prev.filter((_, idx) => idx !== i));
  };

  const removeNewImage = (i) => {
    const url = newTaskImages[i];
    if (isStorageUrl(url)) deleteImage(url);
    setNewTaskImages(prev => prev.filter((_, idx) => idx !== i));
  };

  // ── Computed ───────────────────────────────────────────────────────────────

  // Detect the theme register from its actual card surface so custom themes
  // resolve correctly too, then map the card's hue key to concrete colours.
  const isDark    = isDarkSurface(currentTheme?.colors?.bgCard);
  const cardColor = resolveCardColor(color, isDark);

  // ── Shared styles ──────────────────────────────────────────────────────────

  const thumbStyle = (clickable) => ({
    width: '48px', height: '48px', objectFit: 'cover',
    borderRadius: '4px', border: '1px solid var(--theme-border)',
    cursor: clickable ? 'pointer' : 'default',
    flexShrink: 0,
  });

  return (
    <div
      className={`card card--${layout}${isPinned ? " is-pinned" : ""}${collapsed ? " is-collapsed" : ""} transition-all duration-300 ease-in-out transform ${
        isMounted ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4"
      } shadow-lg relative`}
      style={{
        background: layout === 'lanes'
          ? 'color-mix(in srgb, var(--theme-bg-secondary) 82%, var(--theme-bg-card))'
          : cardColor.body,
        '--card-hue': cardColor.accent,
        '--card-tile-sheen': cardColor.tileSheen,
        '--card-tile-border': cardColor.tileBorder,
        '--card-tile-shadow': cardColor.tileShadow,
      }}
    >
      {/* Card header — drag handle */}
      <div
        className="card-title flex justify-between items-center text-sm"
        style={layout === 'grid'
          ? { backgroundColor: cardColor.header, color: cardColor.headerText, cursor: 'grab' }
          : { backgroundColor: 'transparent', color: 'var(--theme-text-primary)', cursor: 'grab' }}
        onContextMenu={openCardContextMenu}
        {...dragHandleProps}
      >
        <div className="h-full flex justify-between items-center">
          {compact && !isNote && (
            <button
              type="button"
              className="card-collapse-toggle"
              aria-label={collapsed ? 'Expand column' : 'Collapse column'}
              aria-expanded={!collapsed}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onToggleCollapsed?.(); }}
            >
              <VscChevronDown style={{ transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.15s' }} />
            </button>
          )}
          {layout !== 'grid' && <span className="lane-card-color-dot" aria-hidden="true" />}
          {isEditingTitle ? (
            <input
              type="text"
              value={editingTitleValue}
              onChange={e => setEditingTitleValue(e.target.value)}
              onBlur={saveCardTitle}
              onKeyDown={e => {
                e.stopPropagation();
                if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
                if (e.key === 'Escape') { e.preventDefault(); cancelEditCardTitle(); }
              }}
              onClick={e => e.stopPropagation()}
              onPointerDown={e => e.stopPropagation()}
              className="font-semibold px-2 bg-transparent border-b focus:outline-none"
              style={{
                color: layout === 'grid' ? cardColor.headerText : 'var(--theme-text-primary)',
                borderColor: 'currentColor',
                width: `${Math.max(editingTitleValue.length + 2, 6)}ch`,
                minWidth: '4rem',
                maxWidth: '14rem',
              }}
              autoFocus
              onFocus={e => e.target.select()}
            />
          ) : (
            <h5
              className="font-semibold text-center px-2 select-none"
              style={{ cursor: 'text' }}
              onDoubleClick={e => { e.stopPropagation(); startEditingTitle(); }}
              onPointerDown={e => e.stopPropagation()}
              title="Double-click to rename"
            >
              {renderTaskValue(title, query?.terms ?? searchTerm)}
            </h5>
          )}
          {isPinned && (
            <span className="card-pin-icon" title="Pinned card" aria-label="Pinned card">
              <PinIcon />
            </span>
          )}
          <div className="w-4 h-5 text-sm rounded-sm text-center"
            style={{
              color: 'inherit',
              background: layout !== 'grid'
                ? 'color-mix(in srgb, var(--card-hue) 12%, var(--theme-bg-hover))'
                : cardColor.headerBadge,
            }}>
            {Object.keys(tasks).length}
          </div>
          </div>
        {layout === 'lanes' && !isNote && !toggleAddTask && (
          <button
            type="button"
            className="lane-card-add"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              setToggleAddTask(true);
            }}
          >
            + Add
          </button>
        )}
        <div
          ref={menuTriggerRef}
          className="card-option-div h-7 w-9 pr-1 flex justify-center items-center cursor-pointer opacity-0"
          onClick={toggleCardOptionsMenu}
          onPointerDown={e => e.stopPropagation()}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="25" height="25" viewBox="0 0 30 30" fill="currentColor">
            <path d="M 4 11 C 1.791 11 0 12.791 0 15 C 0 17.209 1.791 19 4 19 C 6.209 19 8 17.209 8 15 C 8 12.791 6.209 11 4 11 z M 15 11 C 12.791 11 11 12.791 11 15 C 11 17.209 12.791 19 15 19 C 17.209 19 19 17.209 19 15 C 19 12.791 17.209 11 15 11 z M 26 11 C 23.791 11 22 12.791 22 15 C 22 17.209 23.791 19 26 19 C 28.209 19 30 17.209 30 15 C 30 12.791 28.209 11 26 11 z" />
          </svg>
        </div>
      </div>

      {/* Body: note editor for note cards, task list for todo cards */}
      {isNote ? (
        <NoteCard
          index={index}
          note={note}
          updateCardNote={updateCardNote}
          title={title}
          cardColor={cardColor}
        />
      ) : (
      <>
      {/* Task list */}
      <div className="task-list max-h-[30rem] overflow-y-auto">
        <SortableContext
          items={Object.keys(tasks)}
          strategy={layout === 'lanes' ? horizontalListSortingStrategy : verticalListSortingStrategy}
        >
          <ul className={layout === 'lanes' ? 'lane-task-row' : undefined}>
            {(() => {
              const allTasks = Object.values(tasks);
              const cardTitleMatches = query && !query.isEmpty && matchesCardTitle({ title }, query);
              let visibleTasks = (filterMode && query && !query.isEmpty && !cardTitleMatches)
                ? allTasks.filter((t) => matchesTask(t, query))
                : allTasks;
              if (labelFilter) {
                visibleTasks = visibleTasks.filter((t) =>
                  Array.isArray(t.labels) && t.labels.some((l) => l.name === labelFilter)
                );
              }
              if (scheduleView) {
                visibleTasks = visibleTasks.filter((t) => classifyTask(t) === scheduleView);
              }

              if (allTasks.length === 0) {
                return (
                  <li
                    ref={setEmptyDropRef}
                    className={`mac-col-empty${isEmptyOver ? ' is-drop-over' : ''}`}
                  >
                    <span>Nothing here yet</span>
                    <span className="mac-col-empty__hint">Drag a task here or create one below</span>
                  </li>
                );
              }
              if (visibleTasks.length === 0) return null;

              return visibleTasks.map((task) => (
                <SortableTask
                  key={task.id}
                  task={task}
                  cardUid={uid}
                  isEditing={editingTaskId === task.id}
                  className={`mac-task ${task.priority ? `is-prio-${task.priority}` : ""} ${task.done ? "is-done" : ""} ${
                    task.id === currentMatchTaskId ? "is-match" : ""
                  } ${task.id === flashTaskId ? "is-focus-flash" : ""} ${completingTaskId === task.id ? "is-completing" : ""} ${editingTaskId === task.id ? "is-editing" : "cursor-grab active:cursor-grabbing"}`}
                  onContextMenu={e => openTaskContextMenu(e, task)}
                >
                  {editingTaskId === task.id ? (
                    /* ── Edit mode ── */
                    <form
                      ref={editFormRef}
                      className="task-editor-shell task-editor-shell--edit"
                      onSubmit={e => { e.preventDefault(); saveEditedTask(task.id); }}
                    >
                      <FormattingToolbar
                        ref={editToolbarRef}
                        editorRef={editEditorRef}
                        onLinkNote={() => setNotePicker({ kind: 'task', taskId: task.id })}
                        priority={editingTaskPriority}
                        onPriority={setEditingTaskPriority}
                        recurrence={editingTaskRecurrence}
                        onRecurrence={setEditingTaskRecurrence}
                      />
                      <RichEditor
                        ref={editEditorRef}
                        initialHtml={editingTaskValue}
                        onChange={setEditingTaskValue}
                        onSave={() => saveEditedTask(task.id)}
                        onCancel={cancelEditingTask}
                        onRequestLink={() => editToolbarRef.current?.openLink()}
                        onImagePaste={handleEditImagePaste}
                        autoFocus
                        placeholder="Edit task…"
                        className="task-rich-editor"
                        style={{
                          background: 'transparent',
                          color: 'var(--theme-text-primary)',
                          fontFamily: 'inherit',
                          fontSize: '0.875rem',
                          outline: 'none', border: 'none',
                        }}
                      />

                      {/* Image thumbnails */}
                      {editingTaskImages.length > 0 && (
                        <div className="task-editor-attachments">
                          {editingTaskImages.map((src, i) => (
                            <div key={i} style={{ position: 'relative' }}>
                              <img src={src} alt={`img-${i}`} style={thumbStyle(false)} />
                              <button
                                type="button"
                                onClick={() => removeEditingImage(i)}
                                onPointerDown={e => e.stopPropagation()}
                                style={{
                                  position: 'absolute', top: -6, right: -6,
                                  background: 'var(--theme-danger)', border: 'none',
                                  borderRadius: '50%', color: 'white',
                                  width: 16, height: 16, padding: 0,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  cursor: 'pointer', fontSize: 10,
                                }}
                              >
                                <VscClose />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Subtasks */}
                      <SubtaskEditor subtasks={editingTaskSubtasks} onChange={setEditingTaskSubtasks} />

                      {/* Labels */}
                      <div style={{ padding: '0 12px 6px' }}>
                        <LabelPicker value={editingTaskLabels} onChange={setEditingTaskLabels} />
                      </div>

                      {/* Bottom action row */}
                      <div className="task-editor-actions">
                        <button
                          type="button"
                          onClick={() => !uploading && editFileInputRef.current?.click()}
                          onPointerDown={e => e.stopPropagation()}
                          disabled={uploading}
                          title="Attach image"
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'none', border: 'none', cursor: uploading ? 'not-allowed' : 'pointer',
                            color: 'var(--theme-text-muted)', padding: '3px 5px',
                            borderRadius: 6, fontSize: '1rem',
                            opacity: uploading ? 0.4 : 1, transition: 'color 0.12s',
                          }}
                          onMouseEnter={e => e.currentTarget.style.color = 'var(--theme-text-primary)'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--theme-text-muted)'}
                        >
                          <IoImageOutline />
                        </button>
                        <DatePicker
                          value={editingTaskDue}
                          onChange={setEditingTaskDue}
                          onPointerDown={e => e.stopPropagation()}
                        />
                        <div style={{ flex: 1 }} />
                        <button
                          type="button"
                          onPointerDown={e => e.stopPropagation()}
                          onClick={cancelEditingTask}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'var(--theme-text-muted)', fontSize: '0.75rem',
                            padding: '4px 8px', borderRadius: 6,
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          onPointerDown={e => e.stopPropagation()}
                          title="Save (Enter)"
                          style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            background: 'var(--theme-accent)', border: 'none',
                            borderRadius: 7, color: 'white',
                            fontSize: '0.78rem', fontWeight: 600,
                            padding: '5px 12px', cursor: 'pointer',
                          }}
                        >
                          <VscSave style={{ fontSize: '0.85rem' }} /> Save
                        </button>
                      </div>
                    </form>
                  ) : (
                    /* ── Display mode ── */
                    <>
                      <div
                        className="task-container"
                        onClick={() => startEditingTask(task.id, task.value, task.images)}
                        title="Click to edit"
                        style={{ userSelect: 'none', cursor: 'pointer' }}
                      >
                        <div className="mac-task__text">
                          {renderTaskValue(task.value, query?.terms ?? searchTerm)}
                        </div>
                      </div>

                      {/* Subtask checklist — toggle done directly */}
                      {task.subtasks?.length > 0 && (
                        <ul className="mac-subtasks" onClick={() => startEditingTask(task.id, task.value, task.images)}>
                          {task.subtasks.map((st) => (
                            <li key={st.id} className={`mac-subtask${st.done ? ' is-done' : ''}`}>
                              <button
                                type="button"
                                className="mac-subtask__check"
                                onPointerDown={e => e.stopPropagation()}
                                onClick={e => { e.stopPropagation(); toggleSubtask(task.id, st.id); }}
                                aria-label={st.done ? 'Mark subtask undone' : 'Mark subtask done'}
                              >
                                {st.done ? <VscCheck /> : <span className="mac-subtask__box" />}
                              </button>
                              <span className="mac-subtask__text">{st.text}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* Image thumbnails in display mode */}
                      {task.images?.length > 0 && (
                        <div className="mac-task__attachments" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px', justifyContent: 'flex-start' }}>
                          {task.images.map((src, i) => (
                            <img
                              key={i}
                              src={src}
                              alt={`attachment-${i}`}
                              style={thumbStyle(true)}
                              onClick={e => { e.stopPropagation(); setViewingImages({ images: task.images, index: i }); }}
                              onPointerDown={e => e.stopPropagation()}
                            />
                          ))}
                        </div>
                      )}

                      <div className="mac-task__footer">
                        <div className="mac-task__meta">
                          <TaskLabelChips labels={task.labels} />
                          {task.subtasks?.length > 0 && (
                            <span
                              className="mac-chip"
                              data-tone={task.subtasks.every((s) => s.done) ? 'done' : undefined}
                              title="Subtasks complete"
                            >
                              <VscChecklist style={{ fontSize: '0.85em' }} />
                              {task.subtasks.filter((s) => s.done).length}/{task.subtasks.length}
                            </span>
                          )}
                          {task.recurrence && (
                            <span className="mac-chip mac-recurrence-chip" title={`Repeats ${recurrenceLabel(task.recurrence)}`}>
                              <VscSync style={{ fontSize: '0.82em' }} />
                              {recurrenceLabel(task.recurrence)}
                            </span>
                          )}
                          {task.priority && getPriority(task.priority) && (
                            <span
                              className="mac-priority-chip"
                              style={{ '--prio-color': getPriority(task.priority).color, '--prio-bg': getPriority(task.priority).bg }}
                              title={`${getPriority(task.priority).label} priority`}
                            >
                              <span className="mac-priority-chip__dot" />
                              {getPriority(task.priority).label}
                            </span>
                          )}
                          {isDoneColumn && task.completedAt && (
                            <span className="mac-chip" data-tone="done">
                              <VscCheck style={{ fontSize: '0.85em' }} />
                              {new Date(task.completedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                          {isDoneColumn && task.completedAt && (
                            <span className="mac-chip" data-tone={completionTimingTone(task.completionTiming)}>
                              {completionTimingLabel(task.completionTiming).replace('Completed ', '')}
                            </span>
                          )}
                          {task.due && (
                            <DatePicker
                              value={task.due}
                              onChange={(nextDue) => updateTaskDue(task.id, nextDue)}
                              onPointerDown={e => e.stopPropagation()}
                              triggerClassName="mac-due-trigger--task-chip"
                              tone={dueTone(task)}
                            />
                          )}
                          {(() => {
                            const links = getNoteLinks(task);
                            if (!links.length) return null;
                            const first = links[0];
                            const extra = links.length - 1;
                            return (
                              <>
                                <button
                                  type="button"
                                  className="mac-note-chip"
                                  title={`Open note: ${getNoteTitle?.(first.noteUid) || 'note'}`}
                                  onPointerDown={e => e.stopPropagation()}
                                  onClick={e => { e.stopPropagation(); navigateToNote?.(first.noteUid); }}
                                >
                                  <VscNote style={{ fontSize: '0.9em', flexShrink: 0 }} />
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {getNoteTitle?.(first.noteUid) || 'Note'}
                                  </span>
                                </button>
                                {extra > 0 && (
                                  <button
                                    type="button"
                                    className="mac-note-chip mac-note-chip--more"
                                    title={`${extra} more linked note${extra === 1 ? '' : 's'}`}
                                    onPointerDown={e => e.stopPropagation()}
                                    onClick={e => {
                                      e.stopPropagation();
                                      const r = e.currentTarget.getBoundingClientRect();
                                      setLinkedPopover({ taskId: task.id, x: r.left, y: r.bottom + 4 });
                                    }}
                                  >
                                    +{extra}
                                  </button>
                                )}
                              </>
                            );
                          })()}
                        </div>
                        <div className="mac-task__actions">
                          {isDoneColumn && task.completedAt && (
                            <button
                              className="mac-task__btn is-timeline"
                              onClick={() => setTimelineTask(task)}
                              title="View task timeline"
                              aria-label="View task timeline"
                              onPointerDown={e => e.stopPropagation()}
                            >
                              <VscCalendar />
                            </button>
                          )}
                          {!isDoneColumn && (
                            <button
                              className="mac-task__btn is-edit"
                              onClick={() => startEditingTask(task.id, task.value, task.images)}
                              title="Edit task"
                              aria-label="Edit task"
                              onPointerDown={e => e.stopPropagation()}
                            >
                              <VscEdit />
                            </button>
                          )}
                          <button
                            className="mac-task__btn is-done"
                            onClick={() => toggleDoneTask(task.id)}
                            title={task.done ? "Reopen task" : "Mark as done"}
                            aria-label={task.done ? "Reopen task" : "Mark as done"}
                            onPointerDown={e => e.stopPropagation()}
                          >
                            {task.done ? <VscDebugRestart /> : <VscCheck />}
                          </button>
                          <button
                            className="mac-task__btn is-del"
                            onClick={() => deleteTask(task.id)}
                            title="Delete task"
                            aria-label="Delete task"
                            onPointerDown={e => e.stopPropagation()}
                          >
                            <VscTrash />
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </SortableTask>
              ));
            })()}
            {layout === 'lanes' && !toggleAddTask && !filterMode && !scheduleView && (
              <li className="lane-task-add-tile">
                <button type="button" onClick={() => setToggleAddTask(true)} aria-label={`Add task to ${title}`}>
                  <span aria-hidden="true">+</span>
                  <small>Add task</small>
                </button>
              </li>
            )}
          </ul>
        </SortableContext>
      </div>

      {/* Add task area */}
      {toggleAddTask ? (
        <form
          onSubmit={addTask}
          ref={inputRef}
          className={`task-editor-shell task-editor-shell--new${layout === 'lanes' ? ' lane-task-form' : ''}`}
        >
          {/* Formatting toolbar */}
          <FormattingToolbar
            ref={newToolbarRef}
            editorRef={newEditorRef}
            onLinkNote={() => setNotePicker({ kind: 'new' })}
            priority={newTaskPriority}
            onPriority={setNewTaskPriority}
            recurrence={newTaskRecurrence}
            onRecurrence={setNewTaskRecurrence}
          />

          {/* Text editor */}
          <RichEditor
            ref={newEditorRef}
            initialHtml=""
            onChange={setTaskValue}
            onSave={() => addTask()}
            onCancel={() => { setToggleAddTask(false); setTaskValue(''); setNewTaskImages([]); setNewTaskNoteLinks([]); }}
            onRequestLink={() => newToolbarRef.current?.openLink()}
            onMultilinePaste={(lines, text) => setPasteSplit({ lines, text })}
            onImagePaste={handleNewImagePaste}
            autoFocus
            placeholder="New task…"
            className="task-rich-editor"
            style={{
              background: 'transparent',
              color: 'var(--theme-text-primary)',
              fontFamily: 'inherit',
              fontSize: '0.875rem',
              outline: 'none',
              border: 'none',
            }}
          />

          {/* Image thumbnails */}
          {newTaskImages.length > 0 && (
            <div className="task-editor-attachments">
              {newTaskImages.map((src, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <img src={src} alt={`new-img-${i}`} style={thumbStyle(false)} />
                  <button
                    type="button"
                    onClick={() => removeNewImage(i)}
                    onPointerDown={e => e.stopPropagation()}
                    style={{
                      position: 'absolute', top: -6, right: -6,
                      background: 'var(--theme-danger)', border: 'none',
                      borderRadius: '50%', color: 'white',
                      width: 16, height: 16, padding: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', fontSize: 10,
                    }}
                  >
                    <VscClose />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Pending linked notes */}
          {newTaskNoteLinks.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 12px 8px' }}>
              {newTaskNoteLinks.map((l) => (
                <span key={l.noteUid} className="mac-note-chip" style={{ cursor: 'default' }}>
                  <VscNote style={{ fontSize: '0.9em', flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {getNoteTitle?.(l.noteUid) || 'Note'}
                  </span>
                  <span
                    role="button"
                    title="Remove"
                    onPointerDown={e => e.stopPropagation()}
                    onClick={() => toggleNewTaskNoteLink(l.noteUid)}
                    style={{ display: 'inline-flex', cursor: 'pointer', marginLeft: 2 }}
                  >
                    <VscClose style={{ fontSize: '0.85em' }} />
                  </span>
                </span>
              ))}
            </div>
          )}

          {/* Subtasks */}
          <SubtaskEditor subtasks={newTaskSubtasks} onChange={setNewTaskSubtasks} />

          {/* Labels */}
          <div style={{ padding: '0 12px 6px' }}>
            <LabelPicker value={newTaskLabels} onChange={setNewTaskLabels} />
          </div>

          {/* Bottom action row */}
          <div className="task-editor-actions">
            {/* Image upload */}
            <button
              type="button"
              onClick={() => !uploading && newFileInputRef.current?.click()}
              onPointerDown={e => e.stopPropagation()}
              disabled={uploading}
              title="Attach image"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'none', border: 'none', cursor: uploading ? 'not-allowed' : 'pointer',
                color: 'var(--theme-text-muted)', padding: '3px 5px',
                borderRadius: 6, fontSize: '1rem',
                opacity: uploading ? 0.4 : 1, transition: 'color 0.12s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--theme-text-primary)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--theme-text-muted)'}
            >
              <IoImageOutline />
            </button>

            {/* Date picker */}
            <DatePicker
              value={newTaskDue}
              onChange={setNewTaskDue}
              onPointerDown={e => e.stopPropagation()}
            />

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* Cancel */}
            <button
              type="button"
              onPointerDown={e => e.stopPropagation()}
              onClick={() => { setToggleAddTask(false); setTaskValue(''); setNewTaskImages([]); setNewTaskNoteLinks([]); }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--theme-text-muted)', fontSize: '0.75rem',
                padding: '4px 8px', borderRadius: 6,
              }}
            >
              Cancel
            </button>

            {/* Save */}
            <button
              type="submit"
              onPointerDown={e => e.stopPropagation()}
              title="Save task (Enter)"
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'var(--theme-accent)', border: 'none',
                borderRadius: 7, color: 'white',
                fontSize: '0.78rem', fontWeight: 600,
                padding: '5px 12px', cursor: 'pointer',
              }}
            >
              <VscSave style={{ fontSize: '0.85rem' }} /> Save
            </button>
          </div>
        </form>
      ) : layout === 'lanes' ? null : (
        <div
          onClick={() => setToggleAddTask(prev => !prev)}
          onContextMenu={openCreateTaskContextMenu}
          className="create-task-btn m-2 flex flex-col items-start cursor-pointer rounded-lg p-2"
          style={{ color: 'var(--theme-text-muted)', background: 'transparent' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--theme-bg-hover)'; e.currentTarget.style.color = 'var(--theme-text-primary)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--theme-text-muted)'; }}
        >
          + Create Task
        </div>
      )}

      {/* Hidden file inputs for image upload */}
      <input
        ref={editFileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={handleEditUpload}
      />
      <input
        ref={newFileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={handleNewUpload}
      />
      </>
      )}

      {showDeleteWarning && (
        <DeleteWarningModal
          index={index}
          updateCardTasks={updateCardTasks}
          setShowDeleteWarning={setShowDeleteWarning}
          toDelete={toDelete}
          updateCards={updateCards}
        />
      )}

      {defaultModal && <DefaultModal setDefaultModal={setDefaultModal} />}

      {ctxMenu && (
        <ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={ctxMenu.items} onClose={() => setCtxMenu(null)} />
      )}

      {colorPickerPos && createPortal(
        <CardColorPicker
          x={colorPickerPos.x}
          y={colorPickerPos.y}
          currentColor={color}
          isDark={isDark}
          onPick={updateCardColor}
          onClose={() => setColorPickerPos(null)}
        />,
        document.body
      )}

      {viewingImages && createPortal(
        <ImageModal
          images={viewingImages.images}
          initialIndex={viewingImages.index}
          onClose={() => setViewingImages(null)}
        />,
        document.body
      )}

      {pasteSplit && createPortal(
        <PasteSplitModal
          count={pasteSplit.lines.length}
          onSeparate={() => { addMultipleTasks(pasteSplit.lines); setPasteSplit(null); }}
          onSingle={() => { newEditorRef.current?.insertText(pasteSplit.lines.join('\n')); setPasteSplit(null); }}
          onClose={() => setPasteSplit(null)}
        />,
        document.body
      )}

      {notePicker && createPortal(
        <NotePickerModal
          notes={notes}
          linkedUids={notePicker.kind === 'new'
            ? newTaskNoteLinks.map((l) => l.noteUid)
            : getNoteLinks(tasks[notePicker.taskId]).map((l) => l.noteUid)}
          onToggle={(uid) => notePicker.kind === 'new'
            ? toggleNewTaskNoteLink(uid)
            : toggleTaskNoteLink(notePicker.taskId, uid)}
          onClose={() => setNotePicker(null)}
        />,
        document.body
      )}

      {linkedPopover && createPortal(
        <LinkedNotesPopover
          x={linkedPopover.x}
          y={linkedPopover.y}
          links={getNoteLinks(tasks[linkedPopover.taskId])}
          getNoteTitle={getNoteTitle}
          onNavigate={(uid) => { navigateToNote?.(uid); setLinkedPopover(null); }}
          onRemove={(uid) => {
            removeTaskNoteLink(linkedPopover.taskId, uid);
            const remaining = getNoteLinks(tasks[linkedPopover.taskId]).filter((l) => l.noteUid !== uid);
            if (remaining.length <= 1) setLinkedPopover(null);
          }}
          onManage={() => { const tid = linkedPopover.taskId; setLinkedPopover(null); setNotePicker({ kind: 'task', taskId: tid }); }}
          onClose={() => setLinkedPopover(null)}
        />,
        document.body
      )}

      {timelineTask && createPortal(
        <TaskTimelineModal
          task={timelineTask}
          cardTitle={title}
          onClose={() => setTimelineTask(null)}
        />,
        document.body
      )}
    </div>
  );
}

export default Card;

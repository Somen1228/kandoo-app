import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useContext,
  useMemo,
} from "react";
import { v4 as uuidv4 } from "uuid";
import { CARD_HUES, normalizeCardColor, pickCardColorKey } from "../../themes/cardPalettes";
import { generateTaskID } from "../../utils/taskIdGenerator";
import { toast } from "../../utils/toast";
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
  rectSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  restrictToHorizontalAxis,
  restrictToVerticalAxis,
} from "@dnd-kit/modifiers";
import Card from "./Card";
import NotesView from "./NotesView";
import FlowView from "./FlowView";
import { matchesTask, matchesCardTitle } from "../../utils/search";
import { classifyTask } from "../../utils/dueDate";
import { renderTaskValue } from "../../utils/richText";
import { isDoneColumnTitle, markTaskCompleted, markTaskOpen } from "../../utils/taskLifecycle";
import Modal from "./Modal";
import { CardsContext } from "../../contexts/CardsContext";
import { useSettings } from "../../contexts/SettingsContext";
import { useViewport } from "../../hooks/useViewport";
import { VscHistory, VscClose } from "react-icons/vsc";
import ResetWarningModal from "./ResetWarningModal";
import SendToBoardModal from "./SendToBoardModal";

const MAX_PINNED_CARDS = 3;
const BOARD_LAYOUTS = new Set(['grid', 'columns', 'lanes']);

const normalizeBoardLayout = (layout) => BOARD_LAYOUTS.has(layout) ? layout : 'grid';

function GridLayoutIcon() {
  return (
    <svg className="board-layout-switcher__icon" viewBox="0 0 24 24" aria-hidden="true">
      <rect className="layout-icon__tile layout-icon__tile--accent" x="4" y="4" width="6.5" height="6.5" rx="1.2" />
      <rect className="layout-icon__tile" x="13.5" y="4" width="6.5" height="6.5" rx="1.2" />
      <rect className="layout-icon__tile" x="4" y="13.5" width="6.5" height="6.5" rx="1.2" />
      <rect className="layout-icon__tile" x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2" />
    </svg>
  );
}

function ColumnsLayoutIcon() {
  return (
    <svg className="board-layout-switcher__icon" viewBox="0 0 24 24" aria-hidden="true">
      <rect className="layout-icon__panel" x="3.5" y="4" width="5" height="16" rx="1.2" />
      <rect className="layout-icon__panel layout-icon__tile--accent" x="9.5" y="4" width="5" height="16" rx="1.2" />
      <rect className="layout-icon__panel" x="15.5" y="4" width="5" height="16" rx="1.2" />
      <path className="layout-icon__line" d="M5.2 7h1.6M11.2 7h1.6M17.2 7h1.6" />
      <path className="layout-icon__line" d="M5.2 10.5h1.6M11.2 10.5h1.6M17.2 10.5h1.6" />
    </svg>
  );
}

function LanesLayoutIcon() {
  return (
    <svg className="board-layout-switcher__icon" viewBox="0 0 24 24" aria-hidden="true">
      <rect className="layout-icon__lane" x="4" y="4" width="16" height="4.8" rx="1.1" />
      <rect className="layout-icon__lane layout-icon__tile--accent" x="4" y="9.6" width="16" height="4.8" rx="1.1" />
      <rect className="layout-icon__lane" x="4" y="15.2" width="16" height="4.8" rx="1.1" />
      <path className="layout-icon__line" d="M7 6.4h5.2M7 12h7.8M7 17.6h4.4" />
    </svg>
  );
}

function BoardLayoutSwitcher({ value, onChange }) {
  const options = [
    { value: 'grid', label: 'Grid layout', icon: <GridLayoutIcon /> },
    { value: 'columns', label: 'Column layout', icon: <ColumnsLayoutIcon /> },
    { value: 'lanes', label: 'Lane layout', icon: <LanesLayoutIcon /> },
  ];

  return (
    <div className="board-layout-switcher" role="group" aria-label="Board layout">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`board-layout-switcher__btn${value === option.value ? ' is-active' : ''}`}
          onClick={() => onChange(option.value)}
          title={option.label}
          aria-label={option.label}
          aria-pressed={value === option.value}
        >
          {option.icon}
        </button>
      ))}
    </div>
  );
}

// Notes and todo cards share one persisted array. Reorder only todo-card slots
// so pinning a Kanban column never disturbs the Notes page hierarchy.
function pinnedCardsFirst(cards) {
  const orderedTodos = cards
    .filter((card) => (card.type || 'todo') === 'todo')
    .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
  let todoIndex = 0;
  return cards.map((card) =>
    (card.type || 'todo') === 'todo' ? orderedTodos[todoIndex++] : card
  );
}

function reorderTodoCards(cards, activeUid, overUid) {
  const todos = cards.filter((card) => (card.type || 'todo') === 'todo');
  const oldIndex = todos.findIndex((card) => card.uid === activeUid);
  const newIndex = todos.findIndex((card) => card.uid === overUid);
  if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return cards;

  const reorderedTodos = arrayMove(todos, oldIndex, newIndex);
  let todoIndex = 0;
  return pinnedCardsFirst(cards.map((card) =>
    (card.type || 'todo') === 'todo' ? reorderedTodos[todoIndex++] : card
  ));
}

// Build a tasks-map from extracted note checklist items. Checked items land as
// done, and each task keeps a backlink to its source note.
function buildTasksFromItems(items, noteUid) {
  const now = Date.now();
  const out = {};
  for (const it of items) {
    const id = generateTaskID();
    out[id] = {
      id,
      value: it.text,
      images: [],
      due: null,
      done: !!it.checked,
      createdAt: now,
      updatedAt: now,
      ...(noteUid ? { noteLinks: [{ noteUid }] } : {}),
    };
  }
  return out;
}

function SortableCardWrapper({ uid, layout, activeId, overCardUid, children }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: uid, data: { type: "card", uid } });

  return (
    <div
      ref={setNodeRef}
      className={`board-card-shell board-card-shell--${layout}${isDragging ? ' is-card-dragging' : ''}${activeId && overCardUid === uid && activeId !== uid ? ' is-card-drop-target' : ''}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      {children({ dragHandleProps: { ...attributes, ...listeners } })}
    </div>
  );
}

function CardDragPreview({ card, layout }) {
  const tasks = Object.values(card?.tasks || {});
  const colorKey = normalizeCardColor(card?.color);
  const cardHue = CARD_HUES.find((hue) => hue.key === colorKey)?.hex || 'var(--accent)';
  return (
    <div className={`board-card-drag-preview board-card-drag-preview--${layout}`}>
      <div className="board-card-drag-preview__head">
        <span className="lane-card-color-dot" style={{ '--card-hue': cardHue }} aria-hidden="true" />
        <span>{card?.title || 'Untitled'}</span>
        <small>{tasks.length}</small>
      </div>
      <div className="board-card-drag-preview__body">
        {tasks.slice(0, 3).map((task) => (
          <div key={task.id} className="board-card-drag-preview__task">
            {renderTaskValue(task.value)}
          </div>
        ))}
        {tasks.length === 0 && <div className="board-card-drag-preview__empty">No tasks</div>}
      </div>
    </div>
  );
}

function Cards({
  boardId, searchTerm, query, filterMode = false, labelFilter = null, currentMatchTaskId = null,
  quickAddSignal, section = "todos", setSection, scheduleView = null,
  onClearSchedule, taskCount = 0, storageLabel = "saved locally",
  otherBoardsWithMatches = [], totalMatches = 0, activeMatchCount = 0,
}) {
  const [activeNoteUid, setActiveNoteUid] = useState(null);
  const [sendToBoard, setSendToBoard] = useState(null); // { items, noteUid } | null
  const [focusedTask, setFocusedTask] = useState(null); // { taskId, cardUid, nonce } | null
  const { boards, setBoards, setBoardsSilent, defaultCards } = useContext(CardsContext);
  const { settings, setSetting } = useSettings();
  const board = boards.find((b) => b.id === boardId);
  const boardLayout = settings.boardLayoutScope === 'global'
    ? normalizeBoardLayout(settings.globalBoardLayout)
    : normalizeBoardLayout(board?.taskLayout);

  const changeBoardLayout = useCallback((nextLayout) => {
    const normalized = normalizeBoardLayout(nextLayout);
    if (settings.boardLayoutScope === 'global') {
      setSetting('globalBoardLayout', normalized);
      return;
    }
    setBoards((previous) => previous.map((candidate) =>
      candidate.id === boardId ? { ...candidate, taskLayout: normalized } : candidate
    ));
  }, [boardId, setBoards, setSetting, settings.boardLayoutScope]);
  const pinnedCardCount = useMemo(
    () => (board?.cards || []).filter((card) => (card.type || 'todo') === 'todo' && card.pinned).length,
    [board?.cards]
  );

  // Notes-section helpers
  const notesCards = useMemo(
    () => (board?.cards || []).filter((c) => c.type === 'note'),
    [board?.cards]
  );

  // Keep activeNoteUid valid as notes get added/deleted/loaded
  useEffect(() => {
    if (section !== 'notes') return;
    if (notesCards.length === 0) { setActiveNoteUid(null); return; }
    if (!notesCards.some((n) => n.uid === activeNoteUid)) {
      // Default to the most recently created note (last in array)
      setActiveNoteUid(notesCards[notesCards.length - 1].uid);
    }
  }, [notesCards, section, activeNoteUid]);

  // Create a note/page, optionally nested under `parentUid`. Returns its uid so
  // the /page block can reference the new child.
  const addChildNote = useCallback((parentUid = null, select = true) => {
    const uid = uuidv4();
    const newCard = {
      uid, type: 'note', title: 'Untitled', color: null, isVisible: true,
      parentUid: parentUid || null, tasks: {},
      note: { content: '', images: [], updatedAt: Date.now() },
    };
    setBoards((prev) => prev.map((b) =>
      b.id === boardId ? { ...b, cards: [...b.cards, newCard] } : b
    ));
    if (select) setActiveNoteUid(uid);
    return uid;
  }, [boardId, setBoards]);

  // Delete a page and every descendant page (cascade down the tree).
  const deleteNoteSubtree = useCallback((uid) => {
    setBoards((prev) => prev.map((b) => {
      if (b.id !== boardId) return b;
      const toDelete = new Set([uid]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const c of b.cards) {
          if (c.type === 'note' && c.parentUid && toDelete.has(c.parentUid) && !toDelete.has(c.uid)) {
            toDelete.add(c.uid);
            changed = true;
          }
        }
      }
      return { ...b, cards: b.cards.filter((c) => !toDelete.has(c.uid)) };
    }));
  }, [boardId, setBoards]);
  const [toggleModal, setToggleModal] = useState(false);
  const modalRef = useRef(null);
  const [warningBoardReset, setWarningBoardReset] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [activeType, setActiveType] = useState(null);
  const [activeOverCardUid, setActiveOverCardUid] = useState(null);
  const activeDragDataRef = useRef(null);
  // Phone accordion: columns are collapsible (tap the header chevron).
  const { isCompact } = useViewport();
  const [collapsedCols, setCollapsedCols] = useState(() => new Set());
  const toggleColumnCollapse = useCallback((cardUid) => {
    setCollapsedCols((prev) => {
      const next = new Set(prev);
      if (next.has(cardUid)) next.delete(cardUid); else next.add(cardUid);
      return next;
    });
  }, []);

  const sensors = useSensors(
    // Mouse keeps its small drag threshold; touch needs press-and-hold so a
    // finger-drag scrolls the list instead of accidentally grabbing a card/task.
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const addCard = useCallback(
    (title, color, type = 'todo') => {
      const uid = uuidv4();
      setBoards((prevBoards) =>
        prevBoards.map((b) => {
          if (b.id !== boardId) return b;
          // Auto-assign a balanced hue from the live board so colours spread out.
          const chosen = color || pickCardColorKey(b.cards.map((c) => c.color));
          const newCard = {
            uid,
            type,
            title,
            color: chosen,
            isVisible: false,
            tasks: {},
            ...(type === 'note' ? { note: { content: '', images: [], updatedAt: Date.now() } } : {}),
          };
          return { ...b, cards: [...b.cards, newCard] };
        })
      );
      setTimeout(() => {
        setBoards((prevBoards) =>
          prevBoards.map((b) =>
            b.id === boardId
              ? {
                  ...b,
                  cards: b.cards.map((card, index) =>
                    index === b.cards.length - 1
                      ? { ...card, isVisible: true }
                      : card
                  ),
                }
              : b
          )
        );
      }, 10);
      setToggleModal(false);
    },
    [boardId, setBoards]
  );

  const updateCardNote = useCallback(
    (cardIndex, note) => {
      setBoards((prevBoards) =>
        prevBoards.map((b) =>
          b.id === boardId
            ? {
                ...b,
                cards: b.cards.map((card, i) =>
                  i === cardIndex ? { ...card, note: { ...note, updatedAt: Date.now() } } : card
                ),
              }
            : b
        )
      );
    },
    [boardId, setBoards]
  );

  const updateCardTasks = useCallback(
    (cardIndex, tasks) => {
      setBoards((prevBoards) =>
        prevBoards.map((b) =>
          b.id === boardId
            ? {
                ...b,
                cards: b.cards.map((card, i) =>
                  i === cardIndex ? { ...card, tasks } : card
                ),
              }
            : b
        )
      );
    },
    [boardId, setBoards]
  );

  const updateCards = useCallback(
    (updateFn) => {
      setBoards((prevBoards) =>
        prevBoards.map((b) =>
          b.id === boardId ? { ...b, cards: updateFn(b.cards) } : b
        )
      );
    },
    [boardId, setBoards]
  );

  const moveTaskToCard = useCallback(
    (fromCardUid, taskId, toCardUid, overrideTask = null) => {
      if (!fromCardUid || !taskId || !toCardUid || fromCardUid === toCardUid) return false;
      let movedToTitle = '';
      setBoards((prevBoards) =>
        prevBoards.map((b) => {
          if (b.id !== boardId) return b;
          const fromCard = b.cards.find((card) => card.uid === fromCardUid);
          const toCard = b.cards.find((card) => card.uid === toCardUid);
          const task = overrideTask || fromCard?.tasks?.[taskId];
          if (!fromCard || !toCard || !task || (toCard.type || 'todo') === 'note') return b;

          const targetIsDone = isDoneColumnTitle(toCard.title);
          const sourceIsDone = isDoneColumnTitle(fromCard.title);
          let movedTask = overrideTask || task;
          if (targetIsDone) movedTask = markTaskCompleted(movedTask, fromCard);
          else if (sourceIsDone || movedTask.done) movedTask = markTaskOpen(movedTask);

          movedToTitle = toCard.title || 'Untitled card';
          return {
            ...b,
            cards: b.cards.map((card) => {
              if (card.uid === fromCardUid) {
                const nextTasks = { ...(card.tasks || {}) };
                delete nextTasks[taskId];
                return { ...card, tasks: nextTasks };
              }
              if (card.uid === toCardUid) {
                return { ...card, tasks: { ...(card.tasks || {}), [taskId]: movedTask } };
              }
              return card;
            }),
          };
        })
      );
      if (movedToTitle) toast.success(`Moved task to ${movedToTitle}`);
      return Boolean(movedToTitle);
    },
    [boardId, setBoards]
  );

  const toggleCardPin = useCallback((cardUid) => {
    setBoards((prev) => prev.map((b) => {
      if (b.id !== boardId) return b;
      const target = b.cards.find((card) => card.uid === cardUid);
      if (!target || (target.type || 'todo') !== 'todo') return b;
      const pinnedCount = b.cards.filter((card) => (card.type || 'todo') === 'todo' && card.pinned).length;
      if (!target.pinned && pinnedCount >= MAX_PINNED_CARDS) return b;

      const updatedCards = b.cards.map((card) => {
        if (card.uid !== cardUid) return card;
        if (card.pinned) {
          const next = { ...card };
          delete next.pinned;
          return next;
        }
        return { ...card, pinned: true };
      });
      return { ...b, cards: pinnedCardsFirst(updatedCards) };
    }));
  }, [boardId, setBoards]);

  // ── Notes ↔ Tasks links ─────────────────────────────────────────────────────

  // Jump from a task's backlink chip to its source note page.
  const navigateToNote = useCallback((uid) => {
    setSection?.('notes');
    setActiveNoteUid(uid);
  }, [setSection]);

  // Live title lookup for a task's note backlink (stays correct on rename).
  const getNoteTitle = useCallback(
    (uid) => board?.cards.find((c) => c.uid === uid)?.title || null,
    [board]
  );

  // Append checklist-derived tasks to an existing card by uid.
  const addTasksToCardUid = useCallback((cardUid, items, noteUid) => {
    setBoards((prev) => prev.map((b) => {
      if (b.id !== boardId) return b;
      return {
        ...b,
        cards: b.cards.map((c) =>
          c.uid === cardUid
            ? { ...c, tasks: { ...c.tasks, ...buildTasksFromItems(items, noteUid) } }
            : c
        ),
      };
    }));
  }, [boardId, setBoards]);

  // Create a new to-do card pre-filled with the checklist-derived tasks.
  const createCardWithTasks = useCallback((title, items, noteUid) => {
    setBoards((prev) => prev.map((b) => {
      if (b.id !== boardId) return b;
      const newCard = {
        uid: uuidv4(),
        type: 'todo',
        title,
        color: pickCardColorKey(b.cards.map((c) => c.color)),
        isVisible: true,
        tasks: buildTasksFromItems(items, noteUid),
      };
      return { ...b, cards: [...b.cards, newCard] };
    }));
  }, [boardId, setBoards]);

  // Confirm handler from the picker: add to an existing card or a new one.
  const confirmSendToBoard = useCallback((choice) => {
    if (!sendToBoard) return;
    const { items, noteUid, moveTask } = sendToBoard;
    if (moveTask) {
      const { taskId, cardUid: fromCardUid } = moveTask;
      let movedToTitle = '';
      let movedToUid = '';
      let moved = false;
      setBoards((prev) => prev.map((b) => {
        if (b.id !== boardId) return b;
        const fromCard = b.cards.find((card) => card.uid === fromCardUid);
        const task = fromCard?.tasks?.[taskId];
        if (!fromCard || !task) return b;

        const targetUid = choice.mode === 'existing' ? choice.cardUid : uuidv4();
        const targetTitle = choice.mode === 'existing'
          ? b.cards.find((card) => card.uid === choice.cardUid)?.title
          : choice.title.trim();
        if (!targetUid || (choice.mode === 'existing' && targetUid === fromCardUid)) return b;

        const targetIsDone = isDoneColumnTitle(targetTitle);
        const movedTask = targetIsDone
          ? markTaskCompleted(task, fromCard)
          : markTaskOpen(task);
        movedToTitle = targetTitle || 'Untitled card';
        movedToUid = targetUid;
        moved = true;

        if (choice.mode === 'new') {
          return {
            ...b,
            cards: b.cards.map((card) => {
              if (card.uid !== fromCardUid) return card;
              const nextTasks = { ...(card.tasks || {}) };
              delete nextTasks[taskId];
              return { ...card, tasks: nextTasks };
            }).concat({
              uid: targetUid,
              type: 'todo',
              title: movedToTitle,
              color: pickCardColorKey(b.cards.map((card) => card.color)),
              isVisible: true,
              tasks: { [taskId]: movedTask },
            }),
          };
        }

        return {
          ...b,
          cards: b.cards.map((card) => {
            if (card.uid === fromCardUid) {
              const nextTasks = { ...(card.tasks || {}) };
              delete nextTasks[taskId];
              return { ...card, tasks: nextTasks };
            }
            if (card.uid === targetUid) {
              return { ...card, tasks: { ...(card.tasks || {}), [taskId]: movedTask } };
            }
            return card;
          }),
        };
      }));
      if (moved) {
        toast.success(`Moved task to ${movedToTitle}`);
        setSection?.('todos');
        setFocusedTask({ taskId, cardUid: movedToUid, nonce: Date.now() });
      }
      setSendToBoard(null);
      return;
    }
    if (choice.mode === 'existing') addTasksToCardUid(choice.cardUid, items, noteUid);
    else createCardWithTasks(choice.title.trim(), items, noteUid);
    const n = items.length;
    toast.success(`Added ${n} task${n === 1 ? '' : 's'} to the board`, {
      action: { label: 'View', onClick: () => setSection?.('todos') },
    });
    setSendToBoard(null);
  }, [sendToBoard, addTasksToCardUid, boardId, createCardWithTasks, setBoards, setSection]);

  // Move a completed task to the Done column (called by Card when autoMoveDone is on)
  const moveTaskToDone = useCallback(
    (fromCardUid, taskId, taskData) => {
      setBoards((prevBoards) =>
        prevBoards.map((b) => {
          if (b.id !== boardId) return b;
          const fromCol = b.cards.find((card) => card.uid === fromCardUid);
          const doneCol = b.cards.find(
            (c) => c.type !== 'note' && isDoneColumnTitle(c.title)
          );
          if (!fromCol || !doneCol || doneCol.uid === fromCardUid) return b;
          const completedTask = markTaskCompleted(taskData, fromCol);
          return {
            ...b,
            cards: b.cards.map((col) => {
              if (col.uid === fromCardUid) {
                const { [taskId]: _, ...rest } = col.tasks;
                return { ...col, tasks: rest };
              }
              if (col.uid === doneCol.uid) {
                return { ...col, tasks: { ...col.tasks, [taskId]: completedTask } };
              }
              return col;
            }),
          };
        })
      );
    },
    [boardId, setBoards]
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        setToggleModal(false);
      }
    };
    if (toggleModal) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [toggleModal]);

  const resetBoard = () => {
    setBoards((prev) =>
      prev.map((b) => (b.id === board.id ? { ...b, cards: defaultCards } : b))
    );
  };

  const handleResetClick = () => setWarningBoardReset(true);
  const handleResetConfirm = () => { resetBoard(); setWarningBoardReset(false); };
  const handleCancel = () => setWarningBoardReset(false);

  // ── DnD handlers ───────────────────────────────────────────────────────────

  const handleDragStart = ({ active }) => {
    setActiveId(active.id);
    setActiveType(active.data.current?.type ?? null);
    setActiveOverCardUid(null);
    const activeData = active.data.current;
    const originCard = activeData?.type === 'task'
      ? board?.cards.find((card) => card.uid === activeData.cardUid)
      : null;
    activeDragDataRef.current = {
      ...activeData,
      originCardUid: originCard?.uid || activeData?.cardUid || null,
      originCardTitle: originCard?.title || '',
    };
  };

  const handleDragOver = useCallback(
    ({ active, over }) => {
      const activeData = active.data.current;
      const overData = over?.data.current;

      if (activeData?.type === 'card') {
        const overCardUid = overData?.type === 'task'
          ? overData.cardUid
          : overData?.type === 'card'
            ? (overData.cardUid ?? over?.id)
            : null;
        setActiveOverCardUid(overCardUid && overCardUid !== active.id ? overCardUid : null);
        return;
      }

      if (!over || active.id === over.id) return;
      if (activeData?.type !== "task") return;

      const overCardUid =
        overData?.type === "task"
          ? overData.cardUid
          : overData?.type === "card"
          ? (overData.cardUid ?? over.id)
          : null;

      if (!overCardUid) return;

      setBoards((prev) =>
        prev.map((b) => {
          if (b.id !== boardId) return b;
          const srcIdx = b.cards.findIndex((c) => c.tasks?.[active.id]);
          const tgtIdx = b.cards.findIndex((c) => c.uid === overCardUid);
          if (srcIdx < 0 || tgtIdx < 0) return b;
          if (srcIdx === tgtIdx) return b;

          const sourceCard = b.cards[srcIdx];
          const targetCard = b.cards[tgtIdx];
          const task = sourceCard.tasks[active.id];
          if (!task) return b;
          const origin = activeDragDataRef.current;
          const originCard = b.cards.find((card) => card.uid === origin?.originCardUid)
            || (origin?.originCardTitle ? { uid: origin.originCardUid, title: origin.originCardTitle } : null)
            || sourceCard;
          const movedTask = isDoneColumnTitle(targetCard.title)
            ? markTaskCompleted(task, originCard)
            : isDoneColumnTitle(sourceCard.title) || task.done
              ? markTaskOpen(task)
              : task;

          return {
            ...b,
            cards: b.cards.map((card, i) => {
              if (i === srcIdx) {
                const { [active.id]: _removed, ...rest } = card.tasks;
                return { ...card, tasks: rest };
              }
              if (i === tgtIdx) {
                const entries = Object.entries(card.tasks);
                const overIdx = entries.findIndex(([id]) => id === over.id);
                const insertAt = overIdx >= 0 ? overIdx : entries.length;
                entries.splice(insertAt, 0, [active.id, movedTask]);
                return { ...card, tasks: Object.fromEntries(entries) };
              }
              return card;
            }),
          };
        })
      );
    },
    [boardId, setBoards]
  );

  const handleDragEnd = useCallback(
    ({ active, over }) => {
      const captured = activeDragDataRef.current;
      setActiveId(null);
      setActiveType(null);
      setActiveOverCardUid(null);
      activeDragDataRef.current = null;

      if (!over || active.id === over.id || !captured) return;
      const overData = over.data.current;

      if (captured.type === "card") {
        const overCardUid = overData?.type === 'task'
          ? overData.cardUid
          : overData?.type === 'card'
            ? (overData.cardUid ?? over.id)
            : null;
        if (!overCardUid) return;
        setBoards((prev) =>
          prev.map((b) => {
            if (b.id !== boardId) return b;
            const cards = reorderTodoCards(b.cards, active.id, overCardUid);
            return cards === b.cards ? b : { ...b, cards };
          })
        );
      } else if (captured.type === "task") {
        // Cross-card moves were already handled in onDragOver.
        // Only handle same-card reorder here.
        const activeCardUid = captured.cardUid;
        const overCardUid =
          overData?.type === "task" ? overData.cardUid : over.id;
        if (!activeCardUid || !overCardUid || activeCardUid !== overCardUid) return;

        setBoards((prev) =>
          prev.map((b) => {
            if (b.id !== boardId) return b;
            const cardIdx = b.cards.findIndex((c) => c.uid === activeCardUid);
            if (cardIdx < 0) return b;
            const entries = Object.entries(b.cards[cardIdx].tasks);
            const oldIdx = entries.findIndex(([id]) => id === active.id);
            const newIdx = entries.findIndex(([id]) => id === over.id);
            if (oldIdx < 0 || newIdx < 0 || oldIdx === newIdx) return b;
            const reordered = arrayMove(entries, oldIdx, newIdx);
            const newCards = [...b.cards];
            newCards[cardIdx] = {
              ...newCards[cardIdx],
              tasks: Object.fromEntries(reordered),
            };
            return { ...b, cards: newCards };
          })
        );
      }
    },
    [boardId, setBoards]
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setActiveType(null);
    setActiveOverCardUid(null);
    activeDragDataRef.current = null;
  }, []);

  if (!board) return null;

  const todosCount = (board.cards || []).filter((c) => (c.type || 'todo') === 'todo').length;
  const notesCount = (board.cards || []).filter((c) => c.type === 'note').length;
  const flowsCount = (board.flows || []).length;
  const updateFlows = (updater) => {
    setBoards((prev) => prev.map((b) => (
      b.id === boardId
        ? { ...b, flows: typeof updater === 'function' ? updater(b.flows || []) : updater }
        : b
    )));
  };
  const updateFlowsSilent = (updater) => {
    setBoardsSilent((prev) => prev.map((b) => (
      b.id === boardId
        ? { ...b, flows: typeof updater === 'function' ? updater(b.flows || []) : updater }
        : b
    )));
  };
  const scheduleLabel = scheduleView
    ? scheduleView.charAt(0).toUpperCase() + scheduleView.slice(1)
    : null;
  // Cards keep their per-layout axis lock. Tasks must travel freely across cards
  // in every layout, so they get no modifier — restrictToFirstScrollableAncestor
  // would clamp a dragged task inside its source card's scrollable task-list,
  // preventing the overlay (and thus closestCenter) from ever reaching another card.
  const dragModifiers = activeType === 'card'
    ? boardLayout === 'columns'
      ? [restrictToHorizontalAxis]
      : boardLayout === 'lanes'
        ? [restrictToVerticalAxis]
        : []
    : [];
  const visibleCardEntries = board.cards
    .map((card, cardIndex) => ({ card, cardIndex }))
    .filter(({ card }) => {
      if ((card.type || 'todo') === 'note') return false;
      if (scheduleView && !Object.values(card.tasks || {}).some((task) => classifyTask(task) === scheduleView)) {
        return false;
      }
      if (labelFilter && !Object.values(card.tasks || {}).some((task) =>
        Array.isArray(task.labels) && task.labels.some((l) => l.name === labelFilter)
      )) {
        return false;
      }
      if (filterMode && query && !query.isEmpty && !matchesCardTitle(card, query)) {
        return Object.values(card.tasks || {}).some((task) => matchesTask(task, query));
      }
      return true;
    });

  return (
    <div className="mac-board">
      {/* Board header — segmented control + metadata */}
      <div className="mac-board-head">
        <div className="mac-segmented" role="tablist" aria-label="Board section">
          <button
            role="tab"
            aria-selected={section === 'todos'}
            className={`mac-segmented__btn${section === 'todos' ? ' is-active' : ''}`}
            onClick={() => setSection?.('todos')}
          >
            Tasks <span className="mac-segmented__count">{todosCount}</span>
          </button>
          <button
            role="tab"
            aria-selected={section === 'notes'}
            className={`mac-segmented__btn${section === 'notes' ? ' is-active' : ''}`}
            onClick={() => setSection?.('notes')}
          >
            Notes <span className="mac-segmented__count">{notesCount}</span>
          </button>
          <button
            role="tab"
            aria-selected={section === 'flow'}
            className={`mac-segmented__btn${section === 'flow' ? ' is-active' : ''}`}
            onClick={() => setSection?.('flow')}
          >
            Flow <span className="mac-segmented__count">{flowsCount}</span>
          </button>
        </div>

        {section === 'todos' && !scheduleView && (
          <span className="mac-board-head__meta">
            {taskCount} task{taskCount === 1 ? '' : 's'} · {storageLabel}
          </span>
        )}

        {scheduleView && (
          <button
            className="mac-chip"
            data-tone={scheduleView === 'overdue' ? 'overdue' : scheduleView === 'today' ? 'today' : 'upcoming'}
            onClick={onClearSchedule}
            title="Clear schedule filter"
            style={{ border: 'none', cursor: 'pointer' }}
          >
            {scheduleLabel} <VscClose style={{ marginLeft: 2 }} />
          </button>
        )}

        <div style={{ flex: 1 }} />

        {section === 'todos' && (
          <div className="mac-board-head__view-actions">
            <button
              onClick={handleResetClick}
              className="mac-iconbtn"
              title="Reset board to default"
              aria-label="Reset board to default"
            >
              <VscHistory />
            </button>
            <BoardLayoutSwitcher value={boardLayout} onChange={changeBoardLayout} />
          </div>
        )}
      </div>

      {section === 'notes' ? (
        <NotesView
          allCards={board.cards}
          notes={notesCards}
          activeUid={activeNoteUid}
          onSelectNote={setActiveNoteUid}
          onCreateNote={addChildNote}
          onDeleteNote={deleteNoteSubtree}
          updateCardNote={updateCardNote}
          updateCards={updateCards}
          onSendListToBoard={setSendToBoard}
          onOpenTaskBoard={(taskId, cardUid) => {
            setSection?.('todos');
            onClearSchedule?.();
            if (taskId) setFocusedTask({ taskId, cardUid, nonce: Date.now() });
          }}
        />
      ) : section === 'flow' ? (
        <FlowView
          flows={board.flows || []}
          updateFlows={updateFlows}
          updateFlowsSilent={updateFlowsSilent}
        />
      ) : (
        <div className="mac-board-scroll">
        <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={dragModifiers}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className={`container board-layout board-layout--${boardLayout}`} data-tour="board" data-layout={boardLayout}>
          <SortableContext
            items={visibleCardEntries.map(({ card }) => card.uid)}
            strategy={boardLayout === 'lanes'
              ? verticalListSortingStrategy
              : boardLayout === 'grid'
                ? rectSortingStrategy
                : horizontalListSortingStrategy}
          >
            {visibleCardEntries.map(({ card, cardIndex }, visibleIndex) => {
              return (
              <SortableCardWrapper
                key={card.uid}
                uid={card.uid}
                layout={boardLayout}
                activeId={activeType === 'card' ? activeId : null}
                overCardUid={activeOverCardUid}
              >
                {({ dragHandleProps }) => (
                  <Card
                    index={cardIndex}
                    uid={card.uid}
                    type={card.type || 'todo'}
                    title={card.title}
                    color={card.color}
                    isPinned={Boolean(card.pinned)}
                    pinnedCardCount={pinnedCardCount}
                    maxPinnedCards={MAX_PINNED_CARDS}
                    onTogglePin={toggleCardPin}
                    isVisible={card.isVisible}
                    tasks={card.tasks}
                    note={card.note}
                    updateCardTasks={updateCardTasks}
                    updateCardNote={updateCardNote}
                    updateCards={updateCards}
                    searchTerm={searchTerm}
                    query={query}
                    filterMode={filterMode}
                    labelFilter={labelFilter}
                    scheduleView={scheduleView}
                    currentMatchTaskId={currentMatchTaskId}
                    focusedTask={focusedTask?.cardUid === card.uid ? focusedTask : null}
                    quickAddSignal={visibleIndex === 0 ? quickAddSignal : 0}
                    dragHandleProps={dragHandleProps}
                    onMoveToDone={settings.autoMoveDone ? (taskId, taskData) => moveTaskToDone(card.uid, taskId, taskData) : undefined}
                    onMoveTask={moveTaskToCard}
                    navigateToNote={navigateToNote}
                    getNoteTitle={getNoteTitle}
                    notes={notesCards}
                    allCards={board.cards}
                    layout={boardLayout}
                    compact={isCompact}
                    collapsed={isCompact && collapsedCols.has(card.uid)}
                    onToggleCollapsed={() => toggleColumnCollapse(card.uid)}
                  />
                )}
              </SortableCardWrapper>
              );
            })}
          </SortableContext>

          {!scheduleView && !filterMode && (toggleModal ? (
            <Modal
              ref={modalRef}
              addCard={addCard}
              cards={board.cards}
              initialType={section === 'notes' ? 'note' : 'todo'}
            />
          ) : (
            <button onClick={() => setToggleModal(true)} className="add-btn">
              + Add {section === 'notes' ? 'Note' : 'Card'}
            </button>
          ))}

          {warningBoardReset && (
            <ResetWarningModal
              boardName={board.title}
              handleResetConfirm={handleResetConfirm}
              handleCancel={handleCancel}
            />
          )}
        </div>

        {filterMode && !query.isEmpty && activeMatchCount === 0 && (
          <div className="mac-empty" style={{ padding: '40px 24px' }}>
            <div className="mac-empty__title">No matches here</div>
            <div className="mac-empty__body">
              No tasks match “{query.raw}” in this board.
              {otherBoardsWithMatches.length > 0 && (
                <> Found {totalMatches} match{totalMatches > 1 ? 'es' : ''} in {otherBoardsWithMatches.length} other board{otherBoardsWithMatches.length > 1 ? 's' : ''}.</>
              )}
            </div>
          </div>
        )}

        <DragOverlay dropAnimation={{ duration: 180, easing: "ease-out" }}>
          {activeId && activeType === "card" && (() => {
            const card = board.cards.find((c) => c.uid === activeId);
            if (!card) return null;
            return <CardDragPreview card={card} layout={boardLayout} />;
          })()}
          {activeId && activeType === "task" && (() => {
            let task = activeDragDataRef.current?.task || null;
            if (!task) {
              for (const card of board.cards) {
                if (card.tasks[activeId]) { task = card.tasks[activeId]; break; }
              }
            }
            if (!task) return null;
            return (
              <div
                style={{
                  // True liquid glass for the floating dragged card — translucent
                  // so backdrop-blur refracts the board it moves over.
                  background:
                    "linear-gradient(315deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.04) 42%, rgba(255,255,255,0) 60%), color-mix(in srgb, var(--theme-bg-card) 78%, transparent)",
                  border: "1px solid var(--theme-task-border)",
                  borderRadius: "var(--board-corner)",
                  padding: "0.6rem 0.75rem",
                  minWidth: 200,
                  maxWidth: 280,
                  boxShadow:
                    "0 16px 36px rgba(0,0,0,0.30), inset 0 -1px 0 rgba(255,255,255,0.12)",
                  backdropFilter: "blur(18px) saturate(160%)",
                  WebkitBackdropFilter: "blur(18px) saturate(160%)",
                  transform: "rotate(1.5deg)",
                }}
              >
                <div className="mac-task__text">
                  {renderTaskValue(task.value)}
                </div>
              </div>
            );
          })()}
        </DragOverlay>
      </DndContext>
        </div>
      )}

      {sendToBoard && (
        <SendToBoardModal
          count={sendToBoard.items.length}
          items={sendToBoard.items}
          cards={board.cards.filter((c) =>
            (c.type || 'todo') === 'todo' && c.uid !== sendToBoard.moveTask?.cardUid
          )}
          variant={sendToBoard.moveTask ? 'move' : 'create'}
          onConfirm={confirmSendToBoard}
          onClose={() => setSendToBoard(null)}
        />
      )}
    </div>
  );
}

export default Cards;

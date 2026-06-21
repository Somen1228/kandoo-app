import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useContext,
  useMemo,
} from "react";
import { v4 as uuidv4 } from "uuid";
import { pickCardColorKey } from "../../themes/cardPalettes";
import { generateTaskID } from "../../utils/taskIdGenerator";
import { toast } from "../../utils/toast";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Card from "./Card";
import NotesView from "./NotesView";
import { matchesTask, matchesCardTitle, matchesNote } from "../../utils/search";
import { classifyTask } from "../../utils/dueDate";
import { renderTaskValue } from "../../utils/richText";
import Modal from "./Modal";
import { CardsContext } from "../../contexts/CardsContext";
import { useSettings } from "../../contexts/SettingsContext";
import { VscHistory, VscClose } from "react-icons/vsc";
import ResetWarningModal from "./ResetWarningModal";
import SendToBoardModal from "./SendToBoardModal";

const MAX_PINNED_CARDS = 3;

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

function SortableCardWrapper({ uid, children }) {
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
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      {children({ dragHandleProps: { ...attributes, ...listeners } })}
    </div>
  );
}

function Cards({
  boardId, searchTerm, query, filterMode = false, currentMatchTaskId = null,
  quickAddSignal, section = "todos", setSection, scheduleView = null,
  onClearSchedule, taskCount = 0, storageLabel = "saved locally",
  otherBoardsWithMatches = [], totalMatches = 0, activeMatchCount = 0,
}) {
  const [activeNoteUid, setActiveNoteUid] = useState(null);
  const [sendToBoard, setSendToBoard] = useState(null); // { items, noteUid } | null
  const { boards, setBoards, defaultCards } = useContext(CardsContext);
  const { settings } = useSettings();
  const board = boards.find((b) => b.id === boardId);
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
      uid, type: 'note', title: 'New page', color: null, isVisible: true,
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
  const activeDragDataRef = useRef(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
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
    const { items, noteUid } = sendToBoard;
    if (choice.mode === 'existing') addTasksToCardUid(choice.cardUid, items, noteUid);
    else createCardWithTasks(choice.title.trim(), items, noteUid);
    const n = items.length;
    toast.success(`Added ${n} task${n === 1 ? '' : 's'} to the board`, {
      action: { label: 'View', onClick: () => setSection?.('todos') },
    });
    setSendToBoard(null);
  }, [sendToBoard, addTasksToCardUid, createCardWithTasks, setSection]);

  // Move a completed task to the Done column (called by Card when autoMoveDone is on)
  const moveTaskToDone = useCallback(
    (fromCardUid, taskId, taskData) => {
      setBoards((prevBoards) =>
        prevBoards.map((b) => {
          if (b.id !== boardId) return b;
          const doneCol = b.cards.find(
            (c) => c.type !== 'note' && /^(done|completed|finished)$/i.test(c.title.trim())
          );
          if (!doneCol || doneCol.uid === fromCardUid) return b;
          return {
            ...b,
            cards: b.cards.map((col) => {
              if (col.uid === fromCardUid) {
                const { [taskId]: _, ...rest } = col.tasks;
                return { ...col, tasks: rest };
              }
              if (col.uid === doneCol.uid) {
                return { ...col, tasks: { ...col.tasks, [taskId]: taskData } };
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
    activeDragDataRef.current = { ...active.data.current };
  };

  const handleDragOver = useCallback(
    ({ active, over }) => {
      if (!over || active.id === over.id) return;
      const activeData = active.data.current;
      if (activeData?.type !== "task") return;

      const overData = over.data.current;
      const activeCardUid = activeData.cardUid;
      const overCardUid =
        overData?.type === "task"
          ? overData.cardUid
          : overData?.type === "card"
          ? over.id
          : null;

      if (!overCardUid || activeCardUid === overCardUid) return;

      setBoards((prev) =>
        prev.map((b) => {
          if (b.id !== boardId) return b;
          const srcIdx = b.cards.findIndex((c) => c.uid === activeCardUid);
          const tgtIdx = b.cards.findIndex((c) => c.uid === overCardUid);
          if (srcIdx < 0 || tgtIdx < 0) return b;

          const task = b.cards[srcIdx].tasks[active.id];
          if (!task) return b;

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
                entries.splice(insertAt, 0, [active.id, task]);
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
      activeDragDataRef.current = null;

      if (!over || active.id === over.id || !captured) return;
      const overData = over.data.current;

      if (captured.type === "card") {
        if (overData?.type !== "card") return;
        setBoards((prev) =>
          prev.map((b) => {
            if (b.id !== boardId) return b;
            const oldIdx = b.cards.findIndex((c) => c.uid === active.id);
            const newIdx = b.cards.findIndex((c) => c.uid === over.id);
            if (oldIdx < 0 || newIdx < 0 || oldIdx === newIdx) return b;
            return { ...b, cards: pinnedCardsFirst(arrayMove(b.cards, oldIdx, newIdx)) };
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

  if (!board) return null;

  const todosCount = (board.cards || []).filter((c) => (c.type || 'todo') === 'todo').length;
  const notesCount = (board.cards || []).filter((c) => c.type === 'note').length;
  const scheduleLabel = scheduleView
    ? scheduleView.charAt(0).toUpperCase() + scheduleView.slice(1)
    : null;

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
          <button
            onClick={handleResetClick}
            className="mac-iconbtn"
            title="Reset board to default"
            aria-label="Reset board to default"
          >
            <VscHistory />
          </button>
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
        />
      ) : (
        <div className="mac-board-scroll">
        <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="container" data-tour="board">
          <SortableContext
            items={board.cards
              .filter((c) => (section === 'notes' ? c.type === 'note' : (c.type || 'todo') === 'todo'))
              .map((c) => c.uid)}
            strategy={horizontalListSortingStrategy}
          >
            {board.cards.map((card, cardIndex) => {
              // Section filter — Todos tab hides notes, Notes tab hides everything else
              const cardType = card.type || 'todo';
              if (section === 'notes' && cardType !== 'note') return null;
              if (section === 'todos' && cardType === 'note') return null;

              // In schedule view, hide cards with no tasks in the active bucket.
              if (scheduleView) {
                const hasMatch = Object.values(card.tasks || {}).some(
                  (t) => classifyTask(t) === scheduleView
                );
                if (!hasMatch) return null;
              }

              // In filter mode, hide cards that have zero matching tasks AND
              // whose title doesn't match either.
              if (filterMode && query && !query.isEmpty) {
                const titleHit = matchesCardTitle(card, query);
                if (!titleHit) {
                  const hit = card.type === 'note'
                    ? matchesNote(card, query)
                    : Object.values(card.tasks || {}).some((t) => matchesTask(t, query));
                  if (!hit) return null;
                }
              }
              return (
              <SortableCardWrapper key={card.uid} uid={card.uid}>
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
                    scheduleView={scheduleView}
                    currentMatchTaskId={currentMatchTaskId}
                    quickAddSignal={cardIndex === 0 ? quickAddSignal : 0}
                    dragHandleProps={dragHandleProps}
                    onMoveToDone={settings.autoMoveDone ? (taskId, taskData) => moveTaskToDone(card.uid, taskId, taskData) : undefined}
                    navigateToNote={navigateToNote}
                    getNoteTitle={getNoteTitle}
                    notes={notesCards}
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
            return (
              <div
                style={{
                  background: "var(--theme-bg-card)",
                  border: "1px solid var(--theme-border)",
                  borderRadius: "0.5rem",
                  minWidth: 220,
                  boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
                  transform: "rotate(2deg)",
                  padding: "0.6rem 0.9rem",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  color: "var(--theme-text-primary)",
                }}
              >
                {card.title}
              </div>
            );
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
                  borderRadius: 14,
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
          cards={board.cards.filter((c) => (c.type || 'todo') === 'todo')}
          onConfirm={confirmSendToBoard}
          onClose={() => setSendToBoard(null)}
        />
      )}
    </div>
  );
}

export default Cards;

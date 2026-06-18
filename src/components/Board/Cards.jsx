import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useContext,
  useMemo,
} from "react";
import { v4 as uuidv4 } from "uuid";
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
import Modal from "./Modal";
import { CardsContext } from "../../contexts/CardsContext";
import { VscHistory } from "react-icons/vsc";
import ResetWarningModal from "./ResetWarningModal";

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

function Cards({ boardId, searchTerm, query, filterMode = false, currentMatchTaskId = null, quickAddSignal }) {
  const [section, setSection] = useState('todos'); // 'todos' | 'notes'
  const [activeNoteUid, setActiveNoteUid] = useState(null);
  const { boards, setBoards, defaultCards } = useContext(CardsContext);
  const board = boards.find((b) => b.id === boardId);

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

  const deleteNoteByUid = (uid) => {
    setBoards((prev) =>
      prev.map((b) =>
        b.id === boardId ? { ...b, cards: b.cards.filter((c) => c.uid !== uid) } : b
      )
    );
    // toast hint with built-in undo affordance
    // (the global Cmd+Z undo restores everything; the toast just makes it discoverable)
  };
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
      const newCard = {
        uid: uuidv4(),
        type,
        title,
        color,
        isVisible: false,
        tasks: {},
        ...(type === 'note' ? { note: { content: '', images: [], updatedAt: Date.now() } } : {}),
      };
      setBoards((prevBoards) =>
        prevBoards.map((b) =>
          b.id === boardId ? { ...b, cards: [...b.cards, newCard] } : b
        )
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
            return { ...b, cards: arrayMove(b.cards, oldIdx, newIdx) };
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

  return (
    <div>
      <div className="pl-10 option-container mb-4 w-auto">
        <div className="flex items-end justify-between">
          {/* Section tabs — browser-style */}
          <div
            role="tablist"
            aria-label="Card section"
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: '2px',
              borderBottom: '1px solid var(--theme-border)',
              marginBottom: '-1px',
            }}
          >
            {[
              { id: 'todos', label: 'Todos' },
              { id: 'notes', label: 'Notes (Beta)' },
            ].map((s) => {
              const isActive = section === s.id;
              const count = (board?.cards || []).filter((c) =>
                s.id === 'notes' ? c.type === 'note' : (c.type || 'todo') === 'todo'
              ).length;
              return (
                <button
                  key={s.id}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setSection(s.id)}
                  style={{
                    background: isActive ? 'var(--theme-bg-primary)' : 'transparent',
                    color: isActive ? 'var(--theme-text-primary)' : 'var(--theme-text-muted)',
                    border: '1px solid',
                    borderColor: isActive ? 'var(--theme-border)' : 'transparent',
                    borderBottomColor: isActive ? 'var(--theme-bg-primary)' : 'transparent',
                    borderTopLeftRadius: '0.5rem',
                    borderTopRightRadius: '0.5rem',
                    padding: '6px 14px 7px',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: isActive ? 600 : 500,
                    display: 'flex', alignItems: 'center', gap: 6,
                    transition: 'background 0.15s, color 0.15s',
                    position: 'relative',
                    top: '1px',
                  }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = 'var(--theme-text-primary)'; }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = 'var(--theme-text-muted)'; }}
                >
                  {s.label}
                  <span style={{
                    fontSize: '0.65rem',
                    padding: '1px 6px',
                    borderRadius: 999,
                    background: isActive ? 'var(--theme-bg-hover)' : 'var(--theme-bg-secondary)',
                    color: 'var(--theme-text-secondary)',
                    minWidth: 16, textAlign: 'center',
                  }}>{count}</span>
                </button>
              );
            })}
          </div>

          <button
            onClick={handleResetClick}
            className="header-icon-btn"
            style={{ color: "var(--theme-text-secondary)" }}
            title="Reset board to default"
          >
            <VscHistory className="text-xl" />
            <span className="header-icon-label">Reset</span>
          </button>
        </div>
      </div>

      {section === 'notes' ? (
        <>
          <NotesView
            allCards={board.cards}
            notes={notesCards}
            activeUid={activeNoteUid}
            onSelectNote={setActiveNoteUid}
            onAddNote={() => setToggleModal(true)}
            onDeleteNote={(uid) => {
              deleteNoteByUid(uid);
              if (uid === activeNoteUid) setActiveNoteUid(null);
            }}
            updateCardNote={updateCardNote}
            updateCards={updateCards}
          />

          {toggleModal && (
            <Modal
              ref={modalRef}
              addCard={(title, color, type) => {
                addCard(title, color, type);
                // After adding, the sync effect picks the new note as active
              }}
              cards={board.cards}
              initialType="note"
            />
          )}
        </>
      ) : (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="container pl-10">
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
                    isVisible={card.isVisible}
                    tasks={card.tasks}
                    note={card.note}
                    updateCardTasks={updateCardTasks}
                    updateCardNote={updateCardNote}
                    updateCards={updateCards}
                    searchTerm={searchTerm}
                    query={query}
                    filterMode={filterMode}
                    currentMatchTaskId={currentMatchTaskId}
                    quickAddSignal={cardIndex === 0 ? quickAddSignal : 0}
                    dragHandleProps={dragHandleProps}
                  />
                )}
              </SortableCardWrapper>
              );
            })}
          </SortableContext>

          {toggleModal ? (
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
          )}

          {warningBoardReset && (
            <ResetWarningModal
              boardName={board.title}
              handleResetConfirm={handleResetConfirm}
              handleCancel={handleCancel}
            />
          )}
        </div>

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
            let task = null;
            for (const card of board.cards) {
              if (card.tasks[activeId]) { task = card.tasks[activeId]; break; }
            }
            if (!task) return null;
            return (
              <div
                style={{
                  background: "var(--theme-task-bg)",
                  border: "1px solid var(--theme-task-border)",
                  borderRadius: "0.375rem",
                  padding: "0.5rem 0.625rem",
                  minWidth: 200,
                  maxWidth: 280,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
                  transform: "rotate(1.5deg)",
                }}
              >
                <p style={{ color: "var(--theme-text-primary)", fontSize: "0.875rem", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {task.value}
                </p>
              </div>
            );
          })()}
        </DragOverlay>
      </DndContext>
      )}
    </div>
  );
}

export default Cards;

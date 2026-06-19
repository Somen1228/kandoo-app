import { useContext, useMemo, useState, useRef, useEffect } from "react";
import { CardsContext } from "../contexts/CardsContext";
import { useSettings } from "../contexts/SettingsContext";
import { classifyTask, toDueString } from "../utils/dueDate";
import { generateTaskID } from "../utils/taskIdGenerator";
import { htmlToText, isHtml } from "../utils/htmlEditor";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow, Window } from "@tauri-apps/api/window";
import { VscAdd, VscCheck } from "react-icons/vsc";

const plain = (v) => (isHtml(v) ? htmlToText(v) : v || "");

function hideSelf() {
  try { if (isTauri()) getCurrentWindow().hide(); } catch { /* not in tauri */ }
}

export default function Panel() {
  const { boards, setBoards, isLoaded } = useContext(CardsContext);
  const { settings } = useSettings();
  const [text, setText] = useState("");
  const inputRef = useRef(null);

  const targetBoard = boards[0] || null;

  // Focus the quick-add input whenever the panel gains focus (i.e. is opened).
  useEffect(() => {
    const focusInput = () => inputRef.current?.focus();
    focusInput();
    window.addEventListener("focus", focusInput);
    return () => window.removeEventListener("focus", focusInput);
  }, []);

  // Esc dismisses the panel.
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") hideSelf(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Overdue + today tasks across every board (open todo tasks only).
  const agenda = useMemo(() => {
    const overdue = [], today = [];
    for (const b of boards) {
      b.cards.forEach((card, cardIndex) => {
        if ((card.type || "todo") !== "todo") return;
        for (const t of Object.values(card.tasks || {})) {
          if (t.done) continue;
          const bucket = classifyTask(t);
          const entry = { task: t, boardId: b.id, boardTitle: b.title, cardIndex };
          if (bucket === "overdue") overdue.push(entry);
          else if (bucket === "today") today.push(entry);
        }
      });
    }
    return { overdue, today };
  }, [boards]);

  const completeTask = (boardId, cardIndex, taskId) => {
    setBoards((prev) => prev.map((b) => {
      if (b.id !== boardId) return b;
      return {
        ...b,
        cards: b.cards.map((c, i) => {
          if (i !== cardIndex || !c.tasks[taskId]) return c;
          return { ...c, tasks: { ...c.tasks, [taskId]: { ...c.tasks[taskId], done: true } } };
        }),
      };
    }));
  };

  const quickAdd = (e) => {
    e?.preventDefault?.();
    const value = text.trim();
    if (!value || !targetBoard) return;
    const cardIndex = targetBoard.cards.findIndex((c) => (c.type || "todo") === "todo");
    if (cardIndex < 0) return;
    const id = generateTaskID(targetBoard.cards[cardIndex].title);
    const due = settings.quickAddDueToday ? toDueString(new Date()) : null;
    setBoards((prev) => prev.map((b) => {
      if (b.id !== targetBoard.id) return b;
      return {
        ...b,
        cards: b.cards.map((c, i) =>
          i === cardIndex ? { ...c, tasks: { ...c.tasks, [id]: { id, value, images: [], due } } } : c
        ),
      };
    }));
    setText("");
    inputRef.current?.focus();
  };

  const openMain = async () => {
    if (isTauri()) {
      try {
        const main = await Window.getByLabel("main");
        if (main) { await main.show(); await main.unminimize(); await main.setFocus(); }
      } catch { /* ignore */ }
    }
    hideSelf();
  };

  const total = agenda.overdue.length + agenda.today.length;
  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long", month: "short", day: "numeric",
  });

  return (
    <div className="kandoo-panel">
      <div className="kandoo-panel__head">
        <div>
          <div className="kandoo-panel__title">Today</div>
          <div className="kandoo-panel__sub">{dateLabel}</div>
        </div>
        <button className="kandoo-panel__open" onClick={openMain}>Open Kandoo</button>
      </div>

      <div className="kandoo-panel__scroll">
        {!isLoaded ? (
          <div className="kandoo-panel__empty">Loading…</div>
        ) : total === 0 ? (
          <div className="kandoo-panel__empty">
            <div className="kandoo-panel__empty-title">You&apos;re all caught up</div>
            <div>Nothing due today. Capture something below.</div>
          </div>
        ) : (
          <>
            {agenda.overdue.length > 0 && (
              <Section label="Overdue" tone="overdue" items={agenda.overdue} onComplete={completeTask} />
            )}
            {agenda.today.length > 0 && (
              <Section label="Today" tone="today" items={agenda.today} onComplete={completeTask} />
            )}
          </>
        )}
      </div>

      <form className="kandoo-panel__add" onSubmit={quickAdd}>
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={targetBoard ? `Add to ${targetBoard.title} · due today…` : "No board yet"}
          disabled={!targetBoard}
        />
        <button type="submit" disabled={!text.trim() || !targetBoard} aria-label="Add task">
          <VscAdd />
        </button>
      </form>
    </div>
  );
}

function Section({ label, tone, items, onComplete }) {
  return (
    <div className="kandoo-panel__section">
      <div className="kandoo-panel__section-label">
        <span className="mac-chip" data-tone={tone}>{label}</span>
        <span className="kandoo-panel__count">{items.length}</span>
      </div>
      {items.map(({ task, boardId, boardTitle, cardIndex }) => (
        <button
          key={`${boardId}-${task.id}`}
          className="kandoo-panel__task"
          onClick={() => onComplete(boardId, cardIndex, task.id)}
          title="Mark as done"
        >
          <span className="kandoo-panel__check"><VscCheck /></span>
          <span className="kandoo-panel__task-text">{plain(task.value)}</span>
          <span className="kandoo-panel__task-board">{boardTitle}</span>
        </button>
      ))}
    </div>
  );
}

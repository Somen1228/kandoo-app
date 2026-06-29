import { useState, useContext, useRef, useEffect, useMemo, useCallback } from "react";
import { parseQuery, searchBoards } from "../utils/search";
import { classifyTask } from "../utils/dueDate";
import {
  VscFilter, VscFilterFilled, VscChevronDown,
  VscArchive, VscQuestion,
  VscAccount, VscInbox, VscNotebook, VscLayoutSidebarLeft, VscClose,
  VscSettingsGear, VscSignIn, VscSignOut, VscCloud,
} from "react-icons/vsc";
import { toast } from '../utils/toast';
import { CgRename } from "react-icons/cg";
import { AiOutlineDelete } from "react-icons/ai";
import { IoColorFilterOutline } from "react-icons/io5";
import { v4 as uuidv4 } from "uuid";
import { useHotkeys } from "react-hotkeys-hook";
import { useLeaderChords, LEADER_LABEL } from "../hooks/useLeaderChords";
import { useViewport } from "../hooks/useViewport";
import { useDueNotifications } from "../hooks/useDueNotifications";
import { newLabelId, nextLabelColor, LABEL_COLORS } from "../utils/labels";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  DndContext, KeyboardSensor, MouseSensor, TouchSensor, closestCenter,
  useSensor, useSensors,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS as DndCSS } from "@dnd-kit/utilities";
import Cards from "../components/Board/Cards";
import { CardsContext } from "../contexts/CardsContext";
import { useSettings } from "../contexts/SettingsContext";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { kandooMascots } from "../assets/kandoo/mascots";
import WarningModal from "../components/Board/WarningModal";
import BoardSkeleton from "../components/Board/BoardSkeleton";
import SettingsModal from "../components/Settings/SettingsModal";
import ShortcutsHelpModal from "../components/ShortcutsHelpModal";
import ContextMenu from "../components/ContextMenu";
import ExportImportModal from "../components/Board/ExportImportModal";
import HelpModal from "../components/HelpModal";
import FeedbackModal from "../components/FeedbackModal";
import TaskConflictModal from "../components/Board/TaskConflictModal";
import OnboardingTour from "../components/OnboardingTour";
import MobileTabBar from "../components/MobileTabBar";
import BottomSheet from "../components/BottomSheet";

const SIDEBAR_MIN = 210;
const SIDEBAR_MAX = 360;

const escapeDataAttributeValue = (value) => {
  const text = String(value ?? "");
  if (typeof window !== "undefined" && window.CSS?.escape) {
    return window.CSS.escape(text);
  }
  return text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
};

function SortableBoardNavItem({ id, disabled = false, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
    data: { type: "sidebar-board" },
  });

  return (
    <div
      ref={setNodeRef}
      className="mac-board-sortable"
      style={{
        transform: DndCSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.55 : 1,
        position: "relative",
        zIndex: isDragging ? 2 : "auto",
      }}
    >
      {children({ ...attributes, ...listeners })}
    </div>
  );
}

// Smart sidebar sections — colour dots + labels, counts come from the board.
const SCHEDULE_SECTIONS = [
  { id: "overdue",  label: "Overdue",  dot: "var(--theme-danger)"  },
  { id: "today",    label: "Today",    dot: "var(--theme-accent)"  },
  { id: "upcoming", label: "Upcoming", dot: "var(--theme-warning)" },
  { id: "done",     label: "Done",     dot: "var(--theme-success)" },
];

function Board() {
  const {
    boards, setBoards, defaultCards, isLoaded, undo, redo,
    saveState, lastSavedAt, storageKind, syncState,
  } = useContext(CardsContext);
  const { user, isGuest, logout, exitOfflineMode } = useAuth();
  const { currentThemeId, allThemes, setTheme } = useTheme();
  const { settings, setSetting } = useSettings();
  const isDesktopApp = isTauri();

  // Desktop / in-app reminders for tasks due today or overdue.
  useDueNotifications(boards, settings.notifyDue !== false);
  useEffect(() => {
    const onReminder = (e) => {
      const n = e.detail?.count || 0;
      if (n > 0) toast(`${n} task${n === 1 ? '' : 's'} due today or overdue`, { duration: 6000 });
    };
    window.addEventListener("kandoo:due-reminder", onReminder);
    return () => window.removeEventListener("kandoo:due-reminder", onReminder);
  }, []);
  const [activeBoard, setActiveBoard] = useState(boards[0]?.id || null);
  const [editingBoardId, setEditingBoardId] = useState(null);
  const [newBoardTitle, setNewBoardTitle] = useState("");
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [boardToDelete, setBoardToDelete] = useState(null);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [headerTitleEditing, setHeaderTitleEditing] = useState(false);
  const [headerTitleValue, setHeaderTitleValue]     = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState("appearance");
  const [isLogoHovered, setIsLogoHovered] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [showExportImport, setShowExportImport]   = useState(false);
  const [showHelpModal, setShowHelpModal]         = useState(false);
  const [helpSection,   setHelpSection]           = useState(null);
  const [showFeedback,  setShowFeedback]          = useState(false);
  const [showMoreSheet, setShowMoreSheet]         = useState(false);
  const [showTour, setShowTour] = useState(() => localStorage.getItem('kandoo-tour-auto') !== '0');
  const [filterMode, setFilterMode]               = useState(false);
  const [currentMatchIdx, setCurrentMatchIdx]     = useState(0);
  const [showCrossBoardDropdown, setShowCrossBoardDropdown] = useState(false);
  const suppressBoardClickRef = useRef(false);
  const boardSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 7 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ── Shell state ─────────────────────────────────────────────────────────
  const [section, setSection] = useState("todos");          // 'todos' | 'notes'
  const [scheduleView, setScheduleView] = useState(null);   // null | overdue | today | upcoming | done
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(
    () => localStorage.getItem("kandoo-sidebar-collapsed") === "1"
  );
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const v = parseInt(localStorage.getItem("kandoo-sidebar-width") || "", 10);
    return Number.isFinite(v) ? Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, v)) : 248;
  });
  const { isCompact } = useViewport();
  useEffect(() => {
    // Don't let the mobile drawer's open/close overwrite the desktop preference.
    if (isCompact) return;
    localStorage.setItem("kandoo-sidebar-collapsed", isSidebarCollapsed ? "1" : "0");
  }, [isSidebarCollapsed, isCompact]);
  useEffect(() => {
    localStorage.setItem("kandoo-sidebar-width", String(sidebarWidth));
  }, [sidebarWidth]);
  // On compact screens the sidebar is an overlay drawer: start closed, and close
  // it after navigating to a board / section / schedule so content is visible.
  useEffect(() => {
    if (isCompact) setIsSidebarCollapsed(true);
  }, [isCompact, activeBoard, section, scheduleView]);

  // Track macOS fullscreen — the traffic lights vanish, so drop the space we
  // reserve for them (otherwise the logo looks like it's floating).
  useEffect(() => {
    if (!isDesktopApp) return;
    let unlisten;
    let cancelled = false;
    const win = getCurrentWindow();
    const sync = async () => {
      try {
        const fs = await win.isFullscreen();
        if (!cancelled) document.documentElement.classList.toggle("is-fullscreen", fs);
      } catch { /* permission/runtime */ }
    };
    sync();
    win.onResized(sync).then((fn) => { cancelled ? fn() : (unlisten = fn); });
    return () => { cancelled = true; if (unlisten) unlisten(); };
  }, [isDesktopApp]);

  const resizingRef = useRef(false);
  const startResize = (e) => {
    e.preventDefault();
    resizingRef.current = true;
    const onMove = (ev) => {
      if (!resizingRef.current) return;
      setSidebarWidth(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, ev.clientX)));
    };
    const onUp = () => {
      resizingRef.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
  };

  // ── Search ────────────────────────────────────────────────────────────────
  const query = useMemo(() => parseQuery(searchTerm), [searchTerm]);
  const perBoardResults = useMemo(
    () => (query.isEmpty ? [] : searchBoards(boards, query)),
    [boards, query]
  );
  const activeBoardResult = perBoardResults.find((r) => r.boardId === activeBoard);
  const activeMatches = activeBoardResult?.taskIds || [];
  const otherBoardsWithMatches = perBoardResults.filter(
    (r) => r.boardId !== activeBoard && r.matchCount > 0
  );
  const totalMatches = perBoardResults.reduce((s, r) => s + r.matchCount, 0);
  const currentMatchTaskId = activeMatches[currentMatchIdx] ?? null;

  const activeBoardObj = boards.find((b) => b.id === activeBoard);

  // ── Smart-section counts for the active board ───────────────────────────
  const scheduleCounts = useMemo(() => {
    const counts = { total: 0, overdue: 0, today: 0, upcoming: 0, done: 0, none: 0 };
    const board = boards.find((b) => b.id === activeBoard);
    if (!board) return counts;
    for (const card of board.cards || []) {
      if ((card.type || "todo") !== "todo") continue;
      for (const t of Object.values(card.tasks || {})) {
        counts.total += 1;
        const k = classifyTask(t);
        if (counts[k] !== undefined) counts[k] += 1;
      }
    }
    return counts;
  }, [boards, activeBoard]);

  const boardTaskCount = (board) => {
    if (!board) return 0;
    let n = 0;
    for (const card of board.cards || []) {
      if ((card.type || "todo") !== "todo") continue;
      n += Object.keys(card.tasks || {}).length;
    }
    return n;
  };

  // ── Labels (sidebar section) ────────────────────────────────────────────────
  const labels = settings.labels || [];
  const [labelsCollapsed, setLabelsCollapsed] = useState(
    () => localStorage.getItem("kandoo-labels-collapsed") === "1"
  );
  useEffect(() => {
    localStorage.setItem("kandoo-labels-collapsed", labelsCollapsed ? "1" : "0");
  }, [labelsCollapsed]);
  const [addingLabel, setAddingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState("");

  // Task count per label id, across every board.
  const labelCounts = useMemo(() => {
    const counts = {};
    for (const b of boards) {
      for (const card of b.cards || []) {
        if ((card.type || "todo") === "note") continue;
        for (const t of Object.values(card.tasks || {})) {
          if (!Array.isArray(t.labels)) continue;
          for (const l of t.labels) counts[l.id] = (counts[l.id] || 0) + 1;
        }
      }
    }
    return counts;
  }, [boards]);

  const createLabel = () => {
    const name = labelDraft.trim();
    setAddingLabel(false);
    setLabelDraft("");
    if (!name || labels.some((l) => l.name.toLowerCase() === name.toLowerCase())) return;
    setSetting("labels", [...labels, { id: newLabelId(), name, color: nextLabelColor(labels) }]);
  };

  // Edits propagate to the denormalised copies on every task so chips stay in sync.
  const mutateTaskLabels = (fn) => {
    setBoards((prev) => prev.map((b) => ({
      ...b,
      cards: (b.cards || []).map((c) => {
        if ((c.type || "todo") === "note" || !c.tasks) return c;
        let changed = false;
        const tasks = {};
        for (const [tid, t] of Object.entries(c.tasks)) {
          if (!Array.isArray(t.labels) || !t.labels.length) { tasks[tid] = t; continue; }
          const next = fn(t.labels);
          if (next === t.labels) { tasks[tid] = t; continue; }
          changed = true;
          if (next.length) tasks[tid] = { ...t, labels: next };
          else { const { labels: _drop, ...rest } = t; tasks[tid] = rest; }
        }
        return changed ? { ...c, tasks } : c;
      }),
    })));
  };

  const renameLabel = (id, name) => {
    const clean = name.trim();
    if (!clean) return;
    setSetting("labels", labels.map((l) => (l.id === id ? { ...l, name: clean } : l)));
    mutateTaskLabels((ls) => ls.map((l) => (l.id === id ? { ...l, name: clean } : l)));
  };
  const recolorLabel = (id, color) => {
    setSetting("labels", labels.map((l) => (l.id === id ? { ...l, color } : l)));
    mutateTaskLabels((ls) => ls.map((l) => (l.id === id ? { ...l, color } : l)));
  };
  const deleteLabel = (id) => {
    setSetting("labels", labels.filter((l) => l.id !== id));
    mutateTaskLabels((ls) => ls.filter((l) => l.id !== id));
  };
  const filterByLabel = (name) => {
    setSection("todos");
    setScheduleView(null);
    setSearchTerm(name);
    setFilterMode(true);
  };
  const openLabelMenu = (e, label) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({
      x: e.clientX, y: e.clientY,
      items: [
        { label: "Filter by this label", onClick: () => filterByLabel(label.name) },
        { label: "Rename…", onClick: () => {
          const next = window.prompt("Rename label", label.name);
          if (next != null) renameLabel(label.id, next);
        } },
        { divider: true },
        ...LABEL_COLORS.map((color) => ({
          label: label.color === color ? "✓ Colour" : "Colour",
          icon: <span style={{ width: 11, height: 11, borderRadius: "50%", background: color, display: "inline-block" }} />,
          onClick: () => recolorLabel(label.id, color),
        })),
        { divider: true },
        { label: "Delete label", danger: true, onClick: () => deleteLabel(label.id) },
      ],
    });
  };

  // Reset index when query changes or matches set shifts
  useEffect(() => { setCurrentMatchIdx(0); }, [query.raw, activeBoard]);

  // Scroll current match into view + brief flash
  useEffect(() => {
    if (!currentMatchTaskId) return;
    const el = document.querySelector(`[data-task-id="${escapeDataAttributeValue(currentMatchTaskId)}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [currentMatchTaskId]);

  const jumpToMatch = (delta) => {
    if (activeMatches.length === 0) return;
    setCurrentMatchIdx((i) => (i + delta + activeMatches.length) % activeMatches.length);
  };
  const [quickAddSignal, setQuickAddSignal] = useState(0);
  const [ctxMenu, setCtxMenu] = useState(null);
  const searchInputRef = useRef(null);

  // Auto-select the first board once boards load, or when the active one disappears
  useEffect(() => {
    if (boards.length > 0 && !boards.some((b) => b.id === activeBoard)) {
      setActiveBoard(boards[0].id);
    } else if (boards.length === 0 && activeBoard !== null) {
      setActiveBoard(null);
    }
  }, [boards, activeBoard]);

  // ===== Keyboard shortcuts =====
  const focusSearch = useCallback(() => {
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, []);

  const cycleTheme = useCallback(() => {
    if (!allThemes.length) return;
    const idx = allThemes.findIndex((t) => t.id === currentThemeId);
    const next = allThemes[(idx + 1) % allThemes.length];
    setTheme(next.id);
  }, [allThemes, currentThemeId, setTheme]);

  const quickAddTask = useCallback(() => {
    setSection("todos");
    setQuickAddSignal((s) => s + 1);
  }, []);

  // Command chord (⌘/Ctrl + J, then a key). The modifier leader lets these fire
  // from anywhere — including while a text input or the note editor is focused —
  // which the bare single-key shortcuts below can't safely do.
  const chordArmed = useLeaderChords({
    f: focusSearch,
    n: quickAddTask,
    t: cycleTheme,
    b: () => setIsSidebarCollapsed((c) => !c),
    s: () => setSection((sec) => (sec === "notes" ? "todos" : "notes")),
    h: () => setShowHelpModal(true),
    k: () => setShowShortcutsHelp(true),
    "?": () => setShowShortcutsHelp(true),
  });

  useHotkeys("mod+k, /", (e) => {
    e.preventDefault();
    focusSearch();
  }, { enableOnFormTags: ["input", "textarea"], preventDefault: true });

  useHotkeys("t", cycleTheme);

  useHotkeys("?", () => setShowShortcutsHelp(true));
  useHotkeys("shift+/", () => setShowShortcutsHelp(true));

  useHotkeys("mod+shift+1", (e) => {
    e.preventDefault();
    setShowHelpModal(true);
  });

  useHotkeys("mod+z",       (e) => { e.preventDefault(); undo(); });
  useHotkeys("mod+shift+z", (e) => { e.preventDefault(); redo(); });
  useHotkeys("mod+y",       (e) => { e.preventDefault(); redo(); });

  // N (or Cmd/Ctrl+N) adds a quick task to the active board's first card
  useHotkeys("n, mod+n", (e) => {
    e.preventDefault();
    quickAddTask();
  }, { preventDefault: true });

  // Cmd/Ctrl+B toggles the sidebar
  useHotkeys("mod+b", (e) => {
    e.preventDefault();
    setIsSidebarCollapsed((c) => !c);
  });

  // Esc closes any open Board-level overlay / filter
  useHotkeys("esc", () => {
    if (ctxMenu) { setCtxMenu(null); return; }
    if (showShortcutsHelp) { setShowShortcutsHelp(false); return; }
    if (showExportImport) { setShowExportImport(false); return; }
    if (showHelpModal) { setShowHelpModal(false); return; }
    if (showSettings) { setShowSettings(false); return; }
    if (showWarningModal) { setShowWarningModal(false); setBoardToDelete(null); return; }
    if (editingBoardId) { setEditingBoardId(null); return; }
    if (searchTerm) { setSearchTerm(""); return; }
    if (scheduleView) { setScheduleView(null); return; }
  }, { enableOnFormTags: ["input"] });

  const openBoardContextMenu = (e, board) => {
    e.preventDefault();
    e.stopPropagation();
    const items = [
      { label: "Rename board", icon: <CgRename/>, onClick: () => handleTitleClick(board.id, board.title) },
    ];
    if (boards.length > 1) {
      items.push({ divider: true });
      items.push({ label: "Delete board", icon: <AiOutlineDelete/>, danger: true, onClick: () => handleDeleteClick(board) });
    }
    setCtxMenu({ x: e.clientX, y: e.clientY, items });
  };

  const addBoard = () => {
    const newBoardId = uuidv4();
    const newBoard = {
      id: newBoardId,
      title: `Board ${boards.length + 1}`,
      cards: defaultCards,
    };
    setBoards([...boards, newBoard]);
    setActiveBoard(newBoardId);
    setScheduleView(null);
    setSection("todos");
    handleTitleClick(newBoardId, `Untitled ${boards.length + 1}`);
  };

  const deleteBoard = (boardId) => {
    const updatedBoards = boards.filter((board) => board.id !== boardId);
    setBoards(updatedBoards);
    if (boardId === activeBoard && updatedBoards.length > 0) {
      setActiveBoard(updatedBoards[0].id);
    } else if (updatedBoards.length === 0) {
      setActiveBoard(null);
    }
  };

  const handleTitleClick = (boardId, currentTitle) => {
    setEditingBoardId(boardId);
    setNewBoardTitle(currentTitle);
    setIsDuplicate(false);
  };

  const handleTitleChange = (e) => {
    setNewBoardTitle(e.target.value);
    setIsDuplicate(false);
  };

  const handleTitleBlur = (boardId) => {
    if (boards.some((board) => board.title === newBoardTitle && board.id !== boardId)) {
      setIsDuplicate(true);
    } else {
      const updatedBoards = boards.map((board) =>
        board.id === boardId ? { ...board, title: newBoardTitle } : board
      );
      setBoards(updatedBoards);
      setEditingBoardId(null);
      setIsDuplicate(false);
    }
  };

  const handleTitleKeyDown = (e, boardId) => {
    if (e.key === "Enter") handleTitleBlur(boardId);
    if (e.key === "Escape") setEditingBoardId(null);
  };

  const handleDeleteClick = (board) => {
    setBoardToDelete(board);
    setShowWarningModal(true);
  };

  const handleDeleteConfirm = () => {
    deleteBoard(boardToDelete.id);
    setShowWarningModal(false);
    setBoardToDelete(null);
  };

  const handleCancel = () => {
    setShowWarningModal(false);
    setBoardToDelete(null);
  };

  const handleSearch = (e) => setSearchTerm(e.target.value);

  // Clicking a task's label chip filters every board by that label.
  useEffect(() => {
    const onSet = (e) => { setSearchTerm(e.detail || ""); setFilterMode(true); };
    window.addEventListener("kandoo:set-search", onSet);
    return () => window.removeEventListener("kandoo:set-search", onSet);
  }, []);

  const selectBoard = (id) => {
    setActiveBoard(id);
    setScheduleView(null);
  };

  const handleBoardDragEnd = ({ active, over }) => {
    window.setTimeout(() => { suppressBoardClickRef.current = false; }, 0);
    if (!over || active.id === over.id) return;
    setBoards((current) => {
      const from = current.findIndex((board) => board.id === active.id);
      const to = current.findIndex((board) => board.id === over.id);
      return from < 0 || to < 0 ? current : arrayMove(current, from, to);
    });
  };

  const openSettings = (tab = "appearance") => { setSettingsTab(tab); setShowSettings(true); };

  const signOut = async () => {
    try { await logout(); }
    catch (error) { toast.error(error.message || "Could not sign out"); }
  };

  const openAccountMenu = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const identity = user?.displayName || user?.email || user?.phone || "Kandoo account";
    const syncMenuLabel = syncState === "synced"
      ? "Cloud sync · Up to date"
      : syncState === "syncing" || syncState === "connecting"
        ? "Cloud sync · Syncing"
        : syncState === "conflict"
          ? "Cloud sync · Needs attention"
          : "Cloud sync · Offline";
    setCtxMenu({
      x: rect.right - 210,
      y: rect.bottom + 6,
      items: [
        { label: identity, icon: <VscAccount />, onClick: () => openSettings("account") },
        { label: syncMenuLabel, icon: <VscCloud />, onClick: () => openSettings("account") },
        { divider: true },
        { label: "Sign out", icon: <VscSignOut />, onClick: signOut },
      ],
    });
  };

  const resetWorkspace = () => {
    const id = uuidv4();
    setBoards([{ id, title: "Untitled", cards: defaultCards }]);
    setActiveBoard(id);
    setScheduleView(null);
    setSection("todos");
    toast.success("Workspace reset");
  };

  const savedAtLabel = lastSavedAt
    ? ` · ${lastSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
    : "";
  const localStorageLabel = storageKind === "sqlite" ? "Saved on this Mac" : "Saved locally";
  const storageLabel = saveState === "saving"
    ? (user ? "Saving & syncing…" : "Saving…")
    : saveState === "error"
      ? "Save failed"
      : user
        ? syncState === "synced"
          ? `Synced to cloud${savedAtLabel}`
          : syncState === "syncing" || syncState === "connecting"
            ? "Syncing to cloud…"
            : syncState === "conflict"
              ? "Sync needs attention"
              : `${localStorageLabel}${savedAtLabel} · Cloud offline`
        : `${localStorageLabel}${savedAtLabel}`;

  return (
    <div className={`mac-shell${isDesktopApp ? " is-desktop-window" : ""}`}>
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className={`mac-sidebar${isSidebarCollapsed ? " is-collapsed" : ""}`}
        style={{ "--sidebar-width": `${sidebarWidth}px` }}>
        <div className="mac-sidebar__inner" style={{ width: sidebarWidth, minWidth: sidebarWidth }}>
          <div className="mac-sidebar__brand" data-tauri-drag-region={isDesktopApp || undefined}>
            {!isDesktopApp && (
              <>
                <img
                  className="mac-sidebar__brand-logo"
                  src={isLogoHovered ? kandooMascots.success : kandooMascots.calm}
                  alt="Kandoo"
                  onMouseEnter={() => setIsLogoHovered(true)}
                  onMouseLeave={() => setIsLogoHovered(false)}
                />
                <span className="mac-sidebar__wordmark">Kandoo</span>
              </>
            )}
          </div>

          <div className="mac-sidebar__scroll">
            {/* Projects */}
            <div className="mac-sidebar__section">
              <div className="mac-sidebar__label">
                <span>Projects</span>
                <button className="mac-sidebar__add" onClick={addBoard} title="New project" aria-label="New project">+</button>
              </div>
              <DndContext
                sensors={boardSensors}
                collisionDetection={closestCenter}
                onDragStart={() => { suppressBoardClickRef.current = true; }}
                onDragCancel={() => { window.setTimeout(() => { suppressBoardClickRef.current = false; }, 0); }}
                onDragEnd={handleBoardDragEnd}
              >
                <SortableContext items={boards.map((board) => board.id)} strategy={verticalListSortingStrategy}>
              {boards.map((board) => (
                <SortableBoardNavItem key={board.id} id={board.id} disabled={editingBoardId === board.id}>
                  {(dragProps) => editingBoardId === board.id ? (
                  <div style={{ padding: "2px 10px", position: "relative" }}>
                    <input
                      type="text"
                      value={newBoardTitle}
                      onChange={handleTitleChange}
                      onBlur={() => handleTitleBlur(board.id)}
                      onKeyDown={(e) => handleTitleKeyDown(e, board.id)}
                      className="w-full bg-transparent focus:outline-none"
                      style={{
                        borderBottom: `2px solid ${isDuplicate ? "var(--theme-danger)" : "var(--theme-accent)"}`,
                        color: "var(--theme-text-primary)",
                        fontSize: "0.86rem",
                        padding: "3px 0",
                      }}
                      autoFocus
                    />
                    {isDuplicate && (
                      <div style={{
                        marginTop: 6, padding: "6px 8px", fontSize: "0.7rem",
                        background: "var(--theme-danger-bg)", color: "var(--theme-danger)",
                        border: "1px solid var(--theme-danger)", borderRadius: "var(--radius-sm)",
                      }}>
                        A board with this title already exists.
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    className={`mac-nav-item${board.id === activeBoard ? " is-active" : ""}`}
                    onClick={() => { if (!suppressBoardClickRef.current) selectBoard(board.id); }}
                    onDoubleClick={() => handleTitleClick(board.id, board.title)}
                    onContextMenu={(e) => openBoardContextMenu(e, board)}
                    title="Drag to reorder · double-click to rename"
                    {...dragProps}
                  >
                    <span className="mac-nav-item__label">{board.title}</span>
                    {boardTaskCount(board) > 0 && (
                      <span className="mac-nav-item__count">{boardTaskCount(board)}</span>
                    )}
                  </button>
                )}
                </SortableBoardNavItem>
              ))}
                </SortableContext>
              </DndContext>
            </div>

            {/* Smart sections */}
            <div className="mac-sidebar__section">
              <div className="mac-sidebar__label">Tasks</div>
              <button
                className={`mac-nav-item${section === "todos" && !scheduleView ? " is-active" : ""}`}
                onClick={() => { setSection("todos"); setScheduleView(null); }}
              >
                <span className="mac-nav-item__icon"><VscInbox /></span>
                <span className="mac-nav-item__label">All Tasks</span>
                {scheduleCounts.total > 0 && (
                  <span className="mac-nav-item__count">{scheduleCounts.total}</span>
                )}
              </button>
              {SCHEDULE_SECTIONS.map((s) => (
                <button
                  key={s.id}
                  className={`mac-nav-item${section === "todos" && scheduleView === s.id ? " is-active" : ""}`}
                  onClick={() => { setSection("todos"); setScheduleView((v) => (v === s.id ? null : s.id)); }}
                >
                  <span className="mac-nav-item__icon">
                    <span className="mac-nav-item__dot" style={{ background: s.dot }} />
                  </span>
                  <span className="mac-nav-item__label">{s.label}</span>
                  {scheduleCounts[s.id] > 0 && (
                    <span className="mac-nav-item__count">{scheduleCounts[s.id]}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Labels */}
            <div className="mac-sidebar__section">
              <div className="mac-sidebar__label mac-sidebar__label--labels">
                <button
                  type="button"
                  className="mac-labels-toggle"
                  onClick={() => setLabelsCollapsed((c) => !c)}
                  aria-expanded={!labelsCollapsed}
                >
                  <VscChevronDown
                    className="mac-labels-chevron"
                    style={{ transform: labelsCollapsed ? "rotate(-90deg)" : "none" }}
                  />
                  <span>Labels</span>
                </button>
                <button
                  className="mac-sidebar__add"
                  onClick={() => { setLabelsCollapsed(false); setAddingLabel(true); }}
                  title="New label"
                  aria-label="New label"
                >+</button>
              </div>

              {!labelsCollapsed && (
                <div className="mac-labels-list">
                  {labels.map((l) => {
                    const active = section === "todos" && filterMode && searchTerm === l.name;
                    return (
                      <button
                        key={l.id}
                        className={`mac-nav-item${active ? " is-active" : ""}`}
                        onClick={() => filterByLabel(l.name)}
                        onContextMenu={(e) => openLabelMenu(e, l)}
                        title={`Filter by “${l.name}”`}
                      >
                        <span className="mac-nav-item__icon">
                          <span className="mac-nav-item__dot" style={{ background: l.color }} />
                        </span>
                        <span className="mac-nav-item__label">{l.name}</span>
                        {labelCounts[l.id] > 0 && (
                          <span className="mac-nav-item__count">{labelCounts[l.id]}</span>
                        )}
                      </button>
                    );
                  })}

                  {addingLabel && (
                    <input
                      className="mac-labels-input"
                      autoFocus
                      value={labelDraft}
                      onChange={(e) => setLabelDraft(e.target.value)}
                      onBlur={createLabel}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); createLabel(); }
                        if (e.key === "Escape") { setAddingLabel(false); setLabelDraft(""); }
                      }}
                      placeholder="New label…"
                    />
                  )}

                  {!labels.length && !addingLabel && (
                    <div className="mac-labels-empty">No labels yet</div>
                  )}
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="mac-sidebar__section">
              <div className="mac-sidebar__label">Workspace</div>
              <button
                className={`mac-nav-item${section === "notes" ? " is-active" : ""}`}
                onClick={() => setSection("notes")}
              >
                <span className="mac-nav-item__icon"><VscNotebook /></span>
                <span className="mac-nav-item__label">Notes</span>
                <span className="mac-chip" style={{ height: 16, fontSize: "0.6rem", padding: "0 6px" }}>Beta</span>
              </button>
            </div>
          </div>

          <div className="mac-sidebar__footer" data-state={saveState === "error" ? "error" : undefined}
            title={saveState === "error" ? "Kandoo could not save the latest changes" : storageLabel}>
            <span className="mac-sidebar__save-label">{storageLabel}</span>
            <button className="mac-sidebar__settings" onClick={() => openSettings("appearance")} title="Settings" aria-label="Open settings">
              <VscSettingsGear />
            </button>
          </div>
        </div>

        <div className="mac-sidebar__resizer" onMouseDown={startResize} title="Drag to resize" />
      </aside>

      {/* Scrim behind the drawer on compact screens — tap to dismiss */}
      {isCompact && !isSidebarCollapsed && (
        <div className="mac-sidebar-scrim" onClick={() => setIsSidebarCollapsed(true)} aria-hidden="true" />
      )}

      {/* ── Main column ─────────────────────────────────────────────────── */}
      <div className="mac-main">
        <header className="mac-toolbar" data-tauri-drag-region={isDesktopApp || undefined}>
          <button
            className="mac-iconbtn"
            onClick={() => setIsSidebarCollapsed((c) => !c)}
            title={isSidebarCollapsed ? "Show sidebar (⌘B)" : "Hide sidebar (⌘B)"}
            aria-label="Toggle sidebar"
            aria-pressed={!isSidebarCollapsed}
          >
            <VscLayoutSidebarLeft />
          </button>

          {headerTitleEditing ? (
            <input
              type="text"
              value={headerTitleValue}
              onChange={(e) => setHeaderTitleValue(e.target.value)}
              onBlur={() => {
                const trimmed = headerTitleValue.trim();
                if (trimmed && !boards.some((b) => b.title === trimmed && b.id !== activeBoard)) {
                  setBoards((prev) => prev.map((b) => b.id === activeBoard ? { ...b, title: trimmed } : b));
                }
                setHeaderTitleEditing(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.target.blur();
                if (e.key === "Escape") setHeaderTitleEditing(false);
              }}
              className="mac-toolbar__title bg-transparent focus:outline-none"
              style={{ borderBottom: "2px solid var(--theme-accent)" }}
              autoFocus
            />
          ) : (
            <h1
              className="mac-toolbar__title"
              data-tauri-drag-region={isDesktopApp || undefined}
              style={{ cursor: activeBoardObj ? "text" : "default" }}
              onDoubleClick={() => {
                if (activeBoardObj) { setHeaderTitleValue(activeBoardObj.title); setHeaderTitleEditing(true); }
              }}
              title={activeBoardObj ? "Double-click to rename" : undefined}
            >
              {activeBoardObj?.title || "Kandoo"}
            </h1>
          )}

          <div className="mac-toolbar__spacer" data-tauri-drag-region={isDesktopApp || undefined} />

          {/* Search */}
          <div className="mac-search">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none"
              viewBox="0 0 24 24" stroke="currentColor" style={{ flexShrink: 0 }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search anything"
              value={searchTerm}
              onChange={handleSearch}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); jumpToMatch(e.shiftKey ? -1 : 1); }
              }}
            />
            {!query.isEmpty && (
              <span style={{ fontSize: "0.7rem", color: activeMatches.length ? "var(--theme-text-secondary)" : "var(--theme-text-muted)", whiteSpace: "nowrap" }}>
                {activeMatches.length ? `${currentMatchIdx + 1}/${activeMatches.length}` : "0"}
              </span>
            )}
            {searchTerm && (
              <button type="button" onClick={() => setSearchTerm("")} title="Clear (Esc)"
                style={{ color: "var(--theme-text-muted)", background: "none", border: "none", cursor: "pointer", display: "flex" }}>
                <VscClose />
              </button>
            )}
          </div>

          {/* Secondary actions — relocated to the bottom "More" sheet on phones */}
          <div className="mac-toolbar__actions">
          {/* Filter toggle */}
          <button
            className={`mac-iconbtn${filterMode ? " is-on" : ""}`}
            onClick={() => setFilterMode((m) => !m)}
            title={filterMode ? "Filter mode: hiding non-matches" : "Highlight mode: click to filter"}
            aria-label="Toggle filter mode"
            aria-pressed={filterMode}
          >
            {filterMode ? <VscFilterFilled /> : <VscFilter />}
          </button>

          {/* Cross-board match dropdown */}
          {otherBoardsWithMatches.length > 0 && (
            <div style={{ position: "relative" }}>
              <button
                className="mac-iconbtn"
                style={{ width: "auto", padding: "0 8px", fontSize: "0.75rem", gap: 4 }}
                onClick={() => setShowCrossBoardDropdown((s) => !s)}
                title={`${totalMatches - activeMatches.length} matches in other boards`}
              >
                +{otherBoardsWithMatches.length}
                <VscChevronDown style={{ transform: showCrossBoardDropdown ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
              </button>
              {showCrossBoardDropdown && (
                <div style={{
                  position: "absolute", top: "calc(100% + 6px)", right: 0,
                  minWidth: 220, maxHeight: 280, overflowY: "auto",
                  background: "var(--theme-bg-modal)", border: "1px solid var(--theme-border)",
                  borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-pop)",
                  zIndex: "var(--z-popover)", padding: 4,
                }}>
                  <div style={{ padding: "6px 10px", fontSize: "0.62rem", color: "var(--theme-text-muted)", letterSpacing: "0.06em", fontWeight: 700 }}>
                    ALSO IN OTHER BOARDS
                  </div>
                  {otherBoardsWithMatches.map((r) => (
                    <button key={r.boardId} type="button"
                      onClick={() => { selectBoard(r.boardId); setShowCrossBoardDropdown(false); }}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        width: "100%", padding: "6px 10px", background: "transparent", border: "none",
                        cursor: "pointer", color: "var(--theme-text-primary)", fontSize: "0.85rem",
                        borderRadius: "var(--radius-sm)", textAlign: "left",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--theme-bg-hover)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</span>
                      <span style={{ color: "var(--theme-text-muted)", fontSize: "0.75rem", marginLeft: 8 }}>{r.matchCount}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <button className="mac-iconbtn" onClick={() => openSettings("appearance")} title="Appearance & settings" aria-label="Settings">
            <IoColorFilterOutline />
          </button>
          <button className="mac-iconbtn" onClick={() => setShowExportImport(true)} title="Export / Import" aria-label="Export or import boards">
            <VscArchive />
          </button>
          <button className="mac-iconbtn" onClick={() => setShowHelpModal(true)} title="Help & features (⌘⇧1)" aria-label="Help and features">
            <VscQuestion />
          </button>
          {user ? (
            <button
              className={`mac-iconbtn mac-accountbtn is-signed-in${user.photoUrl ? ' has-avatar' : ''}`}
              onClick={openAccountMenu}
              title={`Signed in as ${user.email || user.phone || user.displayName || "Kandoo user"}`}
              aria-label="Open account menu"
            >
              {user.photoUrl ? <img src={user.photoUrl} alt="" referrerPolicy="no-referrer" /> : <VscAccount />}
              <span className={`mac-accountbtn__status${syncState === "synced" || syncState === "syncing" ? " is-online" : ""}`} />
            </button>
          ) : (
            <button
              className="mac-iconbtn mac-accountbtn is-offline"
              onClick={exitOfflineMode}
              title="Sign in to sync this offline workspace"
              aria-label="Sign in to Kandoo"
            >
              <VscSignIn />
            </button>
          )}
          </div>
        </header>

        {/* Guest upgrade nudge */}
        {isGuest && <GuestUpgradeBanner boards={boards} onSignIn={exitOfflineMode} />}

        {/* Board content */}
        {!isLoaded ? (
          <div className="mac-board-scroll">
            <BoardSkeleton message="Opening your local workspace..." />
          </div>
        ) : boards.length === 0 ? (
          <div className="mac-empty">
            <h2 className="mac-empty__title">Welcome to Kandoo</h2>
            <p className="mac-empty__body">
              You don&apos;t have any boards yet. Create one to start organising your tasks and notes.
            </p>
            <button className="mac-btn-primary" onClick={addBoard}>+ Create your first board</button>
          </div>
        ) : !activeBoard ? (
          <div className="mac-empty">
            <h2 className="mac-empty__title">Nothing selected</h2>
            <p className="mac-empty__body">Pick a project from the sidebar to get started, or create a new one.</p>
          </div>
        ) : (
          <Cards
            key={activeBoard}
            boardId={activeBoard}
            searchTerm={searchTerm}
            query={query}
            filterMode={filterMode}
            currentMatchTaskId={currentMatchTaskId}
            quickAddSignal={quickAddSignal}
            section={section}
            setSection={setSection}
            scheduleView={scheduleView}
            onClearSchedule={() => setScheduleView(null)}
            taskCount={boardTaskCount(activeBoardObj)}
            storageLabel={storageKind === "sqlite" ? "saved on this Mac" : "saved locally"}
            otherBoardsWithMatches={otherBoardsWithMatches}
            totalMatches={totalMatches}
            activeMatchCount={activeMatches.length}
          />
        )}
      </div>

      {showWarningModal && (
        <WarningModal
          boardName={boardToDelete?.title}
          onDeleteConfirm={handleDeleteConfirm}
          onCancel={handleCancel}
        />
      )}
      {showSettings && (
        <SettingsModal
          initialTab={settingsTab}
          storageKind={storageKind}
          onClose={() => setShowSettings(false)}
          onOpenExportImport={() => { setShowSettings(false); setShowExportImport(true); }}
          onResetWorkspace={resetWorkspace}
          onOpenHelp={() => { setShowSettings(false); setShowHelpModal(true); setHelpSection('sync'); }}
        />
      )}
      {showShortcutsHelp && <ShortcutsHelpModal onClose={() => setShowShortcutsHelp(false)} />}
      <ExportImportModal
        isOpen={showExportImport}
        boards={boards}
        activeBoardId={activeBoard}
        onClose={() => setShowExportImport(false)}
        onImport={(newBoards) => setBoards((prev) => [...prev, ...newBoards])}
      />
      <HelpModal
        isOpen={showHelpModal}
        onClose={() => { setShowHelpModal(false); setHelpSection(null); }}
        defaultSection={helpSection}
        onLaunchTour={() => { setShowHelpModal(false); setHelpSection(null); setShowTour(true); }}
        onFeedback={() => setShowFeedback(true)}
      />
      <FeedbackModal isOpen={showFeedback} onClose={() => setShowFeedback(false)} />
      <TaskConflictModal />
      <OnboardingTour setSection={setSection} open={showTour} onClose={() => setShowTour(false)} />
      {ctxMenu && (
        <ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={ctxMenu.items} onClose={() => setCtxMenu(null)} />
      )}
      {chordArmed && <ChordHint />}

      {/* Phone chrome: bottom tab bar + secondary-actions sheet */}
      {isCompact && (
        <MobileTabBar
          section={section}
          onSection={(s) => { setSection(s); setScheduleView(null); }}
          onAdd={quickAddTask}
          onMore={() => setShowMoreSheet(true)}
        />
      )}
      <BottomSheet open={isCompact && showMoreSheet} onClose={() => setShowMoreSheet(false)} title="More">
        <button type="button" className="sheet-row" onClick={() => { setFilterMode((m) => !m); setShowMoreSheet(false); }}>
          {filterMode ? <VscFilterFilled /> : <VscFilter />}
          <span>{filterMode ? "Filtering matches" : "Filter matches"}</span>
        </button>
        <button type="button" className="sheet-row" onClick={() => { setShowExportImport(true); setShowMoreSheet(false); }}>
          <VscArchive /><span>Export / Import</span>
        </button>
        <button type="button" className="sheet-row" onClick={() => { setShowHelpModal(true); setShowMoreSheet(false); }}>
          <VscQuestion /><span>Help &amp; features</span>
        </button>
        <button type="button" className="sheet-row" onClick={() => { openSettings("appearance"); setShowMoreSheet(false); }}>
          <VscSettingsGear /><span>Settings</span>
        </button>
        {user ? (
          <button type="button" className="sheet-row" onClick={(e) => { openAccountMenu(e); setShowMoreSheet(false); }}>
            <VscAccount /><span>Account</span>
          </button>
        ) : (
          <button type="button" className="sheet-row" onClick={() => { exitOfflineMode(); setShowMoreSheet(false); }}>
            <VscSignIn /><span>Sign in to sync</span>
          </button>
        )}
      </BottomSheet>
    </div>
  );
}

// Floating hint shown while the command chord (⌘/Ctrl J) is armed, listing the
// keys that complete it. Mirrors the command map wired in Board.
const CHORD_KEYS = [
  ['F', 'Find'],
  ['N', 'New task'],
  ['T', 'Theme'],
  ['B', 'Sidebar'],
  ['S', 'Section'],
  ['H', 'Help'],
  ['K', 'Keys'],
];

function ChordHint() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
        zIndex: 4000, display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 16px', borderRadius: 12,
        background: 'color-mix(in srgb, var(--theme-bg-modal) 90%, transparent)',
        border: '1px solid var(--theme-border)',
        boxShadow: '0 12px 32px rgba(0,0,0,0.22)',
        backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        fontSize: '0.82rem', color: 'var(--theme-text-secondary)',
        pointerEvents: 'none', userSelect: 'none',
      }}
    >
      <ChordKey>{LEADER_LABEL}</ChordKey>
      <span style={{ color: 'var(--theme-text-muted)' }}>then…</span>
      <span style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {CHORD_KEYS.map(([key, label]) => (
          <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <ChordKey>{key}</ChordKey>
            <span>{label}</span>
          </span>
        ))}
      </span>
    </div>
  );
}

function ChordKey({ children }) {
  return (
    <kbd
      style={{
        display: 'inline-block', minWidth: '1.4rem', textAlign: 'center',
        padding: '2px 6px', borderRadius: 6,
        background: 'var(--theme-bg-hover)', color: 'var(--theme-text-primary)',
        border: '1px solid var(--theme-border)', boxShadow: '0 1px 0 var(--theme-shadow)',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: '0.72rem', fontWeight: 600,
      }}
    >
      {children}
    </kbd>
  );
}

const GUEST_NUDGE_THRESHOLD = 5;
const GUEST_NUDGE_KEY = 'kandoo-guest-nudge-dismissed';

function GuestUpgradeBanner({ boards, onSignIn }) {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(GUEST_NUDGE_KEY) === '1'
  );

  const totalTasks = useMemo(() => {
    let n = 0;
    boards.forEach(b => b.cards?.forEach(c => { if ((c.type || 'todo') === 'todo') n += Object.keys(c.tasks || {}).length; }));
    return n;
  }, [boards]);

  if (dismissed || totalTasks < GUEST_NUDGE_THRESHOLD) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      padding: '9px 16px',
      background: 'color-mix(in srgb, var(--accent) 10%, var(--theme-bg-card))',
      borderBottom: '1px solid color-mix(in srgb, var(--accent) 25%, var(--theme-border))',
      fontSize: '0.78rem', color: 'var(--theme-text-secondary)',
    }}>
      <span>
        <strong style={{ color: 'var(--theme-text-primary)' }}>You have {totalTasks} tasks</strong>
        {' '}— sign in to back them up and access them from any device.
      </span>
      <span style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button
          onClick={onSignIn}
          style={{
            padding: '4px 12px', borderRadius: 6, border: 'none',
            background: 'var(--accent)', color: 'white',
            fontWeight: 600, fontSize: '0.76rem', cursor: 'pointer',
          }}>
          Sign in
        </button>
        <button
          onClick={() => { localStorage.setItem(GUEST_NUDGE_KEY, '1'); setDismissed(true); }}
          style={{
            padding: '4px 8px', borderRadius: 6,
            border: '1px solid var(--theme-border)',
            background: 'transparent', color: 'var(--theme-text-muted)',
            fontSize: '0.76rem', cursor: 'pointer',
          }}>
          Dismiss
        </button>
      </span>
    </div>
  );
}

export default Board;

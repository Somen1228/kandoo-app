import { useState, useContext, useRef, useEffect, useMemo } from "react";
import { parseQuery, searchBoards } from "../utils/search";
import { classifyTask } from "../utils/dueDate";
import {
  VscFilter, VscFilterFilled, VscChevronDown,
  VscArchive, VscQuestion,
  VscAccount, VscInbox, VscNotebook, VscLayoutSidebarLeft, VscClose,
  VscSettingsGear, VscSignIn, VscSignOut,
} from "react-icons/vsc";
import { toast } from "sonner";
import { CgRename } from "react-icons/cg";
import { AiOutlineDelete } from "react-icons/ai";
import { IoColorFilterOutline } from "react-icons/io5";
import { v4 as uuidv4 } from "uuid";
import { useHotkeys } from "react-hotkeys-hook";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import Cards from "../components/Board/Cards";
import { CardsContext } from "../contexts/CardsContext";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import kandooLogo from "../assets/kandoo-head.png";
import kandooLogoSmiling from "../assets/kandoo-smiling.png";
import WarningModal from "../components/Board/WarningModal";
import BoardSkeleton from "../components/Board/BoardSkeleton";
import SettingsModal from "../components/Settings/SettingsModal";
import ShortcutsHelpModal from "../components/ShortcutsHelpModal";
import ContextMenu from "../components/ContextMenu";
import ExportImportModal from "../components/Board/ExportImportModal";
import HelpModal from "../components/HelpModal";

const SIDEBAR_MIN = 210;
const SIDEBAR_MAX = 360;

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
  const { user, backendStatus, logout, exitOfflineMode } = useAuth();
  const { currentThemeId, allThemes, setTheme } = useTheme();
  const isDesktopApp = isTauri();
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
  const [filterMode, setFilterMode]               = useState(false);
  const [currentMatchIdx, setCurrentMatchIdx]     = useState(0);
  const [showCrossBoardDropdown, setShowCrossBoardDropdown] = useState(false);

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
  useEffect(() => {
    localStorage.setItem("kandoo-sidebar-collapsed", isSidebarCollapsed ? "1" : "0");
  }, [isSidebarCollapsed]);
  useEffect(() => {
    localStorage.setItem("kandoo-sidebar-width", String(sidebarWidth));
  }, [sidebarWidth]);

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
    for (const card of board.cards) {
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
    let n = 0;
    for (const card of board.cards || []) {
      if ((card.type || "todo") !== "todo") continue;
      n += Object.keys(card.tasks || {}).length;
    }
    return n;
  };

  // Reset index when query changes or matches set shifts
  useEffect(() => { setCurrentMatchIdx(0); }, [query.raw, activeBoard]);

  // Scroll current match into view + brief flash
  useEffect(() => {
    if (!currentMatchTaskId) return;
    const el = document.querySelector(`[data-task-id="${CSS.escape(currentMatchTaskId)}"]`);
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
  useHotkeys("mod+k, /", (e) => {
    e.preventDefault();
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, { enableOnFormTags: ["input", "textarea"], preventDefault: true });

  useHotkeys("t", () => {
    if (!allThemes.length) return;
    const idx = allThemes.findIndex((t) => t.id === currentThemeId);
    const next = allThemes[(idx + 1) % allThemes.length];
    setTheme(next.id);
  });

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
    setSection("todos");
    setQuickAddSignal((s) => s + 1);
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

  const selectBoard = (id) => {
    setActiveBoard(id);
    setScheduleView(null);
  };

  const openSettings = (tab = "appearance") => { setSettingsTab(tab); setShowSettings(true); };

  const signOut = async () => {
    try { await logout(); }
    catch (error) { toast.error(error.message || "Could not sign out"); }
  };

  const openAccountMenu = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const identity = user?.displayName || user?.email || user?.phone || "Kandoo account";
    setCtxMenu({
      x: rect.right - 210,
      y: rect.bottom + 6,
      items: [
        { label: identity, icon: <VscAccount />, onClick: () => openSettings("account") },
        { label: backendStatus === "online" ? "Account & sync · Online" : "Account & sync · Offline", onClick: () => openSettings("account") },
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

  const cloudLabel = syncState === "synced"
    ? " · Cloud synced"
    : syncState === "syncing" || syncState === "connecting"
      ? " · Syncing"
      : syncState === "offline"
        ? " · Cloud offline"
        : syncState === "conflict"
          ? " · Sync conflict"
          : "";
  const storageLabel = saveState === "saving"
    ? "Saving…"
    : saveState === "error"
      ? "Save failed"
      : `${storageKind === "sqlite" ? "Saved on this Mac" : "Saved locally"}${
          lastSavedAt ? ` · ${lastSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""
        }${cloudLabel}`;

  return (
    <div className={`mac-shell${isDesktopApp ? " is-desktop-window" : ""}`}>
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className={`mac-sidebar${isSidebarCollapsed ? " is-collapsed" : ""}`}
        style={{ "--sidebar-width": `${sidebarWidth}px` }}>
        <div className="mac-sidebar__inner" style={{ width: sidebarWidth, minWidth: sidebarWidth }}>
          <div className="mac-sidebar__brand" data-tauri-drag-region={isDesktopApp || undefined} />

          <div className="mac-sidebar__scroll">
            {/* Projects */}
            <div className="mac-sidebar__section">
              <div className="mac-sidebar__label">
                <span>Projects</span>
                <button className="mac-sidebar__add" onClick={addBoard} title="New project" aria-label="New project">+</button>
              </div>
              {boards.map((board) => (
                editingBoardId === board.id ? (
                  <div key={board.id} style={{ padding: "2px 10px", position: "relative" }}>
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
                    key={board.id}
                    className={`mac-nav-item${board.id === activeBoard ? " is-active" : ""}`}
                    onClick={() => selectBoard(board.id)}
                    onDoubleClick={() => handleTitleClick(board.id, board.title)}
                    onContextMenu={(e) => openBoardContextMenu(e, board)}
                  >
                    <span className="mac-nav-item__label">{board.title}</span>
                    {boardTaskCount(board) > 0 && (
                      <span className="mac-nav-item__count">{boardTaskCount(board)}</span>
                    )}
                  </button>
                )
              ))}
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
            <img
              className="mac-sidebar__logo"
              src={isLogoHovered ? kandooLogoSmiling : kandooLogo}
              alt="Kandoo"
              onMouseEnter={() => setIsLogoHovered(true)}
              onMouseLeave={() => setIsLogoHovered(false)}
            />
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{storageLabel}</span>
            <button className="mac-sidebar__settings" onClick={() => openSettings("appearance")} title="Settings" aria-label="Open settings">
              <VscSettingsGear />
            </button>
          </div>
        </div>

        <div className="mac-sidebar__resizer" onMouseDown={startResize} title="Drag to resize" />
      </aside>

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
              className="mac-iconbtn mac-accountbtn is-signed-in"
              onClick={openAccountMenu}
              title={`Signed in as ${user.email || user.phone || user.displayName || "Kandoo user"}`}
              aria-label="Open account menu"
            >
              {user.photoUrl ? <img src={user.photoUrl} alt="" referrerPolicy="no-referrer" /> : <VscAccount />}
              <span className={`mac-accountbtn__status${backendStatus === "online" ? " is-online" : ""}`} />
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
        </header>

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
      <HelpModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />
      {ctxMenu && (
        <ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={ctxMenu.items} onClose={() => setCtxMenu(null)} />
      )}
    </div>
  );
}

export default Board;

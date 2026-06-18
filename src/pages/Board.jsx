import { useState, useContext, useRef, useEffect, useMemo } from "react";
import { parseQuery, searchBoards } from "../utils/search";
import { VscFilter, VscFilterFilled, VscChevronDown } from "react-icons/vsc";
import { v4 as uuidv4 } from "uuid";
import { useHotkeys } from "react-hotkeys-hook";
import { isTauri } from "@tauri-apps/api/core";
import {
  // VscGithubInverted,  // re-enable when un-commenting the GitHub link in the header
  VscArchive,
  VscQuestion,
  VscSave,
} from "react-icons/vsc";
import { CgRename } from "react-icons/cg";
import { AiOutlineDelete } from "react-icons/ai";
import { IoColorFilterOutline } from "react-icons/io5";
import Cards from "../components/Board/Cards";
import { CardsContext } from "../contexts/CardsContext";
import { useTheme } from "../contexts/ThemeContext";
import optionLineLogo from "../assets/option-line.svg";
import kandooLogo from "../assets/kandoo-head.png";
import kandooLogoSmiling from "../assets/kandoo-smiling.png";
import WarningModal from "../components/Board/WarningModal";
import DropdownMenu from "../components/Board/DropdownMenu";
import BoardSkeleton from "../components/Board/BoardSkeleton";
import ThemeSettings from "../components/ThemeSettings";
import ShortcutsHelpModal from "../components/ShortcutsHelpModal";
import ContextMenu from "../components/ContextMenu";
import ExportImportModal from "../components/Board/ExportImportModal";
import HelpModal from "../components/HelpModal";

function Board() {
  const {
    boards, setBoards, defaultCards, isLoaded, undo, redo,
    saveState, lastSavedAt, storageKind,
  } = useContext(CardsContext);
  const { currentThemeId, allThemes, setTheme } = useTheme();
  const isDesktopApp = isTauri();
  const [activeBoard, setActiveBoard] = useState(boards[0]?.id || null);
  const [editingBoardId, setEditingBoardId] = useState(null);
  const [newBoardTitle, setNewBoardTitle] = useState("");
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [boardToDelete, setBoardToDelete] = useState(null);
  const [dropdownBoardId, setDropdownBoardId] = useState(null);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarPinned, setIsSidebarPinned] = useState(false);
  const [isLogoHovered, setIsLogoHovered] = useState(false);
  const [headerTitleEditing, setHeaderTitleEditing] = useState(false);
  const [headerTitleValue, setHeaderTitleValue]     = useState("");
  const [showThemeSettings, setShowThemeSettings] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [showExportImport, setShowExportImport]   = useState(false);
  const [showHelpModal, setShowHelpModal]         = useState(false);
  const [filterMode, setFilterMode]               = useState(false);
  const [currentMatchIdx, setCurrentMatchIdx]     = useState(0);
  const [showCrossBoardDropdown, setShowCrossBoardDropdown] = useState(false);

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

  // Reset index when query changes or matches set shifts
  useEffect(() => { setCurrentMatchIdx(0); }, [query.raw, activeBoard]);

  // Scroll current match into view + brief flash
  useEffect(() => {
    if (!currentMatchTaskId) return;
    const el = document.querySelector(`[data-task-id="${CSS.escape(currentMatchTaskId)}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentMatchTaskId]);

  const jumpToMatch = (delta) => {
    if (activeMatches.length === 0) return;
    setCurrentMatchIdx((i) => (i + delta + activeMatches.length) % activeMatches.length);
  };
  const [quickAddSignal, setQuickAddSignal] = useState(0);
  const [ctxMenu, setCtxMenu] = useState(null);
  const ctxMenuRef = useRef(ctxMenu);
  useEffect(() => { ctxMenuRef.current = ctxMenu; }, [ctxMenu]);
  const dropdownRefs = useRef({});
  const triggerRefs = useRef({});
  const sidebarRef = useRef(null);
  const searchInputRef = useRef(null);

  // Auto-select the first board once boards load, or when the active one disappears
  // (initial mount captures activeBoard from an empty boards[], so we sync here).
  useEffect(() => {
    if (boards.length > 0 && !boards.some((b) => b.id === activeBoard)) {
      setActiveBoard(boards[0].id);
    } else if (boards.length === 0 && activeBoard !== null) {
      setActiveBoard(null);
    }
  }, [boards, activeBoard]);

  // ===== Keyboard shortcuts =====
  // Cmd/Ctrl+K and / focus the search bar
  useHotkeys('mod+k, /', (e) => {
    e.preventDefault();
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, { enableOnFormTags: ['input', 'textarea'], preventDefault: true });

  // T cycles to the next theme (only when no input is focused)
  useHotkeys('t', () => {
    if (!allThemes.length) return;
    const idx = allThemes.findIndex((t) => t.id === currentThemeId);
    const next = allThemes[(idx + 1) % allThemes.length];
    setTheme(next.id);
  });

  // ? opens shortcuts help (kept as a bonus, but works inconsistently across
  // keyboard layouts — the documented shortcut is mod+shift+1 below).
  useHotkeys('?', () => setShowShortcutsHelp(true));
  useHotkeys('shift+/', () => setShowShortcutsHelp(true));

  // Cmd/Ctrl+Shift+1 opens the full Help / Features guide modal
  useHotkeys('mod+shift+1', (e) => {
    e.preventDefault();
    setShowHelpModal(true);
  });

  // Cmd/Ctrl+Z = undo, Cmd/Ctrl+Shift+Z (or Cmd/Ctrl+Y) = redo
  // Hotkeys don't fire in inputs/textareas by default, so native browser undo still works while typing.
  useHotkeys('mod+z',       (e) => { e.preventDefault(); undo(); });
  useHotkeys('mod+shift+z', (e) => { e.preventDefault(); redo(); });
  useHotkeys('mod+y',       (e) => { e.preventDefault(); redo(); });

  // N adds a quick task to the active board's first card
  useHotkeys('n', (e) => {
    e.preventDefault();
    setQuickAddSignal((s) => s + 1);
  });

  // Esc closes any open Board-level overlay
  useHotkeys('esc', () => {
    if (ctxMenu) { setCtxMenu(null); return; }
    if (showShortcutsHelp) { setShowShortcutsHelp(false); return; }
    if (showExportImport) { setShowExportImport(false); return; }
    if (showHelpModal) { setShowHelpModal(false); return; }
    if (showThemeSettings) { setShowThemeSettings(false); return; }
    if (showWarningModal) { setShowWarningModal(false); setBoardToDelete(null); return; }
    if (editingBoardId) { setEditingBoardId(null); return; }
    if (dropdownBoardId) { setDropdownBoardId(null); return; }
  }, { enableOnFormTags: ['input'] });

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
    if (
      boards.some(
        (board) => board.title === newBoardTitle && board.id !== boardId
      )
    ) {
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
    if (e.key === "Enter") {
      handleTitleBlur(boardId);
    }
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

  const handleDropdownClick = (boardId) => {
    if (dropdownBoardId === boardId) {
      setDropdownBoardId(null);
    } else {
      setDropdownBoardId(boardId);
    }
  };

  const handleClickOutside = (e) => {
    if (sidebarRef.current && !sidebarRef.current.contains(e.target) && !ctxMenuRef.current) {
      setIsSidebarOpen(false);
    }

    Object.keys(dropdownRefs.current).forEach((boardId) => {
      if (
        dropdownRefs.current[boardId] &&
        !dropdownRefs.current[boardId].contains(e.target) &&
        triggerRefs.current[boardId] &&
        !triggerRefs.current[boardId].contains(e.target)
      ) {
        setDropdownBoardId(null);
      }
    });
  };

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  return (
    <div className={`kandoo-window flex flex-col h-screen${isDesktopApp ? ' is-desktop-window' : ''}`} style={{ background: 'var(--theme-bg-primary)', color: 'var(--theme-text-primary)' }}>
      <div className="flex-grow flex overflow-hidden">
        <div
          ref={sidebarRef}
          className={`sidebar shadow-xl overflow-y-auto z-10 transition-all duration-300 ease-in-out h-[80%] ${
            isSidebarOpen
              ? "w-64 rounded-md overflow-x-hidden"
              : `w-9 drop-shadow-xl rounded-md overflow-x-hidden`
          } absolute top-16 left-0`}
          style={{ background: 'var(--theme-bg-sidebar)', borderRight: '1px solid var(--theme-border)' }}
          onMouseEnter={() => setIsSidebarOpen(true)}
          onMouseLeave={() => {
            if (ctxMenuRef.current) return;
            setDropdownBoardId(null);
            if (!isSidebarPinned) setIsSidebarOpen(false);
          }}
        >
          {isSidebarOpen && (
            <div className="p-4">
              <h1 className="pl-1 mb-4 text-xl font-bold" style={{ color: 'var(--theme-text-primary)' }}>Projects</h1>
              <div className="board-tabs flex flex-col items-start gap-1">
                {boards.map((board) => (
                  <div
                    key={board.id}
                    className={`board-tab p-2 w-full cursor-pointer flex transition-colors duration-300 rounded-md`}
                    style={
                      board.id === activeBoard
                        ? { background: 'var(--theme-bg-hover)', color: 'var(--theme-text-primary)', fontWeight: 500 }
                        : { color: 'var(--theme-text-secondary)' }
                    }
                    onClick={() => setActiveBoard(board.id)}
                    onContextMenu={(e) => openBoardContextMenu(e, board)}
                  >
                    {editingBoardId === board.id ? (
                      <div className="relative w-full">
                        <input
                          type="text"
                          value={newBoardTitle}
                          onChange={handleTitleChange}
                          onBlur={() => handleTitleBlur(board.id)}
                          onKeyDown={(e) => handleTitleKeyDown(e, board.id)}
                          className={`w-full overflow-x-auto bg-transparent border-b-2 focus:outline-none`}
                          style={{
                            borderColor: isDuplicate ? 'var(--theme-danger)' : 'var(--theme-accent)',
                            color: 'var(--theme-text-primary)',
                          }}
                          autoFocus
                        />
                        {isDuplicate && (
                          <div className="absolute left-0 z-10 p-3 mt-1 text-xs rounded" style={{
                            background: 'var(--theme-danger-bg)',
                            color: 'var(--theme-danger)',
                            border: '2px solid var(--theme-danger)',
                          }}>
                            A board with this title already exists. Please enter
                            a different title.
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-full flex justify-between items-center relative cursor-pointer">
                        <span
                          onDoubleClick={() =>
                            handleTitleClick(board.id, board.title)
                          }
                          className="pr-4"
                        >
                          {board.title}
                        </span>
                        <img
                          src={optionLineLogo}
                          alt="Options"
                          className={`w-auto h-4 cursor-pointer opacity-0 hover:opacity-50 ${
                            board.id === activeBoard && "opacity-50"
                          }`}
                          style={{ filter: currentThemeId !== 'light' ? 'invert(1)' : 'none' }}
                          ref={(el) => (triggerRefs.current[board.id] = el)}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDropdownClick(board.id);
                          }}
                        />
                      </div>
                    )}
                    {dropdownBoardId === board.id && (
                      <div ref={(el) => (dropdownRefs.current[board.id] = el)}>
                        <DropdownMenu
                          onEdit={() => handleTitleClick(board.id, board.title)}
                          onDelete={() => handleDeleteClick(board)}
                        />
                      </div>
                    )}
                  </div>
                ))}
                <button
                  className="add-board-btn opacity-80 mt-4"
                  style={{ color: 'var(--theme-text-muted)' }}
                  onClick={addBoard}
                >
                  + New Project
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="flex-grow overflow-auto">
          <div className="p-4">
            <div
              className="app-toolbar flex justify-between items-center mb-4"
              data-tauri-drag-region={isDesktopApp ? true : undefined}
            >
              <div className="kandoo-toolbar-identity flex items-center gap-3">
                <button
                  className="kandoo-toolbar-logo-button mr-2 focus:outline-none transition-transform duration-200 hover:scale-110"
                  onMouseEnter={() => setIsLogoHovered(true)}
                  onMouseLeave={() => setIsLogoHovered(false)}
                  onClick={() => {
                    setIsSidebarPinned((prev) => {
                      const next = !prev;
                      setIsSidebarOpen(next);
                      return next;
                    });
                  }}
                  title={isSidebarPinned ? 'Click to unpin sidebar' : 'Click to pin sidebar open'}
                  aria-label="Toggle sidebar"
                  aria-pressed={isSidebarPinned}
                >
                  <img
                    src={isLogoHovered ? kandooLogoSmiling : kandooLogo}
                    alt="Kandoo"
                    className="kandoo-toolbar-logo w-12 h-12 object-contain"
                  />
                </button>
                {headerTitleEditing ? (
                  <input
                    type="text"
                    value={headerTitleValue}
                    onChange={e => setHeaderTitleValue(e.target.value)}
                    onBlur={() => {
                      const trimmed = headerTitleValue.trim();
                      if (trimmed && !boards.some(b => b.title === trimmed && b.id !== activeBoard)) {
                        setBoards(prev => prev.map(b => b.id === activeBoard ? { ...b, title: trimmed } : b));
                      }
                      setHeaderTitleEditing(false);
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') e.target.blur();
                      if (e.key === 'Escape') { setHeaderTitleEditing(false); }
                    }}
                    className="app-toolbar-title text-2xl sm:text-3xl font-bold bg-transparent border-b-2 focus:outline-none"
                    style={{ borderColor: 'var(--theme-accent)', color: 'var(--theme-text-primary)', maxWidth: '280px' }}
                    autoFocus
                  />
                ) : (
                  <h1
                    className="app-toolbar-title text-2xl sm:text-3xl font-bold truncate select-none"
                    style={{ color: 'var(--theme-text-primary)', cursor: 'text' }}
                    onDoubleClick={() => {
                      const b = boards.find(b => b.id === activeBoard);
                      if (b) { setHeaderTitleValue(b.title); setHeaderTitleEditing(true); }
                    }}
                    title="Double-click to rename"
                  >
                    {boards.find((board) => board.id === activeBoard)?.title}
                  </h1>
                )}
              </div>
              <div className="kandoo-toolbar-actions flex justify-center items-center">
                {/* Search wrapper — pill + filter toggle + cross-board dropdown */}
                <div className="kandoo-search-wrapper relative mr-5" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div className="kandoo-search-field flex items-center rounded-3xl px-2 py-1" style={{
                    border: '1px solid var(--theme-border)',
                    background: 'var(--theme-bg-input)',
                  }}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 pt-0.5"
                      style={{ color: 'var(--theme-text-secondary)' }}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      ref={searchInputRef}
                      className="ml-2 flex-1 text-sm outline-none bg-transparent"
                      style={{ color: 'var(--theme-text-primary)', minWidth: 0 }}
                      type="text"
                      name="search"
                      id="search"
                      placeholder="Search anything"
                      value={searchTerm}
                      onChange={handleSearch}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          jumpToMatch(e.shiftKey ? -1 : 1);
                        }
                      }}
                    />
                    {!query.isEmpty && (
                      <span
                        title={activeMatches.length ? 'Press Enter to jump · Shift+Enter for previous' : 'No matches in this board'}
                        style={{
                          fontSize: '0.7rem',
                          padding: '2px 8px',
                          borderRadius: '999px',
                          background: activeMatches.length ? 'var(--theme-bg-hover)' : 'transparent',
                          color: activeMatches.length ? 'var(--theme-text-primary)' : 'var(--theme-text-muted)',
                          whiteSpace: 'nowrap',
                          marginLeft: 6,
                        }}
                      >
                        {activeMatches.length
                          ? `${currentMatchIdx + 1} / ${activeMatches.length}`
                          : '0 results'}
                      </span>
                    )}
                    {!query.isEmpty && searchTerm && (
                      <button
                        type="button"
                        onClick={() => setSearchTerm('')}
                        title="Clear search (Esc)"
                        style={{ marginLeft: 4, color: 'var(--theme-text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}
                      >
                        ×
                      </button>
                    )}
                  </div>

                  {/* Filter toggle */}
                  <button
                    type="button"
                    onClick={() => setFilterMode((m) => !m)}
                    title={filterMode ? 'Hide non-matching (on) — click to switch to highlight mode' : 'Highlight matches (on) — click to switch to filter mode'}
                    style={{
                      padding: '6px',
                      borderRadius: '999px',
                      border: '1px solid var(--theme-border)',
                      background: filterMode ? 'var(--theme-accent)' : 'var(--theme-bg-input)',
                      color: filterMode ? 'white' : 'var(--theme-text-secondary)',
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center',
                      transition: 'background 0.15s, color 0.15s',
                    }}
                  >
                    {filterMode ? <VscFilterFilled /> : <VscFilter />}
                  </button>

                  {/* Cross-board dropdown trigger */}
                  {otherBoardsWithMatches.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowCrossBoardDropdown((s) => !s)}
                      title={`${totalMatches - activeMatches.length} matches in other boards`}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '999px',
                        border: '1px solid var(--theme-border)',
                        background: 'var(--theme-bg-input)',
                        color: 'var(--theme-text-secondary)',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 4,
                        fontSize: '0.75rem',
                      }}
                    >
                      +{otherBoardsWithMatches.length}
                      <VscChevronDown style={{ transform: showCrossBoardDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                    </button>
                  )}

                  {showCrossBoardDropdown && otherBoardsWithMatches.length > 0 && (
                    <div
                      style={{
                        position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                        minWidth: 220, maxHeight: 280, overflowY: 'auto',
                        background: 'var(--theme-bg-modal)',
                        border: '1px solid var(--theme-border)',
                        borderRadius: '0.5rem',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                        zIndex: 50,
                        padding: '4px',
                      }}
                    >
                      <div style={{ padding: '6px 10px', fontSize: '0.65rem', color: 'var(--theme-text-muted)', letterSpacing: '0.06em', fontWeight: 600 }}>
                        ALSO IN OTHER BOARDS
                      </div>
                      {otherBoardsWithMatches.map((r) => (
                        <button
                          key={r.boardId}
                          type="button"
                          onClick={() => {
                            setActiveBoard(r.boardId);
                            setShowCrossBoardDropdown(false);
                          }}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            width: '100%', padding: '6px 10px',
                            background: 'transparent', border: 'none', cursor: 'pointer',
                            color: 'var(--theme-text-primary)', fontSize: '0.85rem',
                            borderRadius: '0.25rem', textAlign: 'left',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--theme-bg-hover)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</span>
                          <span style={{ color: 'var(--theme-text-muted)', fontSize: '0.75rem', marginLeft: 8 }}>{r.matchCount}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {/* Theme Toggle Button */}
                <button
                  className="header-icon-btn"
                  style={{ color: 'var(--theme-text-secondary)' }}
                  onClick={() => setShowThemeSettings(true)}
                  title="Theme Settings"
                >
                  <IoColorFilterOutline className="text-xl" />
                  <span className="header-icon-label">Theme</span>
                </button>
                {/* Export / Import Button */}
                <button
                  className="header-icon-btn"
                  style={{ color: 'var(--theme-text-secondary)' }}
                  onClick={() => setShowExportImport(true)}
                  title="Export / Import Boards"
                >
                  <VscArchive className="text-xl" />
                  <span className="header-icon-label">Export</span>
                </button>
                {/* Help Button */}
                <button
                  className="header-icon-btn"
                  style={{ color: 'var(--theme-text-secondary)' }}
                  onClick={() => setShowHelpModal(true)}
                  title="Help &amp; Features Guide"
                >
                  <VscQuestion className="text-xl" />
                  <span className="header-icon-label">Help</span>
                </button>
                <div
                  className="kandoo-local-status flex items-center gap-1.5 ml-2 text-xs font-medium"
                  style={{ color: saveState === 'error' ? 'var(--theme-danger)' : 'var(--theme-text-muted)' }}
                  title={saveState === 'error'
                    ? 'Kandoo could not save the latest changes'
                    : `${storageKind === 'sqlite' ? 'Stored in SQLite on this Mac' : 'Stored in this browser'}${lastSavedAt ? ` · Saved ${lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}`}
                >
                  <VscSave className="text-base" />
                  <span className="kandoo-local-status-label">
                    {saveState === 'saving'
                      ? 'Saving'
                      : saveState === 'error'
                        ? 'Save failed'
                        : storageKind === 'sqlite' ? 'On this Mac' : 'Local'}
                  </span>
                </div>
                {/* GitHub link — hidden for now
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  href="https://github.com/Somen1228/Kanban-board"
                  className="header-icon-btn"
                  style={{ color: 'var(--theme-text-secondary)' }}
                  title="Github Repository"
                >
                  <VscGithubInverted className="text-xl" />
                  <span className="header-icon-label">GitHub</span>
                </a>
                */}
              </div>
            </div>
            <div className="mt-6">
              {!isLoaded ? (
                <BoardSkeleton message="Opening your local workspace..." />
              ) : boards.length === 0 ? (
                <div className="text-center px-6 py-16" style={{ color: 'var(--theme-text-secondary)' }}>
                  <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--theme-text-primary)' }}>
                    Welcome to Kandoo
                  </h2>
                  <p className="text-sm mb-6" style={{ color: 'var(--theme-text-muted)' }}>
                    You don&apos;t have any boards yet. Create one to start organising your tasks.
                  </p>
                  <button
                    onClick={addBoard}
                    className="px-5 py-2 rounded-md font-medium transition-transform hover:scale-105"
                    style={{ background: 'var(--theme-accent)', color: 'white' }}
                  >
                    + Create your first board
                  </button>
                </div>
              ) : !activeBoard ? (
                <div className="text-center px-6 py-16" style={{ color: 'var(--theme-text-secondary)' }}>
                  <p className="text-sm mb-3" style={{ color: 'var(--theme-text-muted)' }}>
                    Pick a board from the sidebar to get started, or create a new one.
                  </p>
                  <div className="flex items-center justify-center gap-2 text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                    <span>👈 Hover the left edge to open the sidebar</span>
                  </div>
                </div>
              ) : (
                boards.map(
                  (board) =>
                    board.id === activeBoard && (
                      <div key={board.id}>
                        <Cards
                          boardId={board.id}
                          searchTerm={searchTerm}
                          query={query}
                          filterMode={filterMode}
                          currentMatchTaskId={currentMatchTaskId}
                          quickAddSignal={quickAddSignal}
                        />
                        {filterMode && !query.isEmpty && activeMatches.length === 0 && (
                          <div className="text-center text-sm mt-8" style={{ color: 'var(--theme-text-muted)' }}>
                            No tasks match <span style={{ color: 'var(--theme-text-primary)' }}>{`"${query.raw}"`}</span> in this board.
                            {otherBoardsWithMatches.length > 0 && (
                              <div className="text-xs mt-2">
                                Found {totalMatches} match{totalMatches > 1 ? 'es' : ''} in {otherBoardsWithMatches.length} other board{otherBoardsWithMatches.length > 1 ? 's' : ''}.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                )
              )}
            </div>
          </div>
        </div>
      </div>
      {showWarningModal && (
        <WarningModal
          boardName={boardToDelete?.title}
          onDeleteConfirm={handleDeleteConfirm}
          onCancel={handleCancel}
        />
      )}
      {showThemeSettings && (
        <ThemeSettings onClose={() => setShowThemeSettings(false)} />
      )}
      {showShortcutsHelp && (
        <ShortcutsHelpModal onClose={() => setShowShortcutsHelp(false)} />
      )}
      <ExportImportModal
        isOpen={showExportImport}
        boards={boards}
        activeBoardId={activeBoard}
        onClose={() => setShowExportImport(false)}
        onImport={(newBoards) => setBoards((prev) => [...prev, ...newBoards])}
      />
      <HelpModal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
      />
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={ctxMenu.items}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  );
}

export default Board;

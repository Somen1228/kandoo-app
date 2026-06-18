import { createContext, useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import {
  loadBoards as loadStoredBoards,
  saveBoards,
  stageBoards,
  storageKind,
} from '../services/boardStorage';

export const CardsContext = createContext();

const defaultCards = [
  { uid: 'col-todo', title: "To-do", color: "bg-gray-200", isVisible: true, tasks: {} },
  { uid: 'col-inprogress', title: "In-Progress", color: "bg-blue-100", isVisible: true, tasks: {} },
  { uid: 'col-done', title: "Done", color: "bg-green-100", isVisible: true, tasks: {} },
];

const ensureCardUids = (boards) =>
  boards.map(b => ({
    ...b,
    cards: b.cards.map(c => c.uid ? c : { ...c, uid: uuidv4() }),
  }));

const SAVE_DEBOUNCE_MS = 500;
const HISTORY_LIMIT = 50;
const HISTORY_DEBOUNCE_MS = 400;

export const CardsProvider = ({ children }) => {
  const [boards, setBoardsRaw] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [saveState, setSaveState] = useState('loading');
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [history, setHistory] = useState({ past: [], future: [] });
  const saveTimeoutRef = useRef(null);

  // ── History internals ────────────────────────────────────────────────────
  const skipHistoryRef     = useRef(false); // bypass capture for system updates
  const pendingSnapshotRef = useRef(null);  // first prev in a rapid-change burst
  const snapshotTimerRef   = useRef(null);
  const boardsRef          = useRef(boards);
  const historyRef         = useRef(history);
  useEffect(() => { boardsRef.current  = boards;  }, [boards]);
  useEffect(() => { historyRef.current = history; }, [history]);

  const flushPendingSnapshot = useCallback(() => {
    if (snapshotTimerRef.current) {
      clearTimeout(snapshotTimerRef.current);
      snapshotTimerRef.current = null;
    }
    const snap = pendingSnapshotRef.current;
    pendingSnapshotRef.current = null;
    if (snap !== null) {
      setHistory(h => ({
        past: [...h.past, snap].slice(-HISTORY_LIMIT),
        future: [],
      }));
    }
  }, []);

  // Wrapped setter — debounced history capture, records the FIRST prev in a burst
  const setBoards = useCallback((updater) => {
    setBoardsRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (!skipHistoryRef.current) {
        if (pendingSnapshotRef.current === null) pendingSnapshotRef.current = prev;
        if (snapshotTimerRef.current) clearTimeout(snapshotTimerRef.current);
        snapshotTimerRef.current = setTimeout(() => {
          const snap = pendingSnapshotRef.current;
          pendingSnapshotRef.current = null;
          snapshotTimerRef.current = null;
          if (snap !== null) {
            setHistory(h => ({
              past: [...h.past, snap].slice(-HISTORY_LIMIT),
              future: [],
            }));
          }
        }, HISTORY_DEBOUNCE_MS);
      }
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    flushPendingSnapshot();
    const h = historyRef.current;
    if (h.past.length === 0) return;
    const prev = h.past[h.past.length - 1];
    skipHistoryRef.current = true;
    setBoardsRaw(prev);
    setHistory({
      past: h.past.slice(0, -1),
      future: [boardsRef.current, ...h.future].slice(0, HISTORY_LIMIT),
    });
    queueMicrotask(() => { skipHistoryRef.current = false; });
  }, [flushPendingSnapshot]);

  const redo = useCallback(() => {
    flushPendingSnapshot();
    const h = historyRef.current;
    if (h.future.length === 0) return;
    const next = h.future[0];
    skipHistoryRef.current = true;
    setBoardsRaw(next);
    setHistory({
      past: [...h.past, boardsRef.current].slice(-HISTORY_LIMIT),
      future: h.future.slice(1),
    });
    queueMicrotask(() => { skipHistoryRef.current = false; });
  }, [flushPendingSnapshot]);

  useEffect(() => {
    let cancelled = false;

    const hydrateBoards = async () => {
      try {
        const localBoards = await loadStoredBoards();
        if (cancelled) return;

        setBoardsRaw(localBoards.length > 0
          ? ensureCardUids(localBoards)
          : [{ id: uuidv4(), title: 'Untitled', cards: defaultCards }]);
        setSaveState('saved');
      } catch (err) {
        console.error('Failed to load local workspace:', err);
        if (cancelled) return;

        setBoardsRaw([{ id: uuidv4(), title: 'Untitled', cards: defaultCards }]);
        setSaveState('error');
        toast.error('Could not open local storage. Export a backup before closing the app.');
      } finally {
        if (!cancelled) setIsLoaded(true);
      }
    };

    hydrateBoards();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!isLoaded) return;

    stageBoards(boards);
    setSaveState('saving');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await saveBoards(boards);
        setLastSavedAt(new Date());
        setSaveState('saved');
      } catch (err) {
        console.error('Failed to save local workspace:', err);
        setSaveState('error');
        toast.error('Changes could not be saved locally');
      }
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [boards, isLoaded]);

  return (
    <CardsContext.Provider value={{
      boards, setBoards, defaultCards, isLoaded,
      saveState, lastSavedAt, storageKind,
      undo, redo,
      canUndo: history.past.length > 0,
      canRedo: history.future.length > 0,
    }}>
      {children}
    </CardsContext.Provider>
  );
};

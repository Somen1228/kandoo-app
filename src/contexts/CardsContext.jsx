import { createContext, useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { emit, listen } from '@tauri-apps/api/event';
import { useAuth } from './AuthContext';
import { ApiError, workspaceApi } from '../services/api';
import {
  loadBoards as loadStoredBoards,
  saveBoards,
  stageBoards,
  storageKind,
} from '../services/boardStorage';

export const CardsContext = createContext();

// Cross-window sync — the main window and the menu-bar panel both run this
// provider against the same SQLite. After one saves, it broadcasts so the
// other reloads the fresh workspace.
const WORKSPACE_EVENT = 'kandoo://workspace-updated';
const WINDOW_LABEL = (() => {
  try { return isTauri() ? getCurrentWindow().label : 'web'; } catch { return 'web'; }
})();

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
  const { user, loading: authLoading } = useAuth();
  const userUid = user?.uid || null;
  const storageScope = userUid || 'guest';
  const [boards, setBoardsRaw] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [saveState, setSaveState] = useState('loading');
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [syncState, setSyncState] = useState('local');
  const [cloudConflict, setCloudConflict] = useState(null);
  const [history, setHistory] = useState({ past: [], future: [] });
  const saveTimeoutRef = useRef(null);
  const cloudRevisionRef = useRef(0);
  const cloudSyncingRef = useRef(false);
  const pendingCloudBoardsRef = useRef(null);
  const cloudConflictRef = useRef(null);
  // When true, the next save effect run is a sync-reload from another window —
  // skip persisting/broadcasting it to avoid a save↔reload feedback loop.
  const skipNextSaveRef = useRef(false);

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
    if (authLoading) return undefined;
    let cancelled = false;

    const hydrateBoards = async () => {
      setIsLoaded(false);
      setSaveState('loading');
      setSyncState(userUid ? 'connecting' : 'local');
      setCloudConflict(null);
      cloudConflictRef.current = null;
      cloudRevisionRef.current = 0;
      try {
        let localBoards = await loadStoredBoards(storageScope);
        const hasAccountLocal = userUid && localBoards.length > 0;
        if (cancelled) return;

        if (userUid && localBoards.length === 0) {
          // A newly signed-in account may adopt the existing offline workspace
          // when its cloud workspace is still empty.
          localBoards = await loadStoredBoards('guest');
        }

        let hydrated = localBoards;
        if (userUid) {
          try {
            const response = await workspaceApi.get();
            const remote = response.workspace;
            cloudRevisionRef.current = remote.revision;
            let hydrationConflict = false;

            if (remote.boards?.length > 0) {
              const localDiffers = hasAccountLocal
                && JSON.stringify(localBoards) !== JSON.stringify(remote.boards);
              if (localDiffers) {
                hydrated = localBoards;
                hydrationConflict = true;
                cloudConflictRef.current = remote;
                setCloudConflict(remote);
                setSyncState('conflict');
              } else {
                hydrated = remote.boards;
              }
            } else {
              hydrated = localBoards.length > 0
                ? localBoards
                : [{ id: uuidv4(), title: 'Untitled', cards: defaultCards }];
              try {
                const saved = await workspaceApi.save(hydrated, remote.revision);
                cloudRevisionRef.current = saved.workspace.revision;
              } catch (saveError) {
                if (saveError instanceof ApiError && saveError.status === 409 && saveError.data?.workspace) {
                  hydrated = saveError.data.workspace.boards;
                  cloudRevisionRef.current = saveError.data.workspace.revision;
                } else {
                  throw saveError;
                }
              }
            }
            if (!hydrationConflict) setSyncState('synced');
          } catch (cloudError) {
            console.warn('Cloud workspace unavailable; using local copy:', cloudError);
            setSyncState('offline');
            if (localBoards.length === 0) toast.warning('Cloud is unavailable. Started with a local workspace.');
          }
        }

        if (hydrated.length === 0) {
          hydrated = [{ id: uuidv4(), title: 'Untitled', cards: defaultCards }];
        }
        hydrated = ensureCardUids(hydrated);
        await saveBoards(hydrated, storageScope);
        if (cancelled) return;
        skipNextSaveRef.current = true;
        setBoardsRaw(hydrated);
        setHistory({ past: [], future: [] });
        setLastSavedAt(new Date());
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
  }, [authLoading, storageScope, userUid]);

  const syncCloud = useCallback(async (snapshot) => {
    if (!userUid || cloudConflictRef.current) return;
    pendingCloudBoardsRef.current = snapshot;
    if (cloudSyncingRef.current) return;

    cloudSyncingRef.current = true;
    while (pendingCloudBoardsRef.current && !cloudConflictRef.current) {
      const nextBoards = pendingCloudBoardsRef.current;
      pendingCloudBoardsRef.current = null;
      setSyncState('syncing');
      try {
        const response = await workspaceApi.save(nextBoards, cloudRevisionRef.current);
        cloudRevisionRef.current = response.workspace.revision;
        setSyncState('synced');
      } catch (error) {
        if (error instanceof ApiError && error.status === 409 && error.data?.workspace) {
          cloudConflictRef.current = error.data.workspace;
          setCloudConflict(error.data.workspace);
          setSyncState('conflict');
          pendingCloudBoardsRef.current = null;
          toast.error('Cloud sync paused: this workspace changed on another device.');
        } else {
          console.warn('Cloud sync unavailable:', error);
          setSyncState('offline');
          pendingCloudBoardsRef.current = null;
        }
      }
    }
    cloudSyncingRef.current = false;
  }, [userUid]);

  useEffect(() => {
    if (!isLoaded) return;
    // Boards were just reloaded from another window's change — don't re-persist
    // or re-broadcast (that would loop the two windows forever).
    if (skipNextSaveRef.current) { skipNextSaveRef.current = false; return; }

    stageBoards(boards, storageScope);
    setSaveState('saving');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await saveBoards(boards, storageScope);
        setLastSavedAt(new Date());
        setSaveState('saved');
        if (isTauri()) emit(WORKSPACE_EVENT, { source: WINDOW_LABEL, scope: storageScope }).catch(() => {});
        if (userUid) syncCloud(boards);
      } catch (err) {
        console.error('Failed to save local workspace:', err);
        setSaveState('error');
        toast.error('Changes could not be saved locally');
      }
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [boards, isLoaded, storageScope, syncCloud, userUid]);

  // Reload the workspace when another Kandoo window (main ↔ panel) saves.
  useEffect(() => {
    if (!isTauri()) return;
    let unlisten;
    let cancelled = false;
    listen(WORKSPACE_EVENT, async (event) => {
      if (event.payload?.source === WINDOW_LABEL) return;
      if (event.payload?.scope && event.payload.scope !== storageScope) return;
      try {
        const fresh = await loadStoredBoards(storageScope);
        if (cancelled) return;
        skipNextSaveRef.current = true;
        setBoardsRaw(ensureCardUids(fresh));
      } catch (err) {
        console.error('Failed to sync workspace from another window:', err);
      }
    }).then((fn) => { cancelled ? fn() : (unlisten = fn); });
    return () => { cancelled = true; if (unlisten) unlisten(); };
  }, [storageScope]);

  const resolveSyncConflict = useCallback(async (strategy) => {
    const conflict = cloudConflictRef.current;
    if (!conflict || !userUid) return;

    if (strategy === 'cloud') {
      const cloudBoards = ensureCardUids(conflict.boards || []);
      cloudRevisionRef.current = conflict.revision;
      cloudConflictRef.current = null;
      setCloudConflict(null);
      skipNextSaveRef.current = true;
      setBoardsRaw(cloudBoards);
      await saveBoards(cloudBoards, storageScope);
      setSyncState('synced');
      toast.success('Loaded the newer cloud workspace');
      return;
    }

    if (strategy === 'local') {
      setSyncState('syncing');
      const response = await workspaceApi.save(boardsRef.current, conflict.revision, true);
      cloudRevisionRef.current = response.workspace.revision;
      cloudConflictRef.current = null;
      setCloudConflict(null);
      setSyncState('synced');
      toast.success('Uploaded this device’s workspace');
    }
  }, [storageScope, userUid]);

  return (
    <CardsContext.Provider value={{
      boards, setBoards, defaultCards, isLoaded,
      saveState, lastSavedAt, storageKind, syncState, cloudConflict, resolveSyncConflict,
      undo, redo,
      canUndo: history.past.length > 0,
      canRedo: history.future.length > 0,
    }}>
      {children}
    </CardsContext.Provider>
  );
};

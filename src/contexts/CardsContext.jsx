import { createContext, useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { emit, listen } from '@tauri-apps/api/event';
import { useAuth } from './AuthContext';
import {
  getWorkspace,
  saveWorkspace,
  subscribeWorkspace,
  SyncConflictError,
} from '../services/firestoreSync';
import {
  loadBoards as loadStoredBoards,
  saveBoards,
  stageBoards,
  storageKind,
} from '../services/boardStorage';

export const CardsContext = createContext();

// Cross-window sync — main window and menu-bar panel share the same SQLite.
const WORKSPACE_EVENT = 'kandoo://workspace-updated';
const WINDOW_LABEL = (() => {
  try { return isTauri() ? getCurrentWindow().label : 'web'; } catch { return 'web'; }
})();

const defaultCards = [
  { uid: 'col-todo',       title: 'To-do',       color: 'bg-gray-200',  isVisible: true, tasks: {} },
  { uid: 'col-inprogress', title: 'In-Progress',  color: 'bg-blue-100',  isVisible: true, tasks: {} },
  { uid: 'col-done',       title: 'Done',         color: 'bg-green-100', isVisible: true, tasks: {} },
];

const ensureCardUids = (boards) =>
  boards.map(b => ({
    ...b,
    cards: (b.cards || []).map(c => c.uid ? c : { ...c, uid: uuidv4() }),
  }));

const SAVE_DEBOUNCE_MS    = 500;
const HISTORY_LIMIT       = 50;
const HISTORY_DEBOUNCE_MS = 400;

export const CardsProvider = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const userUid      = user?.uid || null;
  const storageScope = userUid || 'guest';

  const [boards,        setBoardsRaw]    = useState([]);
  const [isLoaded,      setIsLoaded]     = useState(false);
  const [saveState,     setSaveState]    = useState('loading');
  const [lastSavedAt,   setLastSavedAt]  = useState(null);
  const [syncState,     setSyncState]    = useState('local');
  const [cloudConflict, setCloudConflict] = useState(null);
  const [history,       setHistory]      = useState({ past: [], future: [] });

  const saveTimeoutRef      = useRef(null);
  const cloudRevisionRef    = useRef(0);
  const cloudSyncingRef     = useRef(false);
  const pendingCloudRef     = useRef(null);
  const cloudConflictRef    = useRef(null);
  // Prevents save → reload → save feedback loops between windows / Firestore listener.
  const skipNextSaveRef     = useRef(false);
  // Tracks whether we are the source of the most recent Firestore write so we
  // can ignore the echo from onSnapshot.
  const localRevisionRef    = useRef(0);

  // ── History internals ────────────────────────────────────────────────────
  const skipHistoryRef      = useRef(false);
  const pendingSnapshotRef  = useRef(null);
  const snapshotTimerRef    = useRef(null);
  const boardsRef           = useRef(boards);
  const historyRef          = useRef(history);
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
      setHistory(h => ({ past: [...h.past, snap].slice(-HISTORY_LIMIT), future: [] }));
    }
  }, []);

  const setBoards = useCallback((updater) => {
    setBoardsRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (!skipHistoryRef.current) {
        if (pendingSnapshotRef.current === null) pendingSnapshotRef.current = prev;
        if (snapshotTimerRef.current) clearTimeout(snapshotTimerRef.current);
        snapshotTimerRef.current = setTimeout(() => {
          const snap = pendingSnapshotRef.current;
          pendingSnapshotRef.current = null;
          snapshotTimerRef.current   = null;
          if (snap !== null) {
            setHistory(h => ({ past: [...h.past, snap].slice(-HISTORY_LIMIT), future: [] }));
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
    setHistory({ past: h.past.slice(0, -1), future: [boardsRef.current, ...h.future].slice(0, HISTORY_LIMIT) });
    queueMicrotask(() => { skipHistoryRef.current = false; });
  }, [flushPendingSnapshot]);

  const redo = useCallback(() => {
    flushPendingSnapshot();
    const h = historyRef.current;
    if (h.future.length === 0) return;
    const next = h.future[0];
    skipHistoryRef.current = true;
    setBoardsRaw(next);
    setHistory({ past: [...h.past, boardsRef.current].slice(-HISTORY_LIMIT), future: h.future.slice(1) });
    queueMicrotask(() => { skipHistoryRef.current = false; });
  }, [flushPendingSnapshot]);

  // ── Initial load ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return undefined;
    let cancelled = false;

    const hydrateBoards = async () => {
      setIsLoaded(false);
      setSaveState('loading');
      setSyncState(userUid ? 'connecting' : 'local');
      setCloudConflict(null);
      cloudConflictRef.current  = null;
      cloudRevisionRef.current  = 0;
      localRevisionRef.current  = 0;

      try {
        // 1. Read local cache first (instant, no network).
        let localBoards = await loadStoredBoards(storageScope);

        // 2. If account has no local data yet, check guest workspace to adopt.
        if (userUid && localBoards.length === 0) {
          localBoards = await loadStoredBoards('guest');
        }
        if (cancelled) return;

        let hydrated = localBoards;

        if (userUid) {
          try {
            const { workspace: remote } = await getWorkspace(userUid);
            cloudRevisionRef.current = remote.revision;

            if (remote.boards?.length > 0) {
              const hasLocalData = localBoards.length > 0;
              const localDiffers = hasLocalData &&
                JSON.stringify(localBoards) !== JSON.stringify(remote.boards);

              if (localDiffers) {
                // Both sides have data that diverged — present conflict UI.
                hydrated = localBoards;
                cloudConflictRef.current = remote;
                setCloudConflict(remote);
                setSyncState('conflict');
              } else {
                // Remote is authoritative.
                hydrated = remote.boards;
                setSyncState('synced');
              }
            } else {
              // New account — push local (or a blank board) up to Firestore.
              hydrated = localBoards.length > 0
                ? localBoards
                : [{ id: uuidv4(), title: 'My workspace', cards: defaultCards }];
              try {
                const { workspace: saved } = await saveWorkspace(userUid, hydrated, 0);
                cloudRevisionRef.current = saved.revision;
                localRevisionRef.current = saved.revision;
              } catch (saveErr) {
                if (saveErr instanceof SyncConflictError) {
                  hydrated = saveErr.data.workspace.boards;
                  cloudRevisionRef.current = saveErr.data.workspace.revision;
                } else throw saveErr;
              }
              setSyncState('synced');
            }
          } catch (cloudErr) {
            if (!(cloudErr instanceof SyncConflictError)) {
              console.warn('[Kandoo] Firestore unavailable on load:', cloudErr);
              setSyncState('offline');
              if (localBoards.length === 0) {
                toast.warning('Cloud is unavailable. Started with a local workspace.');
              }
            }
          }
        }

        if (hydrated.length === 0) {
          hydrated = [{ id: uuidv4(), title: 'My workspace', cards: defaultCards }];
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
        console.error('[Kandoo] Failed to load workspace:', err);
        if (cancelled) return;
        setBoardsRaw([{ id: uuidv4(), title: 'My workspace', cards: defaultCards }]);
        setSaveState('error');
        toast.error('Could not open local storage. Export a backup before closing the app.');
      } finally {
        if (!cancelled) setIsLoaded(true);
      }
    };

    hydrateBoards();
    return () => { cancelled = true; };
  }, [authLoading, storageScope, userUid]);

  // ── Firestore real-time listener ─────────────────────────────────────────
  // Listens for changes made on another device and merges them in.
  useEffect(() => {
    if (!userUid || !isLoaded) return undefined;

    const unsubscribe = subscribeWorkspace(userUid, ({ boards: remoteBoards, revision }) => {
      // Ignore echoes of our own saves.
      if (revision <= localRevisionRef.current) return;
      // Ignore while a conflict is pending — user needs to resolve first.
      if (cloudConflictRef.current) return;

      cloudRevisionRef.current = revision;
      setSyncState('synced');
      skipNextSaveRef.current  = true;
      skipHistoryRef.current   = true;
      setBoardsRaw(ensureCardUids(remoteBoards));
      queueMicrotask(() => { skipHistoryRef.current = false; });
    });

    return unsubscribe;
  }, [userUid, isLoaded]);

  // ── Firestore cloud sync (debounced, queued) ─────────────────────────────
  const syncCloud = useCallback(async (snapshot) => {
    if (!userUid || cloudConflictRef.current) return;
    pendingCloudRef.current = snapshot;
    if (cloudSyncingRef.current) return;

    cloudSyncingRef.current = true;
    while (pendingCloudRef.current && !cloudConflictRef.current) {
      const next = pendingCloudRef.current;
      pendingCloudRef.current = null;
      setSyncState('syncing');
      try {
        const { workspace: saved } = await saveWorkspace(userUid, next, cloudRevisionRef.current);
        cloudRevisionRef.current = saved.revision;
        localRevisionRef.current = saved.revision;
        setSyncState('synced');
      } catch (err) {
        if (err instanceof SyncConflictError) {
          cloudConflictRef.current = err.data.workspace;
          setCloudConflict(err.data.workspace);
          setSyncState('conflict');
          pendingCloudRef.current = null;
          toast.error('Cloud sync paused: this workspace changed on another device.');
        } else {
          console.warn('[Kandoo] Cloud sync failed:', err);
          setSyncState('offline');
          pendingCloudRef.current = null;
        }
      }
    }
    cloudSyncingRef.current = false;
  }, [userUid]);

  // ── Persist on every boards change ───────────────────────────────────────
  useEffect(() => {
    if (!isLoaded) return;
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
        console.error('[Kandoo] Failed to save workspace:', err);
        setSaveState('error');
        toast.error('Changes could not be saved locally');
      }
    }, SAVE_DEBOUNCE_MS);

    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [boards, isLoaded, storageScope, syncCloud, userUid]);

  // ── Cross-window sync (desktop only: main ↔ panel via SQLite) ───────────
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
        console.error('[Kandoo] Failed to sync from another window:', err);
      }
    }).then((fn) => { cancelled ? fn() : (unlisten = fn); });
    return () => { cancelled = true; if (unlisten) unlisten(); };
  }, [storageScope]);

  // ── Conflict resolution ───────────────────────────────────────────────────
  const resolveSyncConflict = useCallback(async (strategy) => {
    const conflict = cloudConflictRef.current;
    if (!conflict || !userUid) return;

    if (strategy === 'cloud') {
      const cloudBoards = ensureCardUids(conflict.boards || []);
      cloudRevisionRef.current = conflict.revision;
      localRevisionRef.current = conflict.revision;
      cloudConflictRef.current = null;
      setCloudConflict(null);
      skipNextSaveRef.current  = true;
      setBoardsRaw(cloudBoards);
      await saveBoards(cloudBoards, storageScope);
      setSyncState('synced');
      toast.success('Loaded the newer cloud workspace');
      return;
    }

    if (strategy === 'local') {
      setSyncState('syncing');
      try {
        const { workspace: saved } = await saveWorkspace(userUid, boardsRef.current, conflict.revision, true);
        cloudRevisionRef.current = saved.revision;
        localRevisionRef.current = saved.revision;
        cloudConflictRef.current = null;
        setCloudConflict(null);
        setSyncState('synced');
        toast.success('Uploaded this device\'s workspace');
      } catch (err) {
        console.error('[Kandoo] Conflict resolution failed:', err);
        setSyncState('offline');
        toast.error('Could not upload local workspace. Try again.');
      }
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

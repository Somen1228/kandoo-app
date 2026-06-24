import { createContext, useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { toast } from '../utils/toast';
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
import { defaultCards, ensureCoreColumns } from '../utils/coreColumns';

export const CardsContext = createContext();

// Cross-window sync — main window and menu-bar panel share the same SQLite.
const WORKSPACE_EVENT = 'kandoo://workspace-updated';
const WINDOW_LABEL = (() => {
  try { return isTauri() ? getCurrentWindow().label : 'web'; } catch { return 'web'; }
})();

const ensureCardUids = (boards) =>
  boards.map(b => ({
    ...b,
    cards: (b.cards || []).map(c => c.uid ? c : { ...c, uid: uuidv4() }),
  }));

// ── Workspace merge ───────────────────────────────────────────────────────────
// Union strategy: boards/columns/tasks only on one side are always kept.
// Tasks that exist on BOTH sides with different content are surfaced as
// conflicts for the user to resolve manually (see TaskConflictModal).
// Note cards keep local content (rich text can't be auto-combined).
// Items deleted on one side are resurrected (no tombstone tracking).

// Conflict key: "<boardId>:<colUid>:<taskId>" — globally unique.
export function conflictKey(boardId, colUid, taskId) {
  return `${boardId}:${colUid}:${taskId}`;
}

// Normalise optional fields so field-order / undefined-vs-empty differences
// don't count as conflicts. Only semantically meaningful fields are compared.
export function taskSignature(t) {
  return JSON.stringify({
    value:  t.value  ?? '',
    done:   t.done   ?? false,
    due:    t.due    ?? null,
    images: (t.images ?? []).slice().sort(),
  });
}

// Count what each side uniquely contributes so we can summarise auto-merges.
function buildMergeSummary(localBoards, cloudBoards) {
  const cloudById = Object.fromEntries(cloudBoards.map(b => [b.id, b]));
  const localById = Object.fromEntries(localBoards.map(b => [b.id, b]));
  let addedFromCloud = 0, addedFromLocal = 0;

  cloudBoards.forEach(b => {
    if (!localById[b.id]) {
      (b.cards || []).forEach(col => { addedFromCloud += Object.keys(col.tasks || {}).length; });
    } else {
      const localBoard = localById[b.id];
      const localColByUid = Object.fromEntries((localBoard.cards || []).map(c => [c.uid, c]));
      (b.cards || []).forEach(col => {
        if ((col.type || 'todo') !== 'todo') return;
        const lCol = localColByUid[col.uid];
        const lTasks = lCol?.tasks || {};
        Object.keys(col.tasks || {}).forEach(k => { if (!lTasks[k]) addedFromCloud++; });
      });
    }
  });

  localBoards.forEach(b => {
    if (!cloudById[b.id]) {
      (b.cards || []).forEach(col => { addedFromLocal += Object.keys(col.tasks || {}).length; });
    } else {
      const cloudBoard = cloudById[b.id];
      const cloudColByUid = Object.fromEntries((cloudBoard.cards || []).map(c => [c.uid, c]));
      (b.cards || []).forEach(col => {
        if ((col.type || 'todo') !== 'todo') return;
        const cCol = cloudColByUid[col.uid];
        const cTasks = cCol?.tasks || {};
        Object.keys(col.tasks || {}).forEach(k => { if (!cTasks[k]) addedFromLocal++; });
      });
    }
  });

  return { addedFromCloud, addedFromLocal };
}

// Returns { boards, conflicts[] } where conflicts are tasks needing user input.
// Pass choices = { [conflictKey]: 'local' | 'cloud' } to resolve them.
export function mergeWorkspaces(localBoards, cloudBoards, choices = {}) {
  const conflicts = [];
  const cloudById = Object.fromEntries(cloudBoards.map(b => [b.id, b]));
  const localIds  = new Set(localBoards.map(b => b.id));

  const boards = [
    ...localBoards.map(localBoard => {
      const cloudBoard = cloudById[localBoard.id];
      if (!cloudBoard) return localBoard;

      const cloudColByUid = Object.fromEntries((cloudBoard.cards || []).map(c => [c.uid, c]));
      const localUids = new Set((localBoard.cards || []).map(c => c.uid));

      const mergedCards = [
        ...(localBoard.cards || []).map(col => {
          const cloudCol = cloudColByUid[col.uid];
          if (!cloudCol) return col;
          if ((col.type || 'todo') !== 'todo') return col; // notes: keep local

          const localTasks = col.tasks || {};
          const cloudTasks = cloudCol.tasks || {};
          const merged = { ...cloudTasks }; // start with cloud (adds cloud-only tasks)

          for (const taskId of Object.keys(localTasks)) {
            const ck = conflictKey(localBoard.id, col.uid, taskId);
            if (cloudTasks[taskId] && taskSignature(localTasks[taskId]) !== taskSignature(cloudTasks[taskId])) {
              // Task edited on both sides — check if user already made a choice
              if (choices[ck] === 'cloud') {
                merged[taskId] = cloudTasks[taskId];
              } else if (choices[ck] === 'local') {
                merged[taskId] = localTasks[taskId];
              } else {
                // No choice yet — record conflict, placeholder = local
                conflicts.push({
                  key: ck,
                  boardId: localBoard.id,
                  boardTitle: localBoard.title,
                  colUid: col.uid,
                  colTitle: col.title,
                  taskId,
                  local: localTasks[taskId],
                  cloud: cloudTasks[taskId],
                });
                merged[taskId] = localTasks[taskId]; // placeholder
              }
            } else {
              merged[taskId] = localTasks[taskId]; // local-only or identical
            }
          }

          return { ...col, tasks: merged };
        }),
        ...(cloudBoard.cards || []).filter(col => !localUids.has(col.uid)),
      ];

      return { ...localBoard, cards: mergedCards };
    }),
    ...cloudBoards.filter(b => !localIds.has(b.id)),
  ];

  return { boards, conflicts };
}

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
  const [pendingMerge,  setPendingMerge] = useState(null); // {localBoards, cloudBoards, conflicts, revision}
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
      const next = ensureCoreColumns(typeof updater === 'function' ? updater(prev) : updater);
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

              // If cloud was force-pushed during a conflict resolution on another device,
              // its forcedRevision === revision. Silently accept it — no need to re-conflict.
              const cloudWasForceReset = remote.forcedRevision > 0 &&
                remote.forcedRevision === remote.revision;

              if (localDiffers && !cloudWasForceReset) {
                // Both sides have genuinely diverged — present conflict UI.
                hydrated = localBoards;
                cloudConflictRef.current = remote;
                setCloudConflict(remote);
                setSyncState('conflict');
              } else {
                // Remote is authoritative (either identical, or was a force-reset).
                hydrated = remote.boards;
                if (cloudWasForceReset && localDiffers) {
                  toast.info('Loaded workspace resolved by another device.');
                }
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
        hydrated = ensureCoreColumns(ensureCardUids(hydrated));
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
        setBoardsRaw(ensureCoreColumns([{ id: uuidv4(), title: 'My workspace', cards: defaultCards }]));
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

    const unsubscribe = subscribeWorkspace(userUid, ({ boards: remoteBoards, revision, forcedRevision }) => {
      // Ignore echoes of our own saves.
      if (revision <= localRevisionRef.current) return;

      const cloudWasForceReset = forcedRevision > 0 && forcedRevision === revision;

      // If another device force-reset the cloud during conflict resolution, auto-accept.
      if (cloudConflictRef.current) {
        if (!cloudWasForceReset) return; // still let user resolve their pending conflict
        cloudConflictRef.current = null;
        setCloudConflict(null);
        setPendingMerge(null);
        toast.info('Conflict resolved by another device — workspace updated.');
      }

      cloudRevisionRef.current = revision;
      localRevisionRef.current = revision;
      setSyncState('synced');
      skipNextSaveRef.current  = true;
      skipHistoryRef.current   = true;
      setBoardsRaw(ensureCoreColumns(ensureCardUids(remoteBoards)));
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
        setBoardsRaw(ensureCoreColumns(ensureCardUids(fresh)));
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
      const cloudBoards = ensureCoreColumns(ensureCardUids(conflict.boards || []));
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

    if (strategy === 'merge') {
      const cloudBoards = ensureCoreColumns(ensureCardUids(conflict.boards || []));
      const { boards: mergedBoards, conflicts } = mergeWorkspaces(boardsRef.current, cloudBoards);
      if (conflicts.length > 0) {
        // Pause — surface per-task conflicts for the user to resolve
        setPendingMerge({ localBoards: boardsRef.current, cloudBoards, conflicts, revision: conflict.revision });
        return;
      }
      // No real content conflicts — compute what changed so we can tell the user
      const autoMergeSummary = buildMergeSummary(boardsRef.current, cloudBoards);
      await applyMerge(ensureCoreColumns(ensureCardUids(mergedBoards)), conflict.revision, autoMergeSummary);
    }
  }, [storageScope, userUid]); // eslint-disable-line react-hooks/exhaustive-deps

  const cancelMerge = useCallback(() => setPendingMerge(null), []);

  // Called by TaskConflictModal once the user has chosen local/cloud per task
  const resolveTaskConflicts = useCallback(async (choices) => {
    if (!pendingMerge || !userUid) return;
    const { localBoards, cloudBoards, revision } = pendingMerge;
    const { boards: finalBoards } = mergeWorkspaces(localBoards, cloudBoards, choices);
    setPendingMerge(null);
    await applyMerge(ensureCoreColumns(ensureCardUids(finalBoards)), revision);
  }, [pendingMerge, userUid]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyMerge = useCallback(async (merged, revision, summary = null) => {
    setSyncState('syncing');
    try {
      const normalizedMerged = ensureCoreColumns(ensureCardUids(merged));
      const { workspace: saved } = await saveWorkspace(userUid, normalizedMerged, revision, true);
      cloudRevisionRef.current = saved.revision;
      localRevisionRef.current = saved.revision;
      cloudConflictRef.current = null;
      setCloudConflict(null);
      skipNextSaveRef.current = true;
      setBoardsRaw(normalizedMerged);
      await saveBoards(normalizedMerged, storageScope);
      setSyncState('synced');

      if (summary) {
        const { addedFromCloud, addedFromLocal } = summary;
        if (addedFromCloud === 0 && addedFromLocal === 0) {
          toast.success('Workspaces merged — both sides were already in sync, no changes needed');
        } else {
          const parts = [];
          if (addedFromCloud > 0) parts.push(`${addedFromCloud} task${addedFromCloud !== 1 ? 's' : ''} from cloud`);
          if (addedFromLocal > 0) parts.push(`${addedFromLocal} task${addedFromLocal !== 1 ? 's' : ''} kept from this device`);
          toast.success(`Merged automatically — ${parts.join(', ')} · no conflicting edits found`);
        }
      } else {
        toast.success('Workspaces merged');
      }
    } catch (err) {
      console.error('[Kandoo] Merge failed:', err);
      setSyncState('offline');
      toast.error('Could not save merged workspace. Try again.');
    }
  }, [storageScope, userUid]);

  return (
    <CardsContext.Provider value={{
      boards, setBoards, defaultCards, isLoaded,
      saveState, lastSavedAt, storageKind, syncState, cloudConflict, resolveSyncConflict,
      pendingMerge, resolveTaskConflicts, cancelMerge,
      undo, redo,
      canUndo: history.past.length > 0,
      canRedo: history.future.length > 0,
    }}>
      {children}
    </CardsContext.Provider>
  );
};

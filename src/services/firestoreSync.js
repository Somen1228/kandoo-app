import {
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from '../config/firestore';

const workspaceRef = (userId) => doc(db, 'workspaces', userId);

// Thrown by saveWorkspace when another device saved a newer revision first.
export class SyncConflictError extends Error {
  constructor(workspace) {
    super('Workspace conflict');
    this.status = 409;
    this.data = { workspace };
  }
}

/**
 * Load the workspace from Firestore.
 * Returns { workspace: { boards, revision } }.
 * Returns an empty workspace (revision 0) when no cloud data exists yet.
 */
export async function getWorkspace(userId) {
  if (!db || !userId) return { workspace: { boards: [], revision: 0, forcedRevision: 0 } };

  const snap = await getDoc(workspaceRef(userId));
  if (!snap.exists()) return { workspace: { boards: [], revision: 0, forcedRevision: 0 } };

  const data = snap.data();
  return {
    workspace: {
      boards: data.boards ?? [],
      revision: data.revision ?? 0,
      forcedRevision: data.forcedRevision ?? 0,
      // User preferences (last-write-wins by their own client timestamps).
      settings: data.settings ?? null,
      settingsUpdatedAt: data.settingsUpdatedAt ?? 0,
      themeId: data.themeId ?? null,
      customThemes: data.customThemes ?? null,
      themeUpdatedAt: data.themeUpdatedAt ?? 0,
    },
  };
}

/**
 * Last-write-wins write of user preferences (settings / theme) into the same
 * workspace doc. Merged so it never disturbs boards/revision, and not gated on
 * the board revision — preferences carry their own client timestamps instead.
 */
export async function savePrefs(userId, fields) {
  if (!db || !userId) return;
  await setDoc(workspaceRef(userId), fields, { merge: true });
}

/**
 * Save boards to Firestore using an optimistic transaction.
 * If the remote revision is ahead of currentRevision, throws SyncConflictError
 * so the caller can present the user with a merge choice (same as the old API).
 * Pass force=true to skip the revision check (used when the user picks "keep local").
 */
export async function saveWorkspace(userId, boards, currentRevision, force = false) {
  if (!db || !userId) throw new Error('Firestore not available');

  const ref = workspaceRef(userId);

  if (force) {
    const newRevision = currentRevision + 1;
    // forcedRevision marks this as an intentional override (conflict resolution).
    // Other devices check this on load and silently accept cloud instead of re-prompting.
    // merge:true so we never clobber the user-preference fields stored alongside.
    await setDoc(ref, { boards, revision: newRevision, forcedRevision: newRevision, updatedAt: serverTimestamp() }, { merge: true });
    return { workspace: { boards, revision: newRevision, forcedRevision: newRevision } };
  }

  const result = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const remoteRevision = snap.exists() ? (snap.data().revision ?? 0) : 0;

    if (remoteRevision > currentRevision) {
      return {
        conflict: true,
        workspace: { boards: snap.data().boards ?? [], revision: remoteRevision },
      };
    }

    const newRevision = remoteRevision + 1;
    // merge:true preserves the settings/theme fields written by savePrefs.
    tx.set(ref, { boards, revision: newRevision, updatedAt: serverTimestamp() }, { merge: true });
    return { conflict: false, workspace: { boards, revision: newRevision } };
  });

  if (result.conflict) throw new SyncConflictError(result.workspace);

  return result;
}

/**
 * Subscribe to real-time Firestore changes.
 * callback receives { boards, revision } whenever another device saves.
 * Returns an unsubscribe function.
 */
export function subscribeWorkspace(userId, callback) {
  if (!db || !userId) return () => {};

  return onSnapshot(
    workspaceRef(userId),
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      callback({
        boards: data.boards ?? [],
        revision: data.revision ?? 0,
        forcedRevision: data.forcedRevision ?? 0,
        settings: data.settings ?? null,
        settingsUpdatedAt: data.settingsUpdatedAt ?? 0,
        themeId: data.themeId ?? null,
        customThemes: data.customThemes ?? null,
        themeUpdatedAt: data.themeUpdatedAt ?? 0,
      });
    },
    (err) => console.warn('[Kandoo] Firestore snapshot error:', err),
  );
}

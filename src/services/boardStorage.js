import { isTauri } from '@tauri-apps/api/core';
import Database from '@tauri-apps/plugin-sql';

const DATABASE_URL = 'sqlite:kandoo.db';
const WORKSPACE_KEY = 'workspace';
const BROWSER_STORAGE_KEY = 'kandoo-local-workspace-v1';
const PENDING_STORAGE_KEY = 'kandoo-pending-workspace-v1';
const LEGACY_STORAGE_KEY = 'boards';

let databasePromise;
let writeQueue = Promise.resolve();

const normalizeScope = (scope) => (typeof scope === 'string' && scope.trim() ? scope.trim() : 'guest');
const scopedKey = (base, scope) => {
  const normalized = normalizeScope(scope);
  return normalized === 'guest' ? base : `${base}:${normalized}`;
};

const parseBoards = (raw) => {
  if (!raw) return [];

  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error('Local workspace data is not a board list');
  }

  return parsed;
};

const getDatabase = async () => {
  if (!databasePromise) {
    databasePromise = Database.load(DATABASE_URL);
  }
  return databasePromise;
};

const readBrowserBoards = (scope) => {
  const normalized = normalizeScope(scope);
  const key = scopedKey(BROWSER_STORAGE_KEY, normalized);
  const current = localStorage.getItem(key);
  if (current) return parseBoards(current);

  // The earlier web app used boards_<firebase uid>. Claim that account cache
  // before considering the anonymous legacy workspace.
  const accountLegacyKey = normalized === 'guest' ? null : `boards_${normalized}`;
  const accountLegacy = accountLegacyKey ? localStorage.getItem(accountLegacyKey) : null;
  if (accountLegacy) {
    const boards = parseBoards(accountLegacy);
    localStorage.setItem(key, accountLegacy);
    localStorage.removeItem(accountLegacyKey);
    return boards;
  }

  if (normalized !== 'guest') return [];
  const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!legacy) return [];

  const boards = parseBoards(legacy);
  localStorage.setItem(key, legacy);
  localStorage.removeItem(LEGACY_STORAGE_KEY);
  return boards;
};

const readPendingSnapshot = (scope) => {
  const key = scopedKey(PENDING_STORAGE_KEY, scope);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const pending = JSON.parse(raw);
    if (typeof pending?.savedAt !== 'string' || typeof pending?.value !== 'string') {
      localStorage.removeItem(key);
      return null;
    }

    return pending;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
};

export const storageKind = isTauri() ? 'sqlite' : 'browser';

export async function loadBoards(scope = 'guest') {
  if (!isTauri()) return readBrowserBoards(scope);

  const database = await getDatabase();
  const key = scopedKey(WORKSPACE_KEY, scope);
  const rows = await database.select(
    'SELECT value, updated_at FROM app_state WHERE key = $1 LIMIT 1',
    [key],
  );

  const persisted = rows[0] || null;
  const pending = readPendingSnapshot(scope);
  const pendingIsNewer = pending && (
    !persisted || Date.parse(pending.savedAt) > Date.parse(persisted.updated_at)
  );

  if (pendingIsNewer) return parseBoards(pending.value);

  if (pending) localStorage.removeItem(scopedKey(PENDING_STORAGE_KEY, scope));
  return persisted ? parseBoards(persisted.value) : [];
}

export function stageBoards(boards, scope = 'guest') {
  const value = JSON.stringify(boards);

  if (!isTauri()) {
    localStorage.setItem(scopedKey(BROWSER_STORAGE_KEY, scope), value);
    return;
  }

  try {
    localStorage.setItem(scopedKey(PENDING_STORAGE_KEY, scope), JSON.stringify({
      savedAt: new Date().toISOString(),
      value,
    }));
  } catch {
    // SQLite remains available even if WebKit cannot hold the recovery snapshot.
  }
}

async function persistBoards(boards, scope) {
  const payload = JSON.stringify(boards);

  if (!isTauri()) {
    localStorage.setItem(scopedKey(BROWSER_STORAGE_KEY, scope), payload);
    return;
  }

  const database = await getDatabase();
  const key = scopedKey(WORKSPACE_KEY, scope);
  await database.execute(
    `INSERT INTO app_state (key, value, updated_at)
     VALUES ($1, $2, $3)
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_at = excluded.updated_at`,
    [key, payload, new Date().toISOString()],
  );

  const pending = readPendingSnapshot(scope);
  if (pending?.value === payload) {
    localStorage.removeItem(scopedKey(PENDING_STORAGE_KEY, scope));
  }
}

export function saveBoards(boards, scope = 'guest') {
  writeQueue = writeQueue
    .catch(() => undefined)
    .then(() => persistBoards(boards, scope));

  return writeQueue;
}

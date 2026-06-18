import { isTauri } from '@tauri-apps/api/core';
import Database from '@tauri-apps/plugin-sql';

const DATABASE_URL = 'sqlite:kandoo.db';
const WORKSPACE_KEY = 'workspace';
const BROWSER_STORAGE_KEY = 'kandoo-local-workspace-v1';
const PENDING_STORAGE_KEY = 'kandoo-pending-workspace-v1';
const LEGACY_STORAGE_KEY = 'boards';

let databasePromise;
let writeQueue = Promise.resolve();

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

const readBrowserBoards = () => {
  const current = localStorage.getItem(BROWSER_STORAGE_KEY);
  if (current) return parseBoards(current);

  const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!legacy) return [];

  const boards = parseBoards(legacy);
  localStorage.setItem(BROWSER_STORAGE_KEY, legacy);
  localStorage.removeItem(LEGACY_STORAGE_KEY);
  return boards;
};

const readPendingSnapshot = () => {
  try {
    const raw = localStorage.getItem(PENDING_STORAGE_KEY);
    if (!raw) return null;

    const pending = JSON.parse(raw);
    if (typeof pending?.savedAt !== 'string' || typeof pending?.value !== 'string') {
      localStorage.removeItem(PENDING_STORAGE_KEY);
      return null;
    }

    return pending;
  } catch {
    localStorage.removeItem(PENDING_STORAGE_KEY);
    return null;
  }
};

export const storageKind = isTauri() ? 'sqlite' : 'browser';

export async function loadBoards() {
  if (!isTauri()) return readBrowserBoards();

  const database = await getDatabase();
  const rows = await database.select(
    'SELECT value, updated_at FROM app_state WHERE key = $1 LIMIT 1',
    [WORKSPACE_KEY],
  );

  const persisted = rows[0] || null;
  const pending = readPendingSnapshot();
  const pendingIsNewer = pending && (
    !persisted || Date.parse(pending.savedAt) > Date.parse(persisted.updated_at)
  );

  if (pendingIsNewer) return parseBoards(pending.value);

  if (pending) localStorage.removeItem(PENDING_STORAGE_KEY);
  return persisted ? parseBoards(persisted.value) : [];
}

export function stageBoards(boards) {
  const value = JSON.stringify(boards);

  if (!isTauri()) {
    localStorage.setItem(BROWSER_STORAGE_KEY, value);
    return;
  }

  try {
    localStorage.setItem(PENDING_STORAGE_KEY, JSON.stringify({
      savedAt: new Date().toISOString(),
      value,
    }));
  } catch {
    // SQLite remains available even if WebKit cannot hold the recovery snapshot.
  }
}

async function persistBoards(boards) {
  const payload = JSON.stringify(boards);

  if (!isTauri()) {
    localStorage.setItem(BROWSER_STORAGE_KEY, payload);
    return;
  }

  const database = await getDatabase();
  await database.execute(
    `INSERT INTO app_state (key, value, updated_at)
     VALUES ($1, $2, $3)
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_at = excluded.updated_at`,
    [WORKSPACE_KEY, payload, new Date().toISOString()],
  );

  const pending = readPendingSnapshot();
  if (pending?.value === payload) {
    localStorage.removeItem(PENDING_STORAGE_KEY);
  }
}

export function saveBoards(boards) {
  writeQueue = writeQueue
    .catch(() => undefined)
    .then(() => persistBoards(boards));

  return writeQueue;
}

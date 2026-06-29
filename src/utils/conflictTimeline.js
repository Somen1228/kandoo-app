const LIMIT = 12;
const STORAGE_PREFIX = 'kandoo-conflict-timeline-v1';

export function conflictTimelineKey(scope = 'guest') {
  return `${STORAGE_PREFIX}:${scope || 'guest'}`;
}

export function readConflictTimeline(scope = 'guest') {
  try {
    const parsed = JSON.parse(localStorage.getItem(conflictTimelineKey(scope)) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeConflictTimeline(scope = 'guest', entries = []) {
  const safeEntries = Array.isArray(entries) ? entries.slice(0, LIMIT) : [];
  try {
    localStorage.setItem(conflictTimelineKey(scope), JSON.stringify(safeEntries));
  } catch {
    // Board snapshots can be large. If quota is tight, keep the newest small tail.
    try {
      localStorage.setItem(conflictTimelineKey(scope), JSON.stringify(safeEntries.slice(0, 3)));
    } catch {
      // Recovery history is best-effort; normal conflict resolution must not fail.
    }
  }
  return safeEntries;
}

export function createConflictTimelineEntry({
  strategy,
  localBoards,
  cloudBoards,
  resolvedBoards,
  revision,
  choices = null,
}) {
  return {
    id: `conflict_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    strategy,
    revision: revision || 0,
    choices,
    localBoards: Array.isArray(localBoards) ? localBoards : [],
    cloudBoards: Array.isArray(cloudBoards) ? cloudBoards : [],
    resolvedBoards: Array.isArray(resolvedBoards) ? resolvedBoards : [],
  };
}

export function addConflictTimelineEntry(scope, entry) {
  const next = [entry, ...readConflictTimeline(scope)].slice(0, LIMIT);
  return writeConflictTimeline(scope, next);
}

export function removeConflictTimelineEntry(scope, id) {
  return writeConflictTimeline(scope, readConflictTimeline(scope).filter((entry) => entry.id !== id));
}

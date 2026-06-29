// Powerful search: multi-keyword AND, has:image / has:done filters,
// per-board match counts, ordered match list for jump-to-next navigation.

import { isHtml, htmlToText } from './htmlEditor';

export function parseQuery(input) {
  const raw = (input || '').trim();
  const tokens = raw.split(/\s+/).filter(Boolean);
  const terms = [];
  const filters = { hasImage: false, hasDone: false };

  for (const tok of tokens) {
    const lower = tok.toLowerCase();
    if (lower === 'has:image' || lower === 'has:images' || lower === 'has:attachment') {
      filters.hasImage = true;
    } else if (lower === 'has:done' || lower === 'is:done') {
      filters.hasDone = true;
    } else {
      terms.push(tok);
    }
  }

  const hasFilter = filters.hasImage || filters.hasDone;
  return {
    raw,
    terms,
    filters,
    isEmpty: terms.length === 0 && !hasFilter,
  };
}

function plainText(value) {
  if (!value) return '';
  return isHtml(value) ? htmlToText(value) : String(value);
}

export function matchesTask(task, query) {
  if (!task) return false;
  if (query.isEmpty) return true;

  if (query.filters.hasImage && !(Array.isArray(task.images) && task.images.length > 0)) {
    return false;
  }
  if (query.filters.hasDone && !task.done) {
    return false;
  }

  if (query.terms.length === 0) return true;

  const text = plainText(task.value).toLowerCase();
  const id   = (task.id || '').toLowerCase();
  // Label names are searchable too, so a label term filters across boards.
  const labelText = Array.isArray(task.labels)
    ? task.labels.map((l) => (l?.name || '')).join(' ').toLowerCase()
    : '';
  const subtaskText = Array.isArray(task.subtasks)
    ? task.subtasks.map((s) => (s?.text || '')).join(' ').toLowerCase()
    : '';
  for (const term of query.terms) {
    const t = term.toLowerCase();
    if (!text.includes(t) && !id.includes(t) && !labelText.includes(t) && !subtaskText.includes(t)) return false;
  }
  return true;
}

export function matchesCardTitle(card, query) {
  if (!card?.title || query.terms.length === 0) return false;
  const title = card.title.toLowerCase();
  return query.terms.every((t) => title.includes(t.toLowerCase()));
}

// Per-board breakdown: { boardId, title, matchCount, taskIds[] (in display order) }
// Treat a note card as a single synthetic "task" for matching purposes.
// Returns true if the note's content/images satisfy the query.
export function matchesNote(card, query) {
  if (!card || card.type !== 'note') return false;
  if (query.isEmpty) return true;

  const note = card.note || {};
  if (query.filters.hasImage && !(Array.isArray(note.images) && note.images.length > 0)) return false;
  if (query.filters.hasDone) return false; // notes don't have done state

  if (query.terms.length === 0) return true;
  const text = plainText(note.content).toLowerCase();
  for (const term of query.terms) {
    if (!text.includes(term.toLowerCase())) return false;
  }
  return true;
}

export function searchBoards(boards, query) {
  return boards.map((b) => {
    const taskIds = [];
    for (const card of b.cards || []) {
      const cardMatchesTitle = matchesCardTitle(card, query);
      if (card.type === 'note') {
        if (cardMatchesTitle || matchesNote(card, query)) {
          // Use the card uid as the synthetic "task id" for jump-to-match
          taskIds.push(`note:${card.uid}`);
        }
        continue;
      }
      for (const task of Object.values(card.tasks || {})) {
        if (cardMatchesTitle || matchesTask(task, query)) {
          taskIds.push(task.id);
        }
      }
    }
    return { boardId: b.id, title: b.title, matchCount: taskIds.length, taskIds };
  });
}

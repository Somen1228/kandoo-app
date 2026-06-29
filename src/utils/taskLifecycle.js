import { parseDue } from './dueDate';

const DAY_MS = 86_400_000;

export function isDoneColumnTitle(title) {
  return /^(done|completed|finished)$/i.test((title || '').trim());
}

export function dayStartMs(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function getCompletionTiming(due, completedAt = Date.now()) {
  const dueDate = parseDue(due);
  if (!dueDate) return 'unscheduled';
  const completedDay = dayStartMs(completedAt);
  const dueDay = dayStartMs(dueDate);
  if (completedDay == null || dueDay == null) return 'unscheduled';
  const delta = Math.round((completedDay - dueDay) / DAY_MS);
  if (delta < 0) return 'early';
  if (delta === 0) return 'on-time';
  return 'late';
}

export function completionTimingLabel(timing) {
  if (timing === 'early') return 'Completed early';
  if (timing === 'on-time') return 'Completed on time';
  if (timing === 'late') return 'Completed late';
  return 'Completed';
}

export function completionTimingTone(timing) {
  if (timing === 'late') return 'overdue';
  if (timing === 'early') return 'upcoming';
  if (timing === 'on-time') return 'today';
  return 'neutral';
}

export function withDueHistory(task, nextDue, changedAt = Date.now()) {
  const previousDue = task?.due || null;
  const normalizedNextDue = nextDue || null;
  if (previousDue === normalizedNextDue) return task;
  const dueHistory = Array.isArray(task?.dueHistory) ? task.dueHistory : [];
  return {
    ...task,
    due: normalizedNextDue,
    dueHistory: [
      ...dueHistory,
      { from: previousDue, to: normalizedNextDue, changedAt },
    ],
  };
}

export function markTaskCompleted(task, fromCard, completedAt = task?.completedAt || Date.now()) {
  const previous = isDoneColumnTitle(fromCard?.title)
    ? {
        previousCardUid: task?.previousCardUid || null,
        previousCardTitle: task?.previousCardTitle || '',
      }
    : {
        previousCardUid: fromCard?.uid || null,
        previousCardTitle: fromCard?.title || '',
      };
  return {
    ...task,
    done: true,
    updatedAt: completedAt,
    completedAt,
    completedFromCardUid: fromCard?.uid || task?.completedFromCardUid || null,
    completedFromCardTitle: fromCard?.title || task?.completedFromCardTitle || '',
    completionTiming: getCompletionTiming(task?.due, completedAt),
    ...previous,
  };
}

export function markTaskOpen(task, updatedAt = Date.now()) {
  return {
    ...task,
    done: false,
    updatedAt,
    completedAt: null,
    completionTiming: null,
  };
}

export function formatDateTime(value) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

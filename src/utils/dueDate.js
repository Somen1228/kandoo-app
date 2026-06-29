/**
 * Due-date helpers for Kandoo tasks.
 *
 * A task's `due` is stored as a local ISO-like string:
 * - "YYYY-MM-DD" for date-only due dates
 * - "YYYY-MM-DDTHH:mm" for date + time due dates
 *
 * All functions are pure and tolerate missing/legacy tasks that have no `due`.
 */

const MS_PER_DAY = 86_400_000;

/** Local midnight for a given Date (defaults to now). */
export function startOfToday(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

function isValidLocalDate(date, y, mo, da, h = 0, mi = 0) {
  return (
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === y &&
    date.getMonth() === mo - 1 &&
    date.getDate() === da &&
    date.getHours() === h &&
    date.getMinutes() === mi
  );
}

export function hasDueTime(due) {
  return typeof due === 'string' && DATE_TIME_RE.test(due);
}

export function getDueDatePart(due) {
  if (!due || typeof due !== 'string') return '';
  const dateTime = DATE_TIME_RE.exec(due);
  if (dateTime) return `${dateTime[1]}-${dateTime[2]}-${dateTime[3]}`;
  return DATE_RE.test(due) ? due : '';
}

export function getDueTimePart(due) {
  if (!due || typeof due !== 'string') return '';
  const dateTime = DATE_TIME_RE.exec(due);
  return dateTime ? `${dateTime[4]}:${dateTime[5]}` : '';
}

export function composeDue(datePart, timePart = '') {
  if (!datePart || !DATE_RE.test(datePart)) return null;
  if (!timePart) return datePart;
  return /^\d{2}:\d{2}$/.test(timePart) ? `${datePart}T${timePart}` : datePart;
}

/** Parse a stored due value into a local Date, or null. */
export function parseDue(due) {
  if (!due || typeof due !== 'string') return null;
  const dateTime = DATE_TIME_RE.exec(due);
  if (dateTime) {
    const y = Number(dateTime[1]);
    const mo = Number(dateTime[2]);
    const da = Number(dateTime[3]);
    const h = Number(dateTime[4]);
    const mi = Number(dateTime[5]);
    const d = new Date(y, mo - 1, da, h, mi);
    return isValidLocalDate(d, y, mo, da, h, mi) ? d : null;
  }
  const dateOnly = DATE_RE.exec(due);
  if (!dateOnly) return null;
  const y = Number(dateOnly[1]);
  const mo = Number(dateOnly[2]);
  const da = Number(dateOnly[3]);
  const d = new Date(y, mo - 1, da);
  return isValidLocalDate(d, y, mo, da) ? d : null;
}

/** Serialise a Date or stored due string. Time is included only when requested. */
export function toDueString(value, includeTime = false) {
  if (!value) return null;
  if (typeof value === 'string' && !includeTime) return getDueDatePart(value) || null;
  const d = value instanceof Date ? value : parseDue(value);
  if (!d || Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  const datePart = `${y}-${mo}-${da}`;
  if (!includeTime) return datePart;
  const h = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${datePart}T${h}:${mi}`;
}

/** Whole-day difference from today (negative = past, 0 = today, positive = future). */
export function daysFromToday(due, now = new Date()) {
  const d = parseDue(due);
  if (!d) return null;
  return Math.round((startOfToday(d).getTime() - startOfToday(now).getTime()) / MS_PER_DAY);
}

/**
 * Classify a task into a scheduling bucket for the sidebar smart-sections.
 * `done` tasks are reported as 'done' and never count as overdue/today/upcoming.
 * Returns one of: 'done' | 'overdue' | 'today' | 'upcoming' | 'none'.
 */
export function classifyTask(task, now = new Date()) {
  if (!task) return 'none';
  if (task.done) return 'done';
  if (hasDueTime(task.due)) {
    const dueAt = parseDue(task.due);
    if (!dueAt) return 'none';
    if (dueAt.getTime() <= now.getTime()) return 'overdue';
    const dueDay = startOfToday(dueAt).getTime();
    const today = startOfToday(now).getTime();
    if (dueDay === today) return 'today';
    return 'upcoming';
  }
  const delta = daysFromToday(task.due, now);
  if (delta === null) return 'none';
  if (delta < 0) return 'overdue';
  if (delta === 0) return 'today';
  return 'upcoming';
}

function formatTime(due) {
  const d = parseDue(due);
  if (!d || !hasDueTime(due)) return '';
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** Short, human label for a due date: "Today", "Tomorrow", "Yesterday", "Mon", "Jun 24", with optional time. */
export function formatDueShort(due, now = new Date()) {
  const d = parseDue(due);
  if (!d) return '';
  const delta = daysFromToday(due, now);
  let label = '';
  if (delta === 0) label = 'Today';
  else if (delta === 1) label = 'Tomorrow';
  else if (delta === -1) label = 'Yesterday';
  else if (delta > 1 && delta < 7) {
    label = d.toLocaleDateString(undefined, { weekday: 'short' });
  } else {
    const sameYear = d.getFullYear() === now.getFullYear();
    label = d.toLocaleDateString(
      undefined,
      sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' }
    );
  }
  const time = formatTime(due);
  return time ? `${label}, ${time}` : label;
}

/** Tone for the due chip, used to pick chip colour. */
export function dueTone(task, now = new Date()) {
  const bucket = classifyTask(task, now);
  if (bucket === 'overdue') return 'overdue';
  if (bucket === 'today') return 'today';
  return 'upcoming';
}

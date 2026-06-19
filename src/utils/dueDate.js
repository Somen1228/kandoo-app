/**
 * Due-date helpers for Kandoo tasks.
 *
 * A task's `due` is stored as an ISO date string ("YYYY-MM-DD") or null/undefined.
 * Dates are intentionally day-granular (no time-of-day) to match the calm,
 * planner-style UX and to keep the JSON workspace small and diff-friendly.
 *
 * All functions are pure and tolerate missing/legacy tasks that have no `due`.
 */

const MS_PER_DAY = 86_400_000;

/** Local midnight for a given Date (defaults to now). */
export function startOfToday(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Parse a stored "YYYY-MM-DD" into a local Date at midnight, or null. */
export function parseDue(due) {
  if (!due || typeof due !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(due);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Serialise a Date (or "YYYY-MM-DD") to the stored "YYYY-MM-DD" form. */
export function toDueString(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : parseDue(value);
  if (!d || Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

/** Whole-day difference from today (negative = past, 0 = today, positive = future). */
export function daysFromToday(due, now = new Date()) {
  const d = parseDue(due);
  if (!d) return null;
  return Math.round((d.getTime() - startOfToday(now).getTime()) / MS_PER_DAY);
}

/**
 * Classify a task into a scheduling bucket for the sidebar smart-sections.
 * `done` tasks are reported as 'done' and never count as overdue/today/upcoming.
 * Returns one of: 'done' | 'overdue' | 'today' | 'upcoming' | 'none'.
 */
export function classifyTask(task, now = new Date()) {
  if (!task) return 'none';
  if (task.done) return 'done';
  const delta = daysFromToday(task.due, now);
  if (delta === null) return 'none';
  if (delta < 0) return 'overdue';
  if (delta === 0) return 'today';
  return 'upcoming';
}

/** Short, human label for a due date: "Today", "Tomorrow", "Yesterday", "Mon", "Jun 24". */
export function formatDueShort(due, now = new Date()) {
  const d = parseDue(due);
  if (!d) return '';
  const delta = daysFromToday(due, now);
  if (delta === 0) return 'Today';
  if (delta === 1) return 'Tomorrow';
  if (delta === -1) return 'Yesterday';
  if (delta > 1 && delta < 7) {
    return d.toLocaleDateString(undefined, { weekday: 'short' });
  }
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString(
    undefined,
    sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' }
  );
}

/** Tone for the due chip, used to pick chip colour. */
export function dueTone(task, now = new Date()) {
  const bucket = classifyTask(task, now);
  if (bucket === 'overdue') return 'overdue';
  if (bucket === 'today') return 'today';
  return 'upcoming';
}

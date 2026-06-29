import { hasDueTime, parseDue, toDueString, startOfToday } from './dueDate';

// A task's `recurrence` is 'daily' | 'weekly' | 'monthly' | null. Completing a
// recurring task advances its due date to the next occurrence instead of moving
// it to Done, so it stays live for next time.
export const RECURRENCES = [
  { id: 'daily',   label: 'Daily' },
  { id: 'weekly',  label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
];

export function recurrenceLabel(id) {
  return RECURRENCES.find((r) => r.id === id)?.label || null;
}

// Next due after the current one (or after today if the task is overdue / undated).
export function advanceDue(dueStr, freq) {
  const parsed = parseDue(dueStr);
  const today = startOfToday();
  const base = parsed && parsed > today ? parsed : today;
  const keepTime = hasDueTime(dueStr);
  const d = new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate(),
    keepTime ? base.getHours() : 0,
    keepTime ? base.getMinutes() : 0
  );
  if (freq === 'daily') d.setDate(d.getDate() + 1);
  else if (freq === 'weekly') d.setDate(d.getDate() + 7);
  else if (freq === 'monthly') d.setMonth(d.getMonth() + 1);
  else return dueStr || toDueString(today);
  return toDueString(d, keepTime);
}

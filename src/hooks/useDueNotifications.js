import { useEffect, useRef } from 'react';
import { classifyTask, hasDueTime, parseDue } from '../utils/dueDate';

// Surfaces tasks that are due today or overdue. Emits a Kandoo in-app reminder
// event instead of using the browser/OS Notification API, so the popup can be
// styled consistently with the app. Each task+due pair is only announced once
// (tracked in localStorage) so reminders don't spam on every check.
const STORAGE_KEY = 'kandoo-notified-due';

const stripHtml = (html) => String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const readSet = () => {
  try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')); } catch { return new Set(); }
};
const writeSet = (set) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...set].slice(-800))); } catch { /* storage full / unavailable */ }
};

const notificationKey = (task) => `${task.id}:${task.due || 'no-due'}`;

const shouldNotifyTask = (task, now = new Date()) => {
  if (!task || task.done || !task.due) return false;
  if (hasDueTime(task.due)) {
    const dueAt = parseDue(task.due);
    return !!dueAt && dueAt.getTime() <= now.getTime();
  }
  const cls = classifyTask(task, now);
  return cls === 'overdue' || cls === 'today';
};

export function useDueNotifications(boards, enabled = true) {
  const boardsRef = useRef(boards);
  useEffect(() => { boardsRef.current = boards; }, [boards]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;

    const check = () => {
      const notified = readSet();
      const due = [];
      const now = new Date();
      (boardsRef.current || []).forEach((b) => (b.cards || []).forEach((c) => {
        if ((c.type || 'todo') === 'note') return;
        Object.values(c.tasks || {}).forEach((t) => {
          if (shouldNotifyTask(t, now)) {
            due.push({
              task: t,
              boardId: b.id,
              boardTitle: b.title || 'Board',
              cardUid: c.uid,
              cardTitle: c.title || 'Card',
              bucket: classifyTask(t, now),
            });
          }
        });
      }));

      const fresh = due.filter(({ task }) => task.id && !notified.has(notificationKey(task)));
      if (!fresh.length) return;

      window.dispatchEvent(new CustomEvent('kandoo:due-reminder', {
        detail: {
          count: fresh.length,
          overdueCount: fresh.filter(({ bucket }) => bucket === 'overdue').length,
          tasks: fresh.slice(0, 5).map(({ task, boardId, boardTitle, cardUid, cardTitle, bucket }) => ({
            id: task.id,
            title: stripHtml(task.value).slice(0, 90) || 'Untitled task',
            due: task.due || null,
            boardId,
            boardTitle,
            cardUid,
            cardTitle,
            bucket,
          })),
        },
      }));

      fresh.forEach(({ task }) => notified.add(notificationKey(task)));
      writeSet(notified);
    };

    const warmup = setTimeout(check, 4000);   // shortly after the workspace loads
    const interval = setInterval(check, 60 * 1000); // timed due dates should fire close to the selected minute
    return () => { clearTimeout(warmup); clearInterval(interval); };
  }, [enabled]);
}

export default useDueNotifications;

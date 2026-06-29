import { useEffect, useRef } from 'react';
import { classifyTask } from '../utils/dueDate';

// Surfaces tasks that are due today or overdue. Fires a desktop notification
// (Web Notifications API) for each task the first time it becomes due, and falls
// back to an in-app reminder (a `kandoo:due-reminder` event) when notifications
// aren't permitted. Each task id is only announced once (tracked in localStorage)
// so reminders don't spam on every check.
const STORAGE_KEY = 'kandoo-notified-due';

const stripHtml = (html) => String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const readSet = () => {
  try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')); } catch { return new Set(); }
};
const writeSet = (set) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...set].slice(-800))); } catch { /* storage full / unavailable */ }
};

export function useDueNotifications(boards, enabled = true) {
  const boardsRef = useRef(boards);
  useEffect(() => { boardsRef.current = boards; }, [boards]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !('Notification' in window)) return undefined;
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    const check = () => {
      const notified = readSet();
      const due = [];
      (boardsRef.current || []).forEach((b) => (b.cards || []).forEach((c) => {
        if ((c.type || 'todo') === 'note') return;
        Object.values(c.tasks || {}).forEach((t) => {
          if (t.done) return;
          const cls = classifyTask(t);
          if (cls === 'overdue' || cls === 'today') due.push(t);
        });
      }));

      const fresh = due.filter((t) => t.id && !notified.has(t.id));
      if (!fresh.length) return;

      if (Notification.permission === 'granted') {
        if (fresh.length === 1) {
          new Notification('Task due', { body: stripHtml(fresh[0].value).slice(0, 90) || 'A task is due', tag: 'kandoo-due' });
        } else {
          new Notification(`${fresh.length} tasks due`, {
            body: fresh.slice(0, 4).map((t) => `• ${stripHtml(t.value).slice(0, 50) || 'Task'}`).join('\n'),
            tag: 'kandoo-due',
          });
        }
      } else {
        window.dispatchEvent(new CustomEvent('kandoo:due-reminder', { detail: { count: fresh.length } }));
      }

      fresh.forEach((t) => notified.add(t.id));
      writeSet(notified);
    };

    const warmup = setTimeout(check, 4000);   // shortly after the workspace loads
    const interval = setInterval(check, 5 * 60 * 1000); // and every 5 minutes after
    return () => { clearTimeout(warmup); clearInterval(interval); };
  }, [enabled]);
}

export default useDueNotifications;

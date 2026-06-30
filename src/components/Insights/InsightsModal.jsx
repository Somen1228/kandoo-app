import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { VscClose, VscGraph, VscPulse, VscWarning } from 'react-icons/vsc';
import { classifyTask, parseDue } from '../../utils/dueDate';
import { htmlToText, isHtml } from '../../utils/htmlEditor';

const DAY_MS = 86_400_000;

function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dayKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function daysAgo(days) {
  const date = startOfDay();
  date.setDate(date.getDate() - days);
  return date;
}

function percent(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function taskText(task) {
  const raw = task?.value || '';
  return (isHtml(raw) ? htmlToText(raw) : String(raw)).replace(/\s+/g, ' ').trim() || 'Untitled task';
}

function collectTasks(boards = []) {
  const rows = [];
  boards.forEach((board) => {
    (board.cards || []).forEach((card) => {
      if ((card.type || 'todo') !== 'todo') return;
      Object.values(card.tasks || {}).forEach((task) => {
        rows.push({
          task,
          board,
          card,
          title: taskText(task),
          bucket: classifyTask(task),
        });
      });
    });
  });
  return rows;
}

function averageCompletionDays(tasks) {
  const durations = tasks
    .filter(({ task }) => task.createdAt && task.completedAt)
    .map(({ task }) => Math.max(0, (task.completedAt - task.createdAt) / DAY_MS));
  if (!durations.length) return null;
  return durations.reduce((sum, value) => sum + value, 0) / durations.length;
}

function computeStudyStats(boards) {
  let sessions = 0;
  let completedSessions = 0;
  let plannedMinutes = 0;
  let habits = 0;
  let bestStreak = 0;

  boards.forEach((board) => {
    const study = board.study || {};
    (study.sessions || []).forEach((session) => {
      sessions += 1;
      if (session.done) completedSessions += 1;
      if (session.date && session.start && session.end) {
        const start = new Date(`${session.date}T${session.start}`);
        const end = new Date(`${session.date}T${session.end}`);
        if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end > start) {
          plannedMinutes += (end - start) / 60000;
        }
      }
    });
    (study.habits || []).forEach((habit) => {
      habits += 1;
      bestStreak = Math.max(bestStreak, calcStreak(habit.days || {}));
    });
  });

  return {
    sessions,
    completedSessions,
    plannedHours: plannedMinutes / 60,
    habits,
    bestStreak,
  };
}

function calcStreak(days = {}) {
  let streak = 0;
  const cursor = startOfDay();
  while (days[dayKey(cursor)]) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function buildDailyCompletions(tasks, length = 14) {
  const days = Array.from({ length }, (_, index) => {
    const date = daysAgo(length - 1 - index);
    return { key: dayKey(date), label: date.toLocaleDateString(undefined, { weekday: 'short' }), count: 0 };
  });
  const byKey = Object.fromEntries(days.map((day) => [day.key, day]));
  tasks.forEach(({ task }) => {
    if (!task.completedAt) return;
    const key = dayKey(task.completedAt);
    if (byKey[key]) byKey[key].count += 1;
  });
  return days;
}

function topCounts(items, keyFn, limit = 6) {
  const counts = new Map();
  items.forEach((item) => {
    const key = keyFn(item);
    if (!key) return;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

function InsightStat({ label, value, hint, tone }) {
  return (
    <div className="insight-stat" data-tone={tone || undefined}>
      <span>{label}</span>
      <strong>{value}</strong>
      {hint && <small>{hint}</small>}
    </div>
  );
}

function MiniBars({ data }) {
  const max = Math.max(1, ...data.map((item) => item.count));
  return (
    <div className="insight-bars">
      {data.map((item) => (
        <div key={item.key || item.label} className="insight-bars__item" title={`${item.label}: ${item.count}`}>
          <div className="insight-bars__bar" style={{ height: `${Math.max(8, (item.count / max) * 100)}%` }} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function CountList({ items, empty = 'No data yet' }) {
  const max = Math.max(1, ...items.map((item) => item.count));
  if (!items.length) return <div className="insight-empty">{empty}</div>;
  return (
    <div className="insight-count-list">
      {items.map((item) => (
        <div key={item.label} className="insight-count-row">
          <span>{item.label}</span>
          <strong>{item.count}</strong>
          <div><i style={{ width: `${(item.count / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

export default function InsightsModal({ boards, activeBoardId, onClose }) {
  const [scope, setScope] = useState('active');
  const modalRef = useRef(null);

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose?.(); };
    const onMouse = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) onClose?.();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onMouse);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onMouse);
    };
  }, [onClose]);

  const activeBoard = useMemo(
    () => boards.find((board) => board.id === activeBoardId) || boards[0],
    [boards, activeBoardId]
  );
  const scopedBoards = useMemo(
    () => (scope === 'workspace' ? boards : activeBoard ? [activeBoard] : []),
    [scope, boards, activeBoard]
  );

  const insights = useMemo(() => {
    const tasks = collectTasks(scopedBoards);
    const total = tasks.length;
    const done = tasks.filter(({ task }) => task.done || task.completedAt).length;
    const open = total - done;
    const overdue = tasks.filter(({ bucket }) => bucket === 'overdue').length;
    const today = tasks.filter(({ bucket }) => bucket === 'today').length;
    const upcoming = tasks.filter(({ bucket }) => bucket === 'upcoming').length;
    const withDue = tasks.filter(({ task }) => task.due).length;
    const completedTasks = tasks.filter(({ task }) => task.completedAt);
    const onTime = completedTasks.filter(({ task }) => task.completionTiming === 'on-time' || task.completionTiming === 'early').length;
    const sevenDays = daysAgo(6).getTime();
    const previousStart = daysAgo(13).getTime();
    const thisWeekDone = completedTasks.filter(({ task }) => task.completedAt >= sevenDays).length;
    const lastWeekDone = completedTasks.filter(({ task }) => task.completedAt >= previousStart && task.completedAt < sevenDays).length;
    const stale = tasks
      .filter(({ task }) => !task.done && task.createdAt && task.createdAt < daysAgo(7).getTime())
      .sort((a, b) => (a.task.createdAt || 0) - (b.task.createdAt || 0))
      .slice(0, 6);
    const overdueTasks = tasks
      .filter(({ bucket }) => bucket === 'overdue')
      .sort((a, b) => (parseDue(a.task.due)?.getTime() || 0) - (parseDue(b.task.due)?.getTime() || 0))
      .slice(0, 6);

    return {
      tasks,
      total,
      done,
      open,
      overdue,
      today,
      upcoming,
      withDue,
      completionRate: percent(done, total),
      dueCoverage: percent(withDue, total),
      onTimeRate: percent(onTime, completedTasks.length),
      thisWeekDone,
      lastWeekDone,
      velocityDelta: thisWeekDone - lastWeekDone,
      avgCompletionDays: averageCompletionDays(completedTasks),
      daily: buildDailyCompletions(tasks),
      cardLoad: topCounts(tasks.filter(({ task }) => !task.done), ({ card }) => card.title || 'Untitled card'),
      boardLoad: topCounts(tasks.filter(({ task }) => !task.done), ({ board }) => board.title || 'Untitled board'),
      stale,
      overdueTasks,
      study: computeStudyStats(scopedBoards),
    };
  }, [scopedBoards]);

  const labelCounts = topCounts(
    insights.tasks.flatMap(({ task }) => task.labels || []),
    (label) => label.name,
    6
  );

  return createPortal(
    <div className="settings-overlay insights-overlay" role="presentation">
      <section ref={modalRef} className="insights-modal" role="dialog" aria-modal="true" aria-label="Kandoo insights">
        <header className="insights-head">
          <div>
            <span><VscGraph /> Kandoo Insights</span>
            <h2>{scope === 'workspace' ? 'Workspace analytics' : activeBoard?.title || 'Board analytics'}</h2>
            <p>Read-only activity, delivery, focus, and study signals from your existing boards.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close insights"><VscClose /></button>
        </header>

        <div className="insights-controls">
          <button type="button" className={scope === 'active' ? 'is-active' : ''} onClick={() => setScope('active')}>
            Current board
          </button>
          <button type="button" className={scope === 'workspace' ? 'is-active' : ''} onClick={() => setScope('workspace')}>
            Workspace
          </button>
        </div>

        <div className="insights-body">
          <section className="insight-stat-grid">
            <InsightStat label="Completion rate" value={`${insights.completionRate}%`} hint={`${insights.done}/${insights.total} done`} tone="good" />
            <InsightStat label="Open work" value={insights.open} hint={`${insights.overdue} overdue · ${insights.today} today`} tone={insights.overdue ? 'risk' : undefined} />
            <InsightStat label="7-day velocity" value={insights.thisWeekDone} hint={`${insights.velocityDelta >= 0 ? '+' : ''}${insights.velocityDelta} vs previous 7d`} />
            <InsightStat label="On-time delivery" value={`${insights.onTimeRate}%`} hint="early + on-time completions" tone={insights.onTimeRate >= 70 ? 'good' : undefined} />
            <InsightStat label="Due coverage" value={`${insights.dueCoverage}%`} hint={`${insights.withDue} tasks scheduled`} />
            <InsightStat label="Avg completion" value={insights.avgCompletionDays == null ? '—' : `${insights.avgCompletionDays.toFixed(1)}d`} hint="created → completed" />
            <InsightStat label="Study hours planned" value={insights.study.plannedHours ? insights.study.plannedHours.toFixed(1) : '0'} hint={`${insights.study.completedSessions}/${insights.study.sessions} sessions done`} />
            <InsightStat label="Best habit streak" value={insights.study.bestStreak} hint={`${insights.study.habits} tracked habits`} />
          </section>

          <section className="insight-card insight-card--wide">
            <div className="insight-card__head">
              <h3><VscPulse /> Completion rhythm</h3>
              <span>Last 14 days</span>
            </div>
            <MiniBars data={insights.daily} />
          </section>

          <section className="insight-grid">
            <div className="insight-card">
              <div className="insight-card__head">
                <h3>Current load</h3>
                <span>{scope === 'workspace' ? 'By board' : 'By card'}</span>
              </div>
              <CountList items={scope === 'workspace' ? insights.boardLoad : insights.cardLoad} />
            </div>

            <div className="insight-card">
              <div className="insight-card__head">
                <h3>Label distribution</h3>
                <span>All tasks</span>
              </div>
              <CountList items={labelCounts} empty="No labels used yet" />
            </div>
          </section>

          <section className="insight-grid">
            <div className="insight-card">
              <div className="insight-card__head">
                <h3><VscWarning /> At risk</h3>
                <span>Old open tasks</span>
              </div>
              <div className="insight-task-list">
                {insights.stale.length ? insights.stale.map(({ task, title, board, card }) => (
                  <div key={`${board.id}-${card.uid}-${task.id}`}>
                    <strong>{title}</strong>
                    <span>{board.title} · {card.title} · {Math.max(1, Math.floor((Date.now() - task.createdAt) / DAY_MS))}d old</span>
                  </div>
                )) : <div className="insight-empty">No stale open tasks.</div>}
              </div>
            </div>

            <div className="insight-card">
              <div className="insight-card__head">
                <h3>Overdue pressure</h3>
                <span>{insights.overdue} overdue</span>
              </div>
              <div className="insight-task-list">
                {insights.overdueTasks.length ? insights.overdueTasks.map(({ task, title, board, card }) => (
                  <div key={`${board.id}-${card.uid}-${task.id}`}>
                    <strong>{title}</strong>
                    <span>{board.title} · {card.title}</span>
                  </div>
                )) : <div className="insight-empty">No overdue tasks.</div>}
              </div>
            </div>
          </section>
        </div>
      </section>
    </div>,
    document.body
  );
}

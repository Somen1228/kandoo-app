import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { VscAdd, VscCalendar, VscCheck, VscClose, VscTrash } from 'react-icons/vsc';
import { toast } from '../../utils/toast';

const SUBJECTS = [
  'Physics', 'Chemistry', 'Biology', 'Mathematics', 'Statistics', 'Computer Science',
  'Psychology', 'Economics', 'Political Science', 'History', 'Philosophy', 'Literature',
  'Engineering', 'Medicine', 'Business', 'Law', 'Design', 'Music', 'Languages',
];

const todayKey = () => new Date().toISOString().slice(0, 10);

const emptyStudy = {
  course: { subject: '', courseCode: '', instructor: '', term: '' },
  sessions: [],
  habits: [],
};

function normalizeStudy(study) {
  return {
    ...emptyStudy,
    ...(study || {}),
    course: { ...emptyStudy.course, ...(study?.course || {}) },
    sessions: Array.isArray(study?.sessions) ? study.sessions : [],
    habits: Array.isArray(study?.habits) ? study.habits : [],
  };
}

function calcStreak(days = {}, from = todayKey()) {
  let streak = 0;
  const cursor = new Date(`${from}T00:00:00`);
  while (days[cursor.toISOString().slice(0, 10)]) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function upcomingSessions(sessions) {
  const now = new Date();
  return [...sessions]
    .filter((s) => !s.done && s.date)
    .sort((a, b) => `${a.date}T${a.start || '00:00'}`.localeCompare(`${b.date}T${b.start || '00:00'}`))
    .filter((s) => new Date(`${s.date}T${s.end || s.start || '23:59'}`) >= now);
}

export default function StudyPanel({ board, onClose, onChange }) {
  const [tab, setTab] = useState('course');
  const study = useMemo(() => normalizeStudy(board?.study), [board?.study]);
  const [courseDraft, setCourseDraft] = useState(study.course);
  const [sessionDraft, setSessionDraft] = useState({
    title: '',
    date: todayKey(),
    start: '',
    end: '',
    focus: '',
  });
  const [habitDraft, setHabitDraft] = useState('');

  useEffect(() => {
    setCourseDraft(study.course);
  }, [study.course]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!board) return null;

  const updateStudy = (recipe) => {
    onChange(recipe(normalizeStudy(board.study)));
  };

  const saveCourse = () => {
    updateStudy((current) => ({ ...current, course: { ...courseDraft } }));
    toast.success('Course details saved');
  };

  const addSession = () => {
    const title = sessionDraft.title.trim() || 'Study session';
    if (!sessionDraft.date) {
      toast.warning('Pick a date for the study session');
      return;
    }
    updateStudy((current) => ({
      ...current,
      sessions: [
        ...current.sessions,
        {
          id: crypto.randomUUID(),
          ...sessionDraft,
          title,
          focus: sessionDraft.focus.trim(),
          done: false,
          createdAt: Date.now(),
        },
      ],
    }));
    setSessionDraft({ title: '', date: todayKey(), start: '', end: '', focus: '' });
    toast.success('Study session added');
  };

  const toggleSession = (id) => updateStudy((current) => ({
    ...current,
    sessions: current.sessions.map((session) =>
      session.id === id ? { ...session, done: !session.done, completedAt: session.done ? null : Date.now() } : session
    ),
  }));

  const deleteSession = (id) => updateStudy((current) => ({
    ...current,
    sessions: current.sessions.filter((session) => session.id !== id),
  }));

  const addHabit = () => {
    const name = habitDraft.trim();
    if (!name) return;
    updateStudy((current) => ({
      ...current,
      habits: [
        ...current.habits,
        { id: crypto.randomUUID(), name, days: {}, createdAt: Date.now() },
      ],
    }));
    setHabitDraft('');
  };

  const toggleHabitToday = (id) => {
    const day = todayKey();
    updateStudy((current) => ({
      ...current,
      habits: current.habits.map((habit) => {
        if (habit.id !== id) return habit;
        const days = { ...(habit.days || {}) };
        if (days[day]) delete days[day];
        else days[day] = Date.now();
        return { ...habit, days };
      }),
    }));
  };

  const deleteHabit = (id) => updateStudy((current) => ({
    ...current,
    habits: current.habits.filter((habit) => habit.id !== id),
  }));

  const sessions = upcomingSessions(study.sessions);
  const completedSessions = study.sessions.filter((session) => session.done).length;

  return createPortal(
    <div className="settings-overlay study-overlay" onMouseDown={onClose}>
      <section className="study-panel" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Study tools">
        <header className="study-panel__header">
          <div>
            <p className="study-panel__eyebrow">Student workspace</p>
            <h2>{board.title}</h2>
          </div>
          <button className="study-panel__close" type="button" onClick={onClose} aria-label="Close study tools">
            <VscClose />
          </button>
        </header>

        <div className="study-tabs" role="tablist" aria-label="Study tools">
          {[
            ['course', 'Course'],
            ['sessions', 'Planner'],
            ['habits', 'Habits'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={tab === id ? 'is-active' : ''}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'course' && (
          <div className="study-section">
            <div className="study-grid">
              <label>
                Subject
                <input
                  list="study-subjects"
                  value={courseDraft.subject}
                  onChange={(event) => setCourseDraft((current) => ({ ...current, subject: event.target.value }))}
                  placeholder="Computer Science"
                />
              </label>
              <datalist id="study-subjects">
                {SUBJECTS.map((subject) => <option key={subject} value={subject} />)}
              </datalist>
              <label>
                Course code
                <input
                  value={courseDraft.courseCode}
                  onChange={(event) => setCourseDraft((current) => ({ ...current, courseCode: event.target.value }))}
                  placeholder="CS-201"
                />
              </label>
              <label>
                Instructor
                <input
                  value={courseDraft.instructor}
                  onChange={(event) => setCourseDraft((current) => ({ ...current, instructor: event.target.value }))}
                  placeholder="Dr. Sharma"
                />
              </label>
              <label>
                Term
                <input
                  value={courseDraft.term}
                  onChange={(event) => setCourseDraft((current) => ({ ...current, term: event.target.value }))}
                  placeholder="Fall 2026"
                />
              </label>
            </div>
            <button type="button" className="mac-btn-primary" onClick={saveCourse}>Save course tag</button>
          </div>
        )}

        {tab === 'sessions' && (
          <div className="study-section">
            <div className="study-summary">
              <span><strong>{sessions.length}</strong> upcoming</span>
              <span><strong>{completedSessions}</strong> completed</span>
            </div>
            <div className="study-session-form">
              <input value={sessionDraft.title} onChange={(e) => setSessionDraft((c) => ({ ...c, title: e.target.value }))} placeholder="Topic or chapter" />
              <input type="date" value={sessionDraft.date} onChange={(e) => setSessionDraft((c) => ({ ...c, date: e.target.value }))} />
              <input type="time" value={sessionDraft.start} onChange={(e) => setSessionDraft((c) => ({ ...c, start: e.target.value }))} aria-label="Start time" />
              <input type="time" value={sessionDraft.end} onChange={(e) => setSessionDraft((c) => ({ ...c, end: e.target.value }))} aria-label="End time" />
              <input value={sessionDraft.focus} onChange={(e) => setSessionDraft((c) => ({ ...c, focus: e.target.value }))} placeholder="Goal: revise notes, solve 20 problems…" />
              <button type="button" onClick={addSession}><VscAdd /> Add block</button>
            </div>
            <div className="study-list">
              {study.sessions.length ? [...study.sessions].sort((a, b) => `${a.date}T${a.start || ''}`.localeCompare(`${b.date}T${b.start || ''}`)).map((session) => (
                <article key={session.id} className={`study-card${session.done ? ' is-done' : ''}`}>
                  <div className="study-card__main">
                    <strong>{session.title}</strong>
                    <span><VscCalendar /> {session.date}{session.start ? ` · ${session.start}${session.end ? `-${session.end}` : ''}` : ''}</span>
                    {session.focus && <p>{session.focus}</p>}
                  </div>
                  <div className="study-card__actions">
                    <button type="button" onClick={() => toggleSession(session.id)} title={session.done ? 'Mark open' : 'Mark complete'}><VscCheck /></button>
                    <button type="button" onClick={() => deleteSession(session.id)} title="Delete session"><VscTrash /></button>
                  </div>
                </article>
              )) : <div className="study-empty">No study blocks yet. Add your first focused session.</div>}
            </div>
          </div>
        )}

        {tab === 'habits' && (
          <div className="study-section">
            <div className="study-habit-form">
              <input value={habitDraft} onChange={(e) => setHabitDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addHabit(); }} placeholder="Daily review, flashcards, practice problems…" />
              <button type="button" onClick={addHabit}><VscAdd /> Add habit</button>
            </div>
            <div className="study-list">
              {study.habits.length ? study.habits.map((habit) => {
                const doneToday = Boolean(habit.days?.[todayKey()]);
                const streak = calcStreak(habit.days);
                return (
                  <article key={habit.id} className={`study-card study-habit${doneToday ? ' is-done' : ''}`}>
                    <button type="button" className="study-habit__check" onClick={() => toggleHabitToday(habit.id)} aria-label={`Toggle ${habit.name} today`}>
                      {doneToday && <VscCheck />}
                    </button>
                    <div className="study-card__main">
                      <strong>{habit.name}</strong>
                      <span>{streak} day streak · {Object.keys(habit.days || {}).length} total check-ins</span>
                    </div>
                    <button type="button" className="study-card__delete" onClick={() => deleteHabit(habit.id)} title="Delete habit"><VscTrash /></button>
                  </article>
                );
              }) : <div className="study-empty">No habits yet. Track repeatable study behaviours here.</div>}
            </div>
          </div>
        )}
      </section>
    </div>,
    document.body
  );
}

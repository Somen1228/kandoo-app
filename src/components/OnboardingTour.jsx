import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

const TOUR_KEY = 'kandoo-tour-done';

const STEPS = [
  {
    title: 'Welcome to Kandoo 👋',
    body: 'Your all-in-one workspace for tasks, notes, and projects. Let\'s take a 30-second tour.',
    target: null,
  },
  {
    title: 'Boards & columns',
    body: 'Each board has columns (To-do, In-Progress, Done). Drag tasks between columns, or create your own.',
    target: '.mac-sidebar',
  },
  {
    title: 'Add tasks fast',
    body: 'Click "+ Add task" inside any column, or press N to open a quick-add card.',
    target: '.mac-main',
  },
  {
    title: 'Notes section',
    body: 'Switch to Notes (the notebook icon in the sidebar) for long-form writing with full rich-text editing, headings, and sub-pages.',
    target: null,
  },
  {
    title: 'Sync across devices',
    body: 'Sign in with Google or email to automatically back up and sync your workspace. Open Settings → Account & Sync to manage it.',
    target: null,
  },
];

function Spotlight({ targetSelector }) {
  const [rect, setRect] = useState(null);

  useEffect(() => {
    if (!targetSelector) { setRect(null); return; }
    const el = document.querySelector(targetSelector);
    if (!el) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top - 6, left: r.left - 6, width: r.width + 12, height: r.height + 12 });
  }, [targetSelector]);

  if (!rect) return null;

  return (
    <div style={{
      position: 'fixed',
      top: rect.top, left: rect.left,
      width: rect.width, height: rect.height,
      borderRadius: 10,
      boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
      border: '2px solid var(--accent)',
      pointerEvents: 'none',
      zIndex: 9998,
      transition: 'all 0.25s ease',
    }} />
  );
}

export default function OnboardingTour() {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(() => localStorage.getItem(TOUR_KEY) === '1');

  if (done) return null;

  const current = STEPS[step];
  const isLast  = step === STEPS.length - 1;

  const finish = () => {
    localStorage.setItem(TOUR_KEY, '1');
    setDone(true);
  };

  return createPortal(
    <>
      {/* Dim overlay (only when no spotlight target) */}
      {!current.target && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          zIndex: 9998,
        }} onClick={finish} />
      )}
      <Spotlight targetSelector={current.target} />

      {/* Card */}
      <div style={{
        position: 'fixed',
        bottom: 32, left: '50%', transform: 'translateX(-50%)',
        width: 'min(400px, calc(100vw - 32px))',
        background: 'var(--theme-bg-modal)',
        border: '1px solid var(--theme-border)',
        borderRadius: 16,
        padding: '22px 24px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        zIndex: 9999,
      }}>
        {/* Step dots */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width: i === step ? 18 : 6, height: 6, borderRadius: 3,
              background: i === step ? 'var(--accent)' : 'var(--theme-border)',
              transition: 'all 0.2s',
            }} />
          ))}
        </div>

        <h3 style={{ margin: '0 0 8px', fontSize: '1rem', fontWeight: 700, color: 'var(--theme-text-primary)' }}>
          {current.title}
        </h3>
        <p style={{ margin: '0 0 20px', fontSize: '0.84rem', color: 'var(--theme-text-secondary)', lineHeight: 1.55 }}>
          {current.body}
        </p>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={finish}
            style={{ border: 'none', background: 'none', color: 'var(--theme-text-muted)', fontSize: '0.78rem', cursor: 'pointer', padding: 0 }}>
            Skip tour
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)}
                style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--theme-border)', background: 'transparent', color: 'var(--theme-text-primary)', cursor: 'pointer', fontSize: '0.82rem' }}>
                Back
              </button>
            )}
            <button onClick={isLast ? finish : () => setStep(s => s + 1)}
              style={{ padding: '7px 18px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'white', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
              {isLast ? 'Get started' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

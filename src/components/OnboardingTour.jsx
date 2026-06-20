import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import kandooSmiling from '../assets/kandoo-smiling.png';

const TOUR_AUTO_KEY = 'kandoo-tour-auto';
const A = 'var(--accent, #6c63ff)';

// ── Step illustrations ────────────────────────────────────────────────────────

function MascotIcon() {
  return (
    <div style={{ position: 'relative', width: 72, height: 72 }}>
      <motion.div
        animate={{ scale: [1, 1.22, 1], opacity: [0.22, 0.5, 0.22] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
        style={{ position: 'absolute', inset: 10, borderRadius: '50%', background: A, filter: 'blur(18px)', zIndex: 0 }}
      />
      <motion.img
        src={kandooSmiling} alt=""
        animate={{ y: [0, -7, 0] }}
        transition={{ duration: 2.3, repeat: Infinity, ease: 'easeInOut' }}
        style={{ position: 'relative', zIndex: 1, width: 72, height: 72, objectFit: 'contain' }}
      />
    </div>
  );
}

function BoardsIcon() {
  const cols = [
    { x: 2,  cards: [{ y: 14 }, { y: 25 }, { y: 36 }] },
    { x: 22, cards: [{ y: 14 }, { y: 25 }] },
    { x: 42, cards: [{ y: 14 }] },
  ];
  return (
    <svg width="60" height="52" viewBox="0 0 60 52" fill="none">
      {cols.map(({ x, cards }, i) => (
        <g key={i}>
          <motion.rect x={x} y={3} width={16} height={7} rx={3}
            fill={A}
            initial={{ scaleY: 0, opacity: 0 }}
            animate={{ scaleY: 1, opacity: 1 }}
            transition={{ delay: i * 0.1, duration: 0.28, ease: [0.34, 1.2, 0.64, 1] }}
            style={{ transformOrigin: `${x + 8}px 6.5px` }}
          />
          {cards.map(({ y }, j) => (
            <motion.rect key={j} x={x} y={y} width={16} height={8} rx={2}
              fill={A} fillOpacity={0.22 - j * 0.04}
              stroke={A} strokeOpacity={0.4} strokeWidth={1}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.26 + i * 0.08 + j * 0.07, duration: 0.3, ease: 'easeOut' }}
            />
          ))}
        </g>
      ))}
    </svg>
  );
}

function DragDropIcon() {
  // 3 kanban columns — a task lifts and moves from col 0 → col 1, loops
  const CW = 76; // column width
  const G  = 8;  // gap between columns
  const HP = 4;  // horizontal padding inside column
  const TW = CW - HP * 2; // task width = 68
  const TH = 11; // task height
  const C  = [0, CW + G, (CW + G) * 2]; // column x offsets: 0, 84, 168
  const TOTAL_W = C[2] + CW; // 244

  // Drag animation: task at col0/y=33 lifts → slides right → drops in col1
  const dragX = [0, 0, C[1], C[1], 0];
  const dragY = [0, -10, -10, 0, 0];
  const dragT = { duration: 2.4, repeat: Infinity, repeatDelay: 1.0, times: [0, 0.18, 0.55, 0.75, 1], ease: 'easeInOut' };

  return (
    <svg width={TOTAL_W} height="84" viewBox={`0 0 ${TOTAL_W} 84`} fill="none">
      {/* Column backgrounds */}
      {C.map((x, i) => (
        <g key={i}>
          <motion.rect x={x} y={0} width={CW} height={84} rx={6}
            fill={A} fillOpacity={0.07}
            stroke={A} strokeWidth={1}
            animate={i === 1
              ? { strokeOpacity: [0.18, 0.55, 0.18] }
              : { strokeOpacity: 0.18 }}
            transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1.0, delay: 0.6 }}
          />
          {/* header */}
          <rect x={x + HP} y={4} width={TW} height={10} rx={3} fill={A} fillOpacity={0.65} />
        </g>
      ))}

      {/* Col 0 — static tasks (gap where dragged task was shown as dashed) */}
      <rect x={C[0]+HP} y={18} width={TW} height={TH} rx={2} fill={A} fillOpacity={0.28} />
      <motion.rect x={C[0]+HP} y={32} width={TW} height={TH} rx={2}
        fill="none" stroke={A} strokeDasharray="3,2"
        animate={{ strokeOpacity: [0.5, 0.15, 0.5] }}
        transition={{ duration: 1.3, repeat: Infinity }}
      />
      <rect x={C[0]+HP} y={46} width={TW} height={TH} rx={2} fill={A} fillOpacity={0.17} />
      <rect x={C[0]+HP} y={60} width={TW} height={TH} rx={2} fill={A} fillOpacity={0.11} />

      {/* Col 1 — static tasks + pulsing drop zone */}
      <rect x={C[1]+HP} y={18} width={TW} height={TH} rx={2} fill={A} fillOpacity={0.24} />
      <rect x={C[1]+HP} y={32} width={TW} height={TH} rx={2} fill={A} fillOpacity={0.16} />
      <motion.rect x={C[1]+HP} y={46} width={TW} height={TH} rx={2}
        fill={A} fillOpacity={0}
        animate={{ fillOpacity: [0, 0.18, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1.0, delay: 0.9 }}
      />

      {/* Col 2 — static tasks */}
      <rect x={C[2]+HP} y={18} width={TW} height={TH} rx={2} fill={A} fillOpacity={0.2} />
      <rect x={C[2]+HP} y={32} width={TW} height={TH} rx={2} fill={A} fillOpacity={0.13} />

      {/* Shadow rect — appears under dragged task while airborne */}
      <motion.rect
        x={C[0]+HP+2} y={36} width={TW-2} height={TH} rx={2}
        fill="rgba(0,0,0,0.0)"
        animate={{ x: dragX, y: dragY, fill: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.14)', 'rgba(0,0,0,0.14)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)'] }}
        transition={dragT}
      />

      {/* Dragged task card */}
      <motion.g animate={{ x: dragX, y: dragY }} transition={dragT}>
        <rect x={C[0]+HP} y={32} width={TW} height={TH} rx={2} fill={A} fillOpacity={0.88} />
        <rect x={C[0]+HP+4} y={35} width={28} height={3} rx={1.5} fill="white" fillOpacity={0.85} />
        <rect x={C[0]+HP+4} y={39} width={18} height={2} rx={1} fill="white" fillOpacity={0.5} />
      </motion.g>
    </svg>
  );
}

function NotesIcon() {
  const lines = [{ y: 17, w: 22 }, { y: 25, w: 17 }, { y: 33, w: 22 }, { y: 41, w: 11 }];
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
      <motion.rect x={10} y={5} width={36} height={46} rx={5}
        fill={A} fillOpacity={0.1} stroke={A} strokeOpacity={0.35} strokeWidth={1.5}
        initial={{ opacity: 0, scale: 0.82 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.34, 1.2, 0.64, 1] }}
        style={{ transformOrigin: '28px 28px' }}
      />
      {lines.map(({ y, w }, i) => (
        <motion.path key={i} d={`M16,${y} L${16 + w},${y}`}
          stroke={A} strokeWidth={2} strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }}
          transition={{ delay: 0.28 + i * 0.13, duration: 0.3 }}
        />
      ))}
      <motion.rect x={29} y={37} width={2} height={9} rx={1} fill={A}
        animate={{ opacity: [1, 0, 1] }}
        transition={{ delay: 0.85, duration: 1, repeat: Infinity }}
      />
    </svg>
  );
}

function SlashIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
      <motion.rect x={3} y={3} width={22} height={22} rx={7}
        fill={A} fillOpacity={0.14} stroke={A} strokeOpacity={0.5} strokeWidth={1.5}
        initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.32, ease: [0.34, 1.2, 0.64, 1] }}
        style={{ transformOrigin: '14px 14px' }}
      />
      <motion.path d="M17 7 L11 21" stroke={A} strokeWidth={2.5} strokeLinecap="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
        transition={{ delay: 0.2, duration: 0.3 }}
      />
      {[{ y: 16, w: 20 }, { y: 26, w: 15 }, { y: 36, w: 18 }].map(({ y, w }, i) => (
        <motion.rect key={i} x={30} y={y} width={w} height={5} rx={2.5}
          fill={A} fillOpacity={i === 0 ? 0.9 : 0.35}
          initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.35 + i * 0.1, duration: 0.28, ease: 'easeOut' }}
        />
      ))}
      <motion.rect x={30} y={13} width={20} height={11} rx={3}
        fill={A} fillOpacity={0.12} stroke={A} strokeOpacity={0.4} strokeWidth={1}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.2 }}
      />
    </svg>
  );
}

function SyncIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
      <circle cx={28} cy={28} r={21} stroke={A} strokeOpacity={0.12} strokeWidth={1.5} fill="none" />
      <motion.path d="M28 7 A21 21 0 0 1 49 28" stroke={A} strokeWidth={2.5} strokeLinecap="round" fill="none"
        animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
        style={{ transformOrigin: '28px 28px' }}
      />
      <motion.path d="M28 49 A21 21 0 0 1 7 28" stroke={A} strokeWidth={2.5} strokeLinecap="round" fill="none" strokeOpacity={0.45}
        animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
        style={{ transformOrigin: '28px 28px' }}
      />
      <motion.path
        d="M19 33 Q19 27 25 27 Q26 22 31 22 Q38 22 38 28 Q41 28 41 32 Q41 36 37 36 L21 36 Q17 36 17 32 Q17 29 19 29"
        fill={A} fillOpacity={0.22} stroke={A} strokeWidth={1.2} strokeLinejoin="round"
        initial={{ opacity: 0, scale: 0.75 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.25, duration: 0.4, ease: [0.34, 1.2, 0.64, 1] }}
        style={{ transformOrigin: '29px 29px' }}
      />
    </svg>
  );
}

const STEP_ICONS = [MascotIcon, BoardsIcon, DragDropIcon, NotesIcon, SlashIcon, SyncIcon];

// ── Step definitions ──────────────────────────────────────────────────────────
const makeSteps = () => [
  { id: 'welcome', title: 'Welcome to Kandoo!',            body: 'Your all-in-one workspace for tasks, notes, and projects. This 30-second tour will show you around.',                                                           target: null,                              cardSide: 'center' },
  { id: 'boards',  title: 'Your projects live here',       body: 'Create multiple boards — one per project, course, or goal. Switch between them instantly from the sidebar.',                                                     target: '.mac-sidebar__section',           cardSide: 'right',  onEnter: ({ setSection }) => setSection('todos') },
  { id: 'tasks',   title: 'Drag, drop, and get things done', body: 'Add tasks to any column, drag them across stages, set due dates, add labels, and attach images.',                                                              target: '[data-tour="board"]',             cardSide: 'bottom', onEnter: ({ setSection }) => setSection('todos') },
  { id: 'notes',   title: 'A full notes editor — try it!', body: 'Write long-form notes with headings, lists, code blocks, tables, and more. Type / anywhere to open the block menu.',                                            target: '.mac-sidebar__section:last-of-type', cardSide: 'right', onEnter: ({ setSection }) => setSection('notes') },
  { id: 'slash',   title: 'Slash commands in the editor',  body: 'Inside any note, type / to insert headings, bullet lists, code blocks, tables, and images — just like Notion.',                                                 target: '.note-editor',                    cardSide: 'bottom' },
  { id: 'sync',    title: 'Sync across all your devices',  body: 'Sign in with Google or email to automatically back up and sync your workspace. Your work is always safe.',                                                       target: '.mac-accountbtn',                 cardSide: 'bottom', onEnter: ({ setSection }) => setSection('todos') },
];

// ── Spotlight ─────────────────────────────────────────────────────────────────
function Spotlight({ rect }) {
  const PAD = 8;
  const left   = Math.max(0, rect.left   - PAD);
  const top    = Math.max(0, rect.top    - PAD);
  const right  = Math.min(window.innerWidth,  rect.right  + PAD);
  const bottom = Math.min(window.innerHeight, rect.bottom + PAD);
  return (
    <motion.div
      key={`${top}-${left}`}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      transition={{ duration: 0.22 }}
      style={{
        position: 'fixed',
        top, left,
        width: right - left, height: bottom - top,
        borderRadius: 12,
        boxShadow: '0 0 0 9999px rgba(0,0,0,0.60)',
        border: `2px solid color-mix(in srgb, ${A} 80%, white)`,
        pointerEvents: 'none',
        zIndex: 9997,
      }}
    />
  );
}

// ── Tour card ─────────────────────────────────────────────────────────────────
function TourCard({ step, stepIndex, total, onNext, onBack, onSkip, targetRect, noAutoShow, onToggleAutoShow }) {
  const cardRef  = useRef(null);
  const IconComp = STEP_ICONS[stepIndex];

  const [pos, setPos] = useState(() => ({
    position: 'fixed',
    top:  Math.round((window.innerHeight - 320) / 2),
    left: Math.round((window.innerWidth  - 340) / 2),
  }));

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const W = card.offsetWidth  || 340;
    const H = card.offsetHeight || 320;
    const M = 20;
    const VP_W = window.innerWidth;
    const VP_H = window.innerHeight;

    if (!targetRect || step.cardSide === 'center') {
      setPos({ position: 'fixed', top: Math.round((VP_H - H) / 2), left: Math.round((VP_W - W) / 2) });
      return;
    }

    let top, left;
    switch (step.cardSide) {
      case 'right':
        top  = Math.max(M, Math.min(targetRect.top + targetRect.height / 2 - H / 2, VP_H - H - M));
        left = Math.min(targetRect.right + M + 16, VP_W - W - M);
        break;
      case 'left':
        top  = Math.max(M, Math.min(targetRect.top + targetRect.height / 2 - H / 2, VP_H - H - M));
        left = Math.max(M, targetRect.left - W - M - 16);
        break;
      case 'top':
        top  = Math.max(M, targetRect.top - H - M - 16);
        left = Math.max(M, Math.min(targetRect.left + targetRect.width / 2 - W / 2, VP_W - W - M));
        break;
      case 'bottom':
      default:
        top  = Math.min(targetRect.bottom + M + 16, VP_H - H - M);
        left = Math.max(M, Math.min(targetRect.left + targetRect.width / 2 - W / 2, VP_W - W - M));
        break;
    }
    setPos({ position: 'fixed', top, left, transform: 'none' });
  }, [step, targetRect]);

  const isFirst = stepIndex === 0;
  const isLast  = stepIndex === total - 1;

  return (
    <motion.div
      ref={cardRef}
      key={step.id}
      initial={{ opacity: 0, scale: 0.9, y: 14 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: -10 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      style={{
        ...pos,
        width: 'min(340px, calc(100vw - 32px))',
        background: 'var(--theme-bg-modal, #fff)',
        border: '1px solid var(--theme-border, #e2e8f0)',
        borderRadius: 20,
        padding: '28px 26px 22px',
        boxShadow: '0 28px 80px rgba(0,0,0,0.24)',
        zIndex: 9999,
      }}
    >
      {/* Illustration */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
        <IconComp />
      </div>

      {/* Progress */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--theme-text-muted, #94a3b8)', fontWeight: 500, letterSpacing: '0.04em' }}>
          {stepIndex + 1} of {total}
        </span>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          {Array.from({ length: total }).map((_, i) => (
            <motion.div key={i}
              animate={{ width: i === stepIndex ? 20 : 6, background: i === stepIndex ? A : 'var(--theme-border, #e2e8f0)' }}
              transition={{ duration: 0.22 }}
              style={{ height: 6, borderRadius: 3 }}
            />
          ))}
        </div>
      </div>

      <h3 style={{ margin: '0 0 8px', fontSize: '1rem', fontWeight: 700, color: 'var(--theme-text-primary, #1a1a2e)', lineHeight: 1.3 }}>
        {step.title}
      </h3>
      <p style={{ margin: '0 0 20px', fontSize: '0.82rem', color: 'var(--theme-text-secondary, #64748b)', lineHeight: 1.65 }}>
        {step.body}
      </p>

      {/* Navigation row */}
      <div style={{ display: 'flex', gap: 8 }}>
        {!isFirst && (
          <button onClick={onBack}
            style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: '1px solid var(--theme-border, #e2e8f0)', background: 'transparent', color: 'var(--theme-text-primary, #1a1a2e)', cursor: 'pointer', fontSize: '0.82rem' }}>
            ← Back
          </button>
        )}
        <motion.button onClick={onNext}
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          style={{ flex: isFirst ? 1 : 2, padding: '9px 0', borderRadius: 10, border: 'none', background: A, color: 'white', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
          {isLast ? "Let's go!" : 'Next →'}
        </motion.button>
      </div>

      {/* Secondary row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--theme-border, #f1f5f9)' }}>
        <button onClick={onSkip}
          style={{ border: 'none', background: 'none', color: 'var(--theme-text-muted, #94a3b8)', fontSize: '0.75rem', cursor: 'pointer', padding: 0 }}>
          Skip tour
        </button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--theme-text-muted, #94a3b8)', userSelect: 'none' }}>
            Show on startup
          </span>
          {/* mini toggle */}
          <div onClick={() => onToggleAutoShow(!noAutoShow)}
            style={{
              width: 30, height: 17, borderRadius: 9, position: 'relative', cursor: 'pointer', flexShrink: 0,
              background: noAutoShow ? 'var(--theme-border, #e2e8f0)' : A,
              transition: 'background 0.2s',
            }}>
            <div style={{
              position: 'absolute', top: 2.5,
              left: noAutoShow ? 2 : 16,
              width: 12, height: 12, borderRadius: '50%',
              background: 'white',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              transition: 'left 0.18s',
            }} />
          </div>
        </label>
      </div>
    </motion.div>
  );
}

// ── Main tour ─────────────────────────────────────────────────────────────────
export default function OnboardingTour({ setSection, open, onClose }) {
  const [stepIndex, setStepIndex]   = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const [noAutoShow, setNoAutoShow] = useState(() => localStorage.getItem(TOUR_AUTO_KEY) === '0');
  const STEPS = makeSteps();
  const step  = STEPS[stepIndex];

  // Reset step index each time the tour opens
  useEffect(() => {
    if (open) setStepIndex(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!step.target) { setTargetRect(null); return; }
    const measure = () => {
      const el = document.querySelector(step.target);
      setTargetRect(el ? el.getBoundingClientRect() : null);
    };
    measure();
    const t = setTimeout(measure, 300);
    return () => clearTimeout(t);
  }, [stepIndex, open, step]);

  useEffect(() => {
    if (!open || !setSection) return;
    step.onEnter?.({ setSection });
  }, [stepIndex, open, setSection, step]);

  const handleToggleAutoShow = (checked) => {
    setNoAutoShow(checked);
    if (checked) {
      localStorage.setItem(TOUR_AUTO_KEY, '0');
    } else {
      localStorage.removeItem(TOUR_AUTO_KEY);
    }
  };

  if (!open) return null;

  const finish = () => {
    if (setSection) setSection('todos');
    onClose();
  };

  const goNext = () => {
    if (stepIndex === STEPS.length - 1) { finish(); return; }
    STEPS[stepIndex].onExit?.({ setSection });
    setStepIndex(s => s + 1);
  };

  const goBack = () => {
    if (stepIndex === 0) return;
    setStepIndex(s => s - 1);
  };

  return createPortal(
    <>
      <AnimatePresence>
        {!step.target && (
          <motion.div key="overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.60)', zIndex: 9996 }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {targetRect && <Spotlight key={step.id} rect={targetRect} />}
      </AnimatePresence>

      {targetRect && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9996 }} />
      )}

      <AnimatePresence mode="wait">
        <TourCard
          key={step.id}
          step={step}
          stepIndex={stepIndex}
          total={STEPS.length}
          targetRect={targetRect}
          noAutoShow={noAutoShow}
          onToggleAutoShow={handleToggleAutoShow}
          onNext={goNext}
          onBack={goBack}
          onSkip={finish}
        />
      </AnimatePresence>
    </>,
    document.body,
  );
}

import { useState, useEffect, useCallback, useRef } from 'react';
import { _subscribeToasts } from '../utils/toast';
import { mascotForToast } from '../assets/kandoo/mascots';

const DURATIONS = {
  success: 3500,
  error:   6500,
  warning: 3500,
  due:     9000,
  info:    3500,
  default: 3500,
  loading: Infinity,
};

const DOTS = {
  success: '#22c55e',
  error:   '#ef4444',
  warning: '#f59e0b',
  due:     '#8b5cf6',
  info:    null,
  default: null,
  loading: null,
};

// ── Easing functions ────────────────────────────────────────────────────────
const easeOut   = t => 1 - Math.pow(1 - t, 3);
const springOut = t => {                              // overshoot spring
  const c4 = (2 * Math.PI) / 3;
  return t === 0 ? 0 : t === 1 ? 1
    : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
};

// Animate a DOM node's style directly via rAF — fully bypasses CSS transitions
// so OS-level "Reduce Motion" overrides can't flatten the animation.
function animateNode(node, from, to, durationMs, easeFn, onDone) {
  if (!node) { onDone?.(); return; }
  const start = performance.now();

  const lerp = (a, b, t) => a + (b - a) * t;

  const applyFrame = (progress) => {
    const t = easeFn(progress);
    node.style.opacity   = lerp(from.opacity,   to.opacity,   t);
    node.style.transform = `translateX(${lerp(from.tx, to.tx, t)}px) scale(${lerp(from.scale, to.scale, t)})`;
  };

  applyFrame(0);

  const tick = (now) => {
    const elapsed = now - start;
    const progress = Math.min(elapsed / durationMs, 1);
    applyFrame(progress);
    if (progress < 1) requestAnimationFrame(tick);
    else onDone?.();
  };

  requestAnimationFrame(tick);
}

// ── Individual toast ────────────────────────────────────────────────────────
function ToastItem({ item, onRemove }) {
  const wrapRef    = useRef(null);
  const mascotRef  = useRef(null);
  const leaveRef   = useRef(false);
  const timerRef   = useRef(null);

  const duration  = item.duration ?? DURATIONS[item.type] ?? 3500;
  const isLoading = item.type === 'loading';
  const img  = mascotForToast(item.type);
  const dot  = DOTS[item.type];
  const dotColor = dot || 'var(--theme-accent)';

  const leave = useCallback(() => {
    if (leaveRef.current) return;
    leaveRef.current = true;
    clearTimeout(timerRef.current);
    animateNode(
      wrapRef.current,
      { opacity: 1, tx: 0, scale: 1 },
      { opacity: 0, tx: 80, scale: 0.95 },
      300, easeOut,
      onRemove,
    );
  }, [onRemove]);

  // Enter animation — fires after first paint
  useEffect(() => {
    // Set hidden initial state immediately (before browser paints)
    if (wrapRef.current) {
      wrapRef.current.style.opacity   = '0';
      wrapRef.current.style.transform = 'translateX(64px) scale(0.9)';
    }
    if (mascotRef.current) {
      mascotRef.current.style.opacity   = '0';
      mascotRef.current.style.transform = 'scale(0.3) rotate(-18deg)';
    }

    // Toast slides in
    const rafId = requestAnimationFrame(() => {
      animateNode(
        wrapRef.current,
        { opacity: 0, tx: 64, scale: 0.9 },
        { opacity: 1, tx: 0,  scale: 1   },
        440, springOut,
      );
      // Mascot pops 80ms after toast starts
      setTimeout(() => {
        animateNode(
          mascotRef.current,
          { opacity: 0, tx: 0, scale: 0.3 },
          { opacity: 1, tx: 0, scale: 1   },
          420, springOut,
        );
        // Undo the rotation manually
        if (mascotRef.current) mascotRef.current.style.transform = 'scale(0.3) rotate(-18deg)';
        const mascotRafId = requestAnimationFrame(() => {
          const ms = performance.now();
          const popTick = (now) => {
            const t = Math.min((now - ms) / 420, 1);
            const s = springOut(t);
            const angle = (1 - t) * (-18);
            if (mascotRef.current) {
              mascotRef.current.style.opacity   = String(s);
              mascotRef.current.style.transform = `scale(${0.3 + s * 0.7}) rotate(${angle}deg)`;
            }
            if (t < 1) requestAnimationFrame(popTick);
          };
          requestAnimationFrame(popTick);
        });
        return () => cancelAnimationFrame(mascotRafId);
      }, 80);
    });

    return () => cancelAnimationFrame(rafId);
  }, []);

  // Auto-dismiss
  useEffect(() => {
    if (duration === Infinity) return;
    timerRef.current = setTimeout(leave, duration);
    return () => clearTimeout(timerRef.current);
  }, [duration, leave]);

  return (
    <div
      ref={wrapRef}
      onClick={isLoading ? undefined : leave}
      style={{
        position:   'relative',
        display:    'flex',
        alignItems: 'center',
        gap:        10,
        padding:    '11px 16px 17px 11px',
        background: 'var(--theme-bg-modal)',
        border:     '1px solid var(--theme-border)',
        borderRadius: 16,
        boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)',
        backdropFilter:       'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        minWidth:   262,
        maxWidth:   360,
        cursor:     isLoading ? 'default' : 'pointer',
        userSelect: 'none',
        overflow:   'hidden',
        // Initial hidden state set directly in useEffect before first paint
        opacity:   0,
        willChange: 'opacity, transform',
      }}
    >
      {/* Mascot */}
      <img
        ref={mascotRef}
        src={img}
        alt=""
        style={{
          width:      38,
          height:     38,
          flexShrink: 0,
          borderRadius: '50%',
          opacity:    0,
          willChange: 'opacity, transform',
          animation:  isLoading ? 'kandoo-mascot-float 2s ease-in-out 0.6s infinite' : 'none',
        }}
      />

      {/* Text + optional action */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
            background: dotColor,
            boxShadow:  `0 0 6px ${dot ? dot + '99' : 'var(--theme-accent)'}`,
          }} />
          <span style={{
            fontSize:     '0.86rem',
            fontWeight:   500,
            color:        'var(--theme-text-primary)',
            lineHeight:   1.4,
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}>
            {item.message}
          </span>
        </div>

        {item.action && (
          <button
            onClick={(e) => { e.stopPropagation(); item.action.onClick(); leave(); }}
            style={{
              marginTop:    6,
              marginLeft:   14,
              padding:      '3px 12px',
              borderRadius: 20,
              border:       '1.5px solid var(--theme-accent)',
              background:   'transparent',
              color:        'var(--theme-accent)',
              fontSize:     '0.78rem',
              fontWeight:   600,
              cursor:       'pointer',
              fontFamily:   'inherit',
              transition:   'background 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--theme-accent)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--theme-accent)'; }}
          >
            {item.action.label}
          </button>
        )}
      </div>

      {/* Progress bar */}
      {duration !== Infinity && (
        <ProgressBar duration={duration} color={dotColor} />
      )}

      {/* Loading shimmer */}
      {isLoading && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: 3, borderRadius: '0 0 16px 16px',
          background: 'var(--theme-accent)', opacity: 0.35,
          animation: 'kandoo-loading-bar 1.4s ease-in-out infinite',
        }} />
      )}
    </div>
  );
}

// Progress bar: JS-driven shrink so it can't be crushed by reduce-motion CSS
function ProgressBar({ duration, color }) {
  const barRef = useRef(null);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const start = performance.now();

    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      bar.style.transform = `scaleX(${1 - t})`;
      if (t < 1) requestAnimationFrame(tick);
    };

    const rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [duration]);

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      height: 3, borderRadius: '0 0 16px 16px',
      background: 'var(--theme-border)', overflow: 'hidden',
    }}>
      <div
        ref={barRef}
        style={{
          height: '100%',
          width:  '100%',
          background:    color,
          opacity:       0.85,
          transformOrigin: 'left',
          willChange: 'transform',
        }}
      />
    </div>
  );
}

// ── Container ───────────────────────────────────────────────────────────────
export default function KandooToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    return _subscribeToasts((event) => {
      if (event.kind === 'add') {
        setToasts(prev => {
          const exists = prev.find(t => t.id === event.id);
          if (exists) return prev.map(t => t.id === event.id ? { ...t, ...event } : t);
          const next = [...prev, event];
          return next.length > 5 ? next.slice(next.length - 5) : next;
        });
      } else if (event.kind === 'remove') {
        setToasts(prev => prev.filter(t => t.id !== event.id));
      }
    });
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position:  'fixed',
      bottom:    20,
      right:     20,
      zIndex:    9999,
      display:   'flex',
      flexDirection: 'column',
      alignItems:    'flex-end',
      gap:       8,
      pointerEvents: 'none',
    }}>
      {toasts.map(item => (
        <div key={item.id} style={{ pointerEvents: 'all' }}>
          <ToastItem item={item} onRemove={() => removeToast(item.id)} />
        </div>
      ))}
    </div>
  );
}

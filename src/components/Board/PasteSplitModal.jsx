import { useEffect, useRef } from 'react';
import { VscClose } from 'react-icons/vsc';

/**
 * Shown when a multiline block is pasted into a task. Lets the user choose to
 * split it into separate tasks or keep it as a single task — the split is
 * always opt-in, never automatic.
 */
export default function PasteSplitModal({ count, onSeparate, onSingle, onClose }) {
  const overlayRef = useRef(null);

  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      // Don't let the mousedown reach the new-task form's outside-click handler,
      // which would close the form (unmounting its editor) before we can insert.
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: 'fixed', inset: 0, zIndex: 3000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.35)',
        backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
      }}
    >
      <div style={{
        width: 400,
        background: 'var(--theme-bg-modal)',
        border: '1px solid var(--theme-border)',
        borderRadius: 16,
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          padding: '18px 20px 12px', borderBottom: '1px solid var(--theme-border)',
        }}>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--theme-text-primary)' }}>
              Split into separate tasks?
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--theme-text-muted)', marginTop: 2 }}>
              You pasted {count} lines. Add them as {count} separate tasks, or keep
              everything as one task?
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-text-muted)', fontSize: '1.1rem', display: 'flex', padding: 4, borderRadius: 6, flexShrink: 0, marginLeft: 8 }}
          >
            <VscClose />
          </button>
        </div>

        {/* Footer actions */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '16px 20px' }}>
          <button
            onClick={onSingle}
            style={{
              padding: '8px 16px', borderRadius: 8,
              border: '1.5px solid var(--theme-border)',
              background: 'transparent', color: 'var(--theme-text-secondary)',
              fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer',
            }}
          >
            Keep as one task
          </button>
          <button
            onClick={onSeparate}
            style={{
              padding: '8px 18px', borderRadius: 8, border: 'none',
              background: 'var(--theme-accent)', color: '#fff',
              fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
              boxShadow: '0 2px 8px color-mix(in srgb, var(--theme-accent) 40%, transparent)',
            }}
          >
            Create {count} tasks
          </button>
        </div>
      </div>
    </div>
  );
}

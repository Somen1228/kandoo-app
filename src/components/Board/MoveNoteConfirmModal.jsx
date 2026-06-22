import { useEffect, useRef } from 'react';
import { IoFolderOpenOutline, IoArrowUpOutline } from 'react-icons/io5';

/**
 * Confirmation shown when a drag would reparent a page — moving it *under*
 * another page, or back out to the top level. Keeps drag-reparenting from
 * happening by accident; the actual move is still undoable afterwards.
 */
export default function MoveNoteConfirmModal({ title, destinationTitle, onConfirm, onCancel }) {
  const overlayRef = useRef(null);
  const confirmRef = useRef(null);

  useEffect(() => {
    confirmRef.current?.focus();
    const fn = (e) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onCancel, onConfirm]);

  const toTopLevel = !destinationTitle;

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onCancel(); }}
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: 'fixed', inset: 0, zIndex: 3000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.35)',
        backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
      }}
    >
      <div style={{
        width: 380,
        background: 'var(--theme-bg-modal)',
        border: '1px solid var(--theme-border)',
        borderRadius: 16,
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: '20px 20px 8px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div style={{
            flexShrink: 0, width: 38, height: 38, borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'color-mix(in srgb, var(--theme-accent) 16%, transparent)',
            color: 'var(--theme-accent)', fontSize: '1.15rem',
          }}>
            {toTopLevel ? <IoArrowUpOutline /> : <IoFolderOpenOutline />}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--theme-text-primary)' }}>
              Move this page?
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--theme-text-muted)', marginTop: 4, lineHeight: 1.45 }}>
              {toTopLevel ? (
                <>Move <Strong>{title}</Strong> out to the top level.</>
              ) : (
                <>Move <Strong>{title}</Strong> under <Strong>{destinationTitle}</Strong>.</>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '14px 20px 18px' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px', borderRadius: 8,
              border: '1.5px solid var(--theme-border)',
              background: 'transparent', color: 'var(--theme-text-secondary)',
              fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            style={{
              padding: '8px 18px', borderRadius: 8, border: 'none',
              background: 'var(--theme-accent)', color: '#fff',
              fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
              boxShadow: '0 2px 8px color-mix(in srgb, var(--theme-accent) 40%, transparent)',
            }}
          >
            Move page
          </button>
        </div>
      </div>
    </div>
  );
}

function Strong({ children }) {
  return <strong style={{ color: 'var(--theme-text-primary)', fontWeight: 600 }}>{children}</strong>;
}

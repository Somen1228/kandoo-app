import { useEffect, useRef } from 'react';
import { VscNote, VscClose, VscGear } from 'react-icons/vsc';

/**
 * Compact popover listing all notes linked to a task. Opened from the "+N"
 * overflow chip. Click a row to jump to that note, the × to unlink it, or
 * "Manage links" to open the full picker.
 */
export default function LinkedNotesPopover({ x, y, links, getNoteTitle, onNavigate, onRemove, onManage, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    // Defer so the opening click doesn't immediately close it.
    const id = setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => { clearTimeout(id); document.removeEventListener('mousedown', handler); };
  }, [onClose]);

  const W = 248;
  const left = Math.min(x, window.innerWidth - W - 10);
  const top = Math.min(y, window.innerHeight - 60);

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed', top, left, width: W, zIndex: 3000,
        background: 'var(--theme-bg-modal)',
        border: '1px solid var(--theme-border)',
        borderRadius: 12,
        boxShadow: '0 12px 32px rgba(0,0,0,0.22)',
        padding: 6, display: 'flex', flexDirection: 'column', gap: 2,
      }}
    >
      <div style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.07em', color: 'var(--theme-text-muted)', padding: '5px 8px 3px' }}>
        LINKED NOTES
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 240, overflowY: 'auto' }}>
        {links.map((l) => (
          <div
            key={l.noteUid}
            style={{ display: 'flex', alignItems: 'center', borderRadius: 7, overflow: 'hidden' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--theme-bg-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <button
              type="button"
              onClick={() => onNavigate(l.noteUid)}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', gap: 8,
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--theme-text-primary)', fontSize: '0.82rem',
                fontFamily: 'inherit', padding: '7px 8px', textAlign: 'left',
                minWidth: 0,
              }}
            >
              <VscNote style={{ color: 'var(--theme-text-muted)', flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {getNoteTitle?.(l.noteUid) || 'Untitled note'}
              </span>
            </button>
            <button
              type="button"
              title="Unlink note"
              onClick={() => onRemove(l.noteUid)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--theme-text-muted)', padding: '6px 8px', flexShrink: 0,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--theme-danger)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--theme-text-muted)'; }}
            >
              <VscClose style={{ fontSize: '0.85rem' }} />
            </button>
          </div>
        ))}
      </div>

      <div style={{ height: 1, background: 'var(--theme-border)', margin: '3px 4px' }} />
      <button
        type="button"
        onClick={onManage}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--theme-text-secondary)', fontSize: '0.8rem',
          fontFamily: 'inherit', padding: '7px 8px', borderRadius: 7,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--theme-bg-hover)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        <VscGear style={{ color: 'var(--theme-text-muted)' }} /> Manage links…
      </button>
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import { VscClose, VscChecklist, VscAdd } from 'react-icons/vsc';

/**
 * Picker shown when sending a note checklist to the board.
 * Lets the user drop the tasks into an existing to-do card or a brand-new one.
 */
export default function SendToBoardModal({ count, cards, onConfirm, onClose }) {
  const hasCards = cards.length > 0;
  const [mode, setMode] = useState(hasCards ? 'existing' : 'new');
  const [selectedUid, setSelectedUid] = useState(hasCards ? cards[0].uid : null);
  const [newTitle, setNewTitle] = useState('');
  const overlayRef = useRef(null);
  const newInputRef = useRef(null);

  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose]);

  useEffect(() => {
    if (mode === 'new') setTimeout(() => newInputRef.current?.focus(), 40);
  }, [mode]);

  const canSubmit = mode === 'existing' ? !!selectedUid : newTitle.trim().length > 0;

  const submit = () => {
    if (!canSubmit) return;
    if (mode === 'existing') onConfirm({ mode: 'existing', cardUid: selectedUid });
    else onConfirm({ mode: 'new', title: newTitle.trim() });
  };

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 3000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.35)',
        backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
      }}
    >
      <div style={{
        width: 420,
        background: 'var(--theme-bg-modal)',
        border: '1px solid var(--theme-border)',
        borderRadius: 16,
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 20px 14px', borderBottom: '1px solid var(--theme-border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: 'var(--theme-accent)', fontSize: '1.2rem', display: 'flex' }}>
              <VscChecklist />
            </span>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--theme-text-primary)' }}>
                Send to board
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--theme-text-muted)', marginTop: 2 }}>
                {count} task{count === 1 ? '' : 's'} from this note
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-text-muted)', fontSize: '1.1rem', display: 'flex', padding: 4, borderRadius: 6 }}
          >
            <VscClose />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {hasCards && (
            <>
              <div style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.06em', color: 'var(--theme-text-muted)' }}>
                ADD TO EXISTING CARD
              </div>
              <div style={{
                display: 'flex', flexDirection: 'column', gap: 6,
                maxHeight: 200, overflowY: 'auto',
              }}>
                {cards.map((c) => {
                  const active = mode === 'existing' && selectedUid === c.uid;
                  const taskCount = Object.keys(c.tasks || {}).length;
                  return (
                    <button
                      key={c.uid}
                      type="button"
                      onClick={() => { setMode('existing'); setSelectedUid(c.uid); }}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '9px 12px', borderRadius: 9, cursor: 'pointer',
                        border: `1.5px solid ${active ? 'var(--theme-accent)' : 'var(--theme-border)'}`,
                        background: active ? 'color-mix(in srgb, var(--theme-accent) 12%, transparent)' : 'transparent',
                        color: 'var(--theme-text-primary)', fontSize: '0.875rem',
                        fontWeight: active ? 600 : 500, textAlign: 'left',
                        transition: 'all 0.12s',
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.title}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--theme-text-muted)', flexShrink: 0, marginLeft: 8 }}>
                        {taskCount} task{taskCount === 1 ? '' : 's'}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '2px 0' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--theme-border)' }} />
                <span style={{ fontSize: '0.7rem', color: 'var(--theme-text-muted)' }}>or</span>
                <div style={{ flex: 1, height: 1, background: 'var(--theme-border)' }} />
              </div>
            </>
          )}

          {/* New card */}
          <button
            type="button"
            onClick={() => setMode('new')}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 12px', borderRadius: 9, cursor: 'pointer',
              border: `1.5px solid ${mode === 'new' ? 'var(--theme-accent)' : 'var(--theme-border)'}`,
              background: mode === 'new' ? 'color-mix(in srgb, var(--theme-accent) 12%, transparent)' : 'transparent',
              color: 'var(--theme-text-primary)', fontSize: '0.875rem', fontWeight: 600,
              transition: 'all 0.12s',
            }}
          >
            <VscAdd style={{ color: 'var(--theme-accent)' }} /> Create a new card
          </button>
          {mode === 'new' && (
            <input
              ref={newInputRef}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
              placeholder="New card name…"
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'var(--theme-bg-input)',
                border: '1px solid var(--theme-border)', borderRadius: 9,
                color: 'var(--theme-text-primary)', fontSize: '0.875rem',
                fontFamily: 'inherit', padding: '9px 12px', outline: 'none',
                transition: 'border-color 0.15s',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--theme-accent)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--theme-border)')}
            />
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '0 20px 18px' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 18px', borderRadius: 8,
              border: '1.5px solid var(--theme-border)',
              background: 'transparent', color: 'var(--theme-text-secondary)',
              fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!canSubmit}
            style={{
              padding: '8px 22px', borderRadius: 8, border: 'none',
              background: 'var(--theme-accent)', color: '#fff',
              fontSize: '0.875rem', fontWeight: 600,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              opacity: canSubmit ? 1 : 0.5,
              boxShadow: '0 2px 8px color-mix(in srgb, var(--theme-accent) 40%, transparent)',
            }}
          >
            Add {count} task{count === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </div>
  );
}

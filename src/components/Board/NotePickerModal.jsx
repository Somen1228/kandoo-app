import { useState, useEffect, useRef, useMemo } from 'react';
import { VscClose, VscNote, VscSearch, VscCheck } from 'react-icons/vsc';

/**
 * Multi-select manager for the notes linked to a task. Page-level links: each
 * selected note's uid is stored on the task's `noteLinks`. Toggling a row links
 * or unlinks that note; the list stays open so several can be managed at once.
 */
export default function NotePickerModal({ notes, linkedUids = [], onToggle, onClose }) {
  const [q, setQ] = useState('');
  const overlayRef = useRef(null);
  const searchRef = useRef(null);
  const linkedSet = useMemo(() => new Set(linkedUids), [linkedUids]);

  useEffect(() => {
    setTimeout(() => searchRef.current?.focus(), 40);
    const fn = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = notes || [];
    if (!term) return list;
    return list.filter((n) => (n.title || '').toLowerCase().includes(term));
  }, [notes, q]);

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      // Keep the new-task form's outside-click handler from firing underneath.
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: 'fixed', inset: 0, zIndex: 3000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.35)',
        backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
      }}
    >
      <div style={{
        width: 420, maxHeight: '70vh',
        background: 'var(--theme-bg-modal)',
        border: '1px solid var(--theme-border)',
        borderRadius: 16,
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 20px 12px', borderBottom: '1px solid var(--theme-border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: 'var(--theme-accent)', fontSize: '1.2rem', display: 'flex' }}>
              <VscNote />
            </span>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--theme-text-primary)' }}>
                Linked notes
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--theme-text-muted)', marginTop: 2 }}>
                {linkedSet.size > 0
                  ? `${linkedSet.size} linked · tap to link or unlink`
                  : 'Tap notes to link them to this task'}
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

        {/* Search */}
        <div style={{ padding: '12px 20px 10px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--theme-bg-input)',
            border: '1px solid var(--theme-border)', borderRadius: 9,
            padding: '8px 11px',
          }}>
            <VscSearch style={{ color: 'var(--theme-text-muted)', flexShrink: 0 }} />
            <input
              ref={searchRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search notes…"
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                color: 'var(--theme-text-primary)', fontSize: '0.875rem', fontFamily: 'inherit',
              }}
            />
          </div>
        </div>

        {/* List */}
        <div style={{ padding: '0 12px 8px', overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--theme-text-muted)', fontSize: '0.85rem' }}>
              {(notes || []).length === 0
                ? 'No notes yet — create one in the Notes tab first.'
                : 'No notes match your search.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {filtered.map((n) => {
                const active = linkedSet.has(n.uid);
                return (
                  <button
                    key={n.uid}
                    type="button"
                    onClick={() => onToggle(n.uid)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 9,
                      padding: '9px 12px', borderRadius: 9, cursor: 'pointer',
                      border: `1.5px solid ${active ? 'var(--theme-accent)' : 'transparent'}`,
                      background: active ? 'color-mix(in srgb, var(--theme-accent) 12%, transparent)' : 'transparent',
                      color: 'var(--theme-text-primary)', fontSize: '0.875rem',
                      fontWeight: active ? 600 : 500, textAlign: 'left',
                      transition: 'background 0.12s, border-color 0.12s',
                    }}
                    onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--theme-bg-hover)'; }}
                    onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{
                      width: 18, height: 18, flexShrink: 0, borderRadius: 5,
                      border: `1.5px solid ${active ? 'var(--theme-accent)' : 'var(--theme-border)'}`,
                      background: active ? 'var(--theme-accent)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {active && <VscCheck style={{ color: '#fff', fontSize: '0.8rem' }} />}
                    </span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {n.title || 'Untitled'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 20px 16px', borderTop: '1px solid var(--theme-border)' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 22px', borderRadius: 8, border: 'none',
              background: 'var(--theme-accent)', color: '#fff',
              fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
              boxShadow: '0 2px 8px color-mix(in srgb, var(--theme-accent) 40%, transparent)',
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

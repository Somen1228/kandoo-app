import { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';

/**
 * ContextMenu — popover menu positioned at a coordinate.
 *
 * Props:
 *   x, y       — viewport coordinates (from event.clientX/clientY)
 *   items      — Array<{ label, onClick, icon?, shortcut?, danger?, divider? }>
 *                divider: true renders a horizontal rule instead of a button
 *   onClose    — called when the menu should close (outside click, Esc, item click)
 */
function ContextMenu({ x, y, items, onClose }) {
  const menuRef = useRef(null);
  const [pos, setPos] = useState({ left: x, top: y });

  // Clamp menu inside viewport after mount (once we know its size)
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const pad = 8;
    let left = x;
    let top = y;
    if (left + rect.width + pad > window.innerWidth) left = window.innerWidth - rect.width - pad;
    if (top + rect.height + pad > window.innerHeight) top = window.innerHeight - rect.height - pad;
    if (left < pad) left = pad;
    if (top < pad) top = pad;
    setPos({ left, top });
  }, [x, y]);

  useEffect(() => {
    const handleDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    const handleScroll = (event) => {
      // Keep the menu open while its own overflow area is being scrolled.
      if (menuRef.current?.contains(event.target)) return;
      onClose();
    };
    document.addEventListener('mousedown', handleDown);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleDown);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [onClose]);

  return ReactDOM.createPortal(
    <div
      ref={menuRef}
      className="fixed z-[60] rounded-lg shadow-xl py-1 min-w-[10rem]"
      style={{
        left: pos.left,
        top: pos.top,
        background: 'var(--theme-bg-modal)',
        border: '1px solid var(--theme-border)',
        boxShadow: '0 8px 24px var(--theme-shadow)',
        animation: 'ctxFadeIn 0.12s ease-out',
        maxHeight: 'calc(100vh - 16px)',
        overflowY: 'auto',
        overscrollBehavior: 'contain',
      }}
      role="menu"
    >
      {items.map((item, i) => {
        if (item.divider) {
          return (
            <div
              key={i}
              className="my-1 mx-2"
              style={{ height: 1, background: 'var(--theme-border)' }}
            />
          );
        }
        return (
          <button
            key={i}
            role="menuitem"
            onClick={() => {
              item.onClick?.();
              onClose();
            }}
            className="w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 transition-colors"
            style={{
              color: item.danger ? 'var(--theme-danger)' : 'var(--theme-text-primary)',
              background: 'transparent',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = item.danger
                ? 'var(--theme-danger-bg)'
                : 'var(--theme-bg-hover)';
            }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            {item.icon && <span className="text-base opacity-80">{item.icon}</span>}
            <span>{item.label}</span>
            {item.shortcut && (
              <span style={{ marginLeft: 'auto', paddingLeft: 18, color: 'var(--theme-text-muted)', fontSize: '0.72rem' }}>
                {item.shortcut}
              </span>
            )}
          </button>
        );
      })}
      <style>{`
        @keyframes ctxFadeIn {
          from { opacity: 0; transform: translateY(-2px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>,
    document.body
  );
}

export default ContextMenu;

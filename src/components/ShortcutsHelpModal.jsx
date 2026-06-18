import { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? '⌘' : 'Ctrl';

const SHORTCUTS = [
  { group: 'Navigation', items: [
    { keys: [mod, 'K'], desc: 'Focus search' },
    { keys: ['/'], desc: 'Focus search' },
    { keys: ['Esc'], desc: 'Close any open modal or menu' },
  ]},
  { group: 'Actions', items: [
    { keys: ['N'], desc: 'Quick-add task to active board' },
    { keys: ['T'], desc: 'Cycle to next theme' },
    { keys: ['?'], desc: 'Show this shortcuts panel' },
  ]},
  { group: 'In a task editor', items: [
    { keys: ['Enter'], desc: 'Save task' },
    { keys: ['Shift', 'Enter'], desc: 'Insert newline' },
    { keys: ['Esc'], desc: 'Cancel edit' },
  ]},
  { group: 'Mouse', items: [
    { keys: ['Right-click'], desc: 'Open context menu on tasks, cards, boards' },
    { keys: ['Double-click'], desc: 'Edit board title in sidebar' },
    { keys: ['Drag'], desc: 'Move tasks between cards' },
  ]},
];

function Key({ children }) {
  return (
    <kbd
      className="px-2 py-0.5 text-xs font-medium rounded"
      style={{
        background: 'var(--theme-bg-hover)',
        color: 'var(--theme-text-primary)',
        border: '1px solid var(--theme-border)',
        boxShadow: '0 1px 0 var(--theme-shadow)',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        minWidth: '1.5rem',
        display: 'inline-block',
        textAlign: 'center',
      }}
    >
      {children}
    </kbd>
  );
}

function ShortcutsHelpModal({ onClose }) {
  const panelRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
      style={{ background: 'var(--theme-bg-overlay)' }}
    >
      <div
        ref={panelRef}
        className="w-[34rem] max-w-[92vw] max-h-[85vh] overflow-y-auto rounded-xl shadow-2xl p-6"
        style={{
          background: 'var(--theme-bg-modal)',
          border: '1px solid var(--theme-border)',
          color: 'var(--theme-text-primary)',
        }}
      >
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-xl font-semibold">⌨️ Keyboard Shortcuts</h2>
          <button
            className="text-xl leading-none px-2 py-0.5 rounded transition"
            style={{ color: 'var(--theme-text-muted)' }}
            onClick={onClose}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--theme-bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-5">
          {SHORTCUTS.map((group) => (
            <div key={group.group}>
              <p
                className="text-xs uppercase tracking-wider mb-2 font-semibold"
                style={{ color: 'var(--theme-text-muted)' }}
              >
                {group.group}
              </p>
              <ul className="flex flex-col gap-1.5">
                {group.items.map((item, i) => (
                  <li key={i} className="flex items-center justify-between py-1">
                    <span className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>
                      {item.desc}
                    </span>
                    <span className="flex gap-1">
                      {item.keys.map((k, j) => (
                        <Key key={j}>{k}</Key>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p
          className="text-xs text-center mt-6"
          style={{ color: 'var(--theme-text-muted)' }}
        >
          Press <Key>Esc</Key> or <Key>?</Key> to close
        </p>
      </div>
    </div>,
    document.body
  );
}

export default ShortcutsHelpModal;

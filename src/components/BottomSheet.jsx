import { useEffect } from 'react';
import { createPortal } from 'react-dom';

// A phone-native bottom sheet: slides up from the bottom, full-width, with a
// grip handle. Used for the "More" menu and as the mobile presentation for
// modals. Tap the scrim or press Esc to dismiss.
export default function BottomSheet({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="bottom-sheet-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div className="bottom-sheet" role="dialog" aria-modal="true" aria-label={title || 'Menu'}>
        <span className="bottom-sheet__grip" aria-hidden="true" />
        {title && <div className="bottom-sheet__title">{title}</div>}
        <div className="bottom-sheet__body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

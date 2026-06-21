import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { VscChevronDown, VscExport } from 'react-icons/vsc';
import { toast } from '../../utils/toast';
import { NOTE_EXPORT_FORMATS } from '../../utils/noteExportFormats';

export default function NoteExportMenu({ title, html }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const [exporting, setExporting] = useState(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  const close = () => setOpen(false);

  const toggle = () => {
    if (open) { close(); return; }
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 310;
    const margin = 8;
    setPosition({
      top: rect.bottom + 7,
      left: Math.min(window.innerWidth - width - margin, Math.max(margin, rect.right - width)),
      width,
    });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return undefined;
    const frame = requestAnimationFrame(() => {
      const menu = menuRef.current;
      const button = buttonRef.current;
      if (!menu || !button) return;
      const menuRect = menu.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      if (menuRect.bottom > window.innerHeight - 8) {
        setPosition((current) => ({ ...current, top: Math.max(8, buttonRect.top - menuRect.height - 7) }));
      }
    });
    const outside = (event) => {
      if (menuRef.current?.contains(event.target) || buttonRef.current?.contains(event.target)) return;
      close();
    };
    const keydown = (event) => { if (event.key === 'Escape') close(); };
    const resize = () => close();
    const scroll = (event) => {
      if (menuRef.current?.contains(event.target)) return;
      close();
    };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', keydown);
    window.addEventListener('resize', resize);
    window.addEventListener('scroll', scroll, true);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', keydown);
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', scroll, true);
    };
  }, [open]);

  const runExport = async (format) => {
    setOpen(false);
    setExporting(format.id);
    const toastId = toast.loading(`Preparing ${format.label}…`);
    try {
      const { exportNote } = await import('../../utils/noteExport');
      const result = await exportNote({ title, html }, format.id);
      toast.dismiss(toastId);
      toast.success(`Exported ${result.filename}`);
    } catch (error) {
      toast.dismiss(toastId);
      toast.error(error.message || `Could not export ${format.label}`);
    } finally {
      setExporting(null);
    }
  };

  return (
    <>
      <button ref={buttonRef} type="button" className="note-export-trigger"
        onClick={toggle} disabled={Boolean(exporting)}
        aria-haspopup="menu" aria-expanded={open} title="Export this note">
        <VscExport />
        <span>{exporting ? 'Exporting…' : 'Export'}</span>
        <VscChevronDown className={open ? 'is-open' : ''} aria-hidden="true" />
      </button>
      {open && position && createPortal(
        <div ref={menuRef} className="note-export-menu" style={position} role="menu">
          <div className="note-export-menu__head">
            <strong>Export note</strong>
            <span>Choose a file format</span>
          </div>
          <div className="note-export-menu__list">
            {NOTE_EXPORT_FORMATS.map((format) => (
              <button key={format.id} type="button" role="menuitem"
                className="note-export-menu__item" onClick={() => runExport(format)}>
                <span className="note-export-menu__extension">{format.extension.replace('.html.zip', 'ZIP')}</span>
                <span className="note-export-menu__copy">
                  <strong>{format.label}</strong>
                  <small>{format.description}</small>
                </span>
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

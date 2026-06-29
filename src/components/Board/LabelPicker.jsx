import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { VscAdd, VscClose, VscCheck } from 'react-icons/vsc';
import { useSettings } from '../../contexts/SettingsContext';
import { newLabelId, nextLabelColor } from '../../utils/labels';

// Multi-select label editor: shows the task's labels as removable chips, with a
// "+ Label" popover to toggle existing labels or create a new one on the fly.
export default function LabelPicker({ value = [], onChange }) {
  const { settings, setSetting } = useSettings();
  const registry = settings.labels || [];
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);

  const valueIds = new Set(value.map((l) => l.id));

  const openMenu = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ left: Math.min(r.left, window.innerWidth - 230), top: r.bottom + 6 });
    setQuery('');
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (e.target.closest?.('[data-label-pop]') || btnRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const toggleLabel = (label) => {
    if (valueIds.has(label.id)) onChange(value.filter((l) => l.id !== label.id));
    else onChange([...value, { id: label.id, name: label.name, color: label.color }]);
  };

  const createLabel = () => {
    const name = query.trim();
    if (!name) return;
    const existing = registry.find((l) => l.name.toLowerCase() === name.toLowerCase());
    if (existing) { toggleLabel(existing); setQuery(''); return; }
    const label = { id: newLabelId(), name, color: nextLabelColor(registry) };
    setSetting('labels', [...registry, label]);
    onChange([...value, label]);
    setQuery('');
  };

  const q = query.trim().toLowerCase();
  const filtered = registry.filter((l) => l.name.toLowerCase().includes(q));
  const canCreate = q && !registry.some((l) => l.name.toLowerCase() === q);

  return (
    <div className="label-picker" onPointerDown={(e) => e.stopPropagation()}>
      {value.map((l) => (
        <span key={l.id} className="label-chip" style={{ '--label-color': l.color }}>
          <span className="label-chip__dot" />
          {l.name}
          <button type="button" className="label-chip__x" onClick={() => onChange(value.filter((x) => x.id !== l.id))} aria-label={`Remove ${l.name}`}>
            <VscClose />
          </button>
        </span>
      ))}
      <button ref={btnRef} type="button" className="label-add-btn" onClick={openMenu}>
        <VscAdd /> Label
      </button>
      {open && pos && createPortal(
        <div data-label-pop className="label-pop" style={{ position: 'fixed', left: pos.left, top: pos.top }}>
          <input
            autoFocus
            className="label-pop__input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); createLabel(); } }}
            placeholder="Search or create…"
          />
          <div className="label-pop__list">
            {filtered.map((l) => (
              <button key={l.id} type="button" className="label-pop__item" onClick={() => toggleLabel(l)}>
                <span className="label-chip__dot" style={{ '--label-color': l.color }} />
                <span className="label-pop__name">{l.name}</span>
                {valueIds.has(l.id) && <VscCheck className="label-pop__check" />}
              </button>
            ))}
            {canCreate && (
              <button type="button" className="label-pop__item label-pop__create" onClick={createLabel}>
                <VscAdd /> Create “{query.trim()}”
              </button>
            )}
            {!filtered.length && !canCreate && <div className="label-pop__empty">No labels yet</div>}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

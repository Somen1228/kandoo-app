import { VscSync } from 'react-icons/vsc';
import { recurrenceLabel } from '../../utils/recurrence';

// Compact repeat toggle — cycles None → Daily → Weekly → Monthly on click.
const ORDER = [null, 'daily', 'weekly', 'monthly'];

export default function RecurrenceButton({ value, onChange }) {
  const label = recurrenceLabel(value);
  const cycle = () => onChange(ORDER[(ORDER.indexOf(value || null) + 1) % ORDER.length]);
  return (
    <button
      type="button"
      className={`recurrence-btn${value ? ' is-on' : ''}`}
      title={`Repeat: ${label || 'off'} — click to change`}
      aria-label={`Repeat ${label || 'off'}`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => { e.stopPropagation(); cycle(); }}
    >
      <VscSync />
      {label && <span className="recurrence-btn__label">{label}</span>}
    </button>
  );
}

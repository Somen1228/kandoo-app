import { PRIORITIES } from '../../utils/taskPriority';

// Compact priority picker — three coloured dots. Click to set; click the active
// one again to clear. Used in the new-task and edit-task forms.
export default function PrioritySelector({ value, onChange }) {
  return (
    <div className="priority-selector" role="group" aria-label="Task priority">
      {PRIORITIES.map((p) => {
        const active = value === p.id;
        return (
          <button
            key={p.id}
            type="button"
            className={`priority-dot${active ? ' is-active' : ''}`}
            title={`${p.label} priority`}
            aria-pressed={active}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onChange(active ? null : p.id); }}
            style={{ '--prio-color': p.color }}
          >
            <span className="priority-dot__fill" />
          </button>
        );
      })}
    </div>
  );
}

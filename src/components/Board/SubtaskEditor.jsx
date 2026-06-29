import { useState } from 'react';
import { VscClose, VscAdd } from 'react-icons/vsc';

let counter = 0;
const newSubtaskId = () => `st_${Date.now().toString(36)}_${counter++}`;

// Add / rename / check / remove subtasks. Used in the new-task and edit-task
// forms; the display renders a read-only (toggleable) checklist separately.
export default function SubtaskEditor({ subtasks = [], onChange }) {
  const [draft, setDraft] = useState('');

  const addSubtask = () => {
    const text = draft.trim();
    if (!text) return;
    onChange([...subtasks, { id: newSubtaskId(), text, done: false }]);
    setDraft('');
  };

  return (
    <div className="subtask-editor" onPointerDown={(e) => e.stopPropagation()}>
      {subtasks.map((st, i) => (
        <div className="subtask-row" key={st.id}>
          <input
            type="checkbox"
            className="subtask-check"
            checked={!!st.done}
            onChange={() => onChange(subtasks.map((s, j) => (j === i ? { ...s, done: !s.done } : s)))}
          />
          <input
            className="subtask-text"
            value={st.text}
            onChange={(e) => onChange(subtasks.map((s, j) => (j === i ? { ...s, text: e.target.value } : s)))}
            placeholder="Subtask"
          />
          <button
            type="button"
            className="subtask-del"
            onClick={() => onChange(subtasks.filter((_, j) => j !== i))}
            aria-label="Remove subtask"
          >
            <VscClose />
          </button>
        </div>
      ))}
      <div className="subtask-row subtask-row--add">
        <VscAdd className="subtask-add-icon" aria-hidden="true" />
        <input
          className="subtask-text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSubtask(); } }}
          onBlur={addSubtask}
          placeholder="Add subtask…"
        />
      </div>
    </div>
  );
}

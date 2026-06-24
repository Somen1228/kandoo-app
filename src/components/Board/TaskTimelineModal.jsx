import { useEffect, useRef } from 'react';
import { VscCalendar, VscCheck, VscClose, VscListFlat, VscWatch } from 'react-icons/vsc';
import { formatDueShort } from '../../utils/dueDate';
import { completionTimingLabel, formatDateTime } from '../../utils/taskLifecycle';
import { htmlToText, isHtml } from '../../utils/htmlEditor';

function dueLabel(due) {
  return due ? formatDueShort(due) : 'No due date';
}

function Row({ icon, title, meta, children }) {
  return (
    <div className="task-timeline-row">
      <div className="task-timeline-row__icon">{icon}</div>
      <div className="task-timeline-row__body">
        <strong>{title}</strong>
        {meta && <span>{meta}</span>}
        {children}
      </div>
    </div>
  );
}

export default function TaskTimelineModal({ task, cardTitle, onClose }) {
  const modalRef = useRef(null);

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose?.(); };
    const onMouse = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) onClose?.();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onMouse);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onMouse);
    };
  }, [onClose]);

  if (!task) return null;
  const dueHistory = Array.isArray(task.dueHistory) ? task.dueHistory : [];
  const dueChanges = dueHistory.length;
  const taskTitle = (isHtml(task.value) ? htmlToText(task.value) : task.value || '').trim() || 'Untitled task';

  return (
    <div className="kandoo-modal-overlay task-timeline-overlay" role="presentation">
      <div ref={modalRef} className="kandoo-modal-card task-timeline-modal" role="dialog" aria-modal="true" aria-label="Task timeline">
        <div className="task-timeline-head">
          <div>
            <span>Task timeline</span>
            <h2>{taskTitle}</h2>
            <small className="task-timeline-head__card">{cardTitle || 'Current card'}</small>
          </div>
          <button type="button" onClick={onClose} aria-label="Close task timeline">
            <VscClose />
          </button>
        </div>

        <div className="task-timeline-list">
          <Row icon={<VscWatch />} title="Created" meta={formatDateTime(task.createdAt)} />

          <Row
            icon={<VscCalendar />}
            title={task.due ? `Current due date: ${dueLabel(task.due)}` : 'No current due date'}
            meta={dueChanges ? `${dueChanges} due-date change${dueChanges === 1 ? '' : 's'}` : 'No due-date changes recorded'}
          >
            {dueChanges > 0 && (
              <div className="task-timeline-sublist">
                {dueHistory.map((entry, index) => (
                  <div key={`${entry.changedAt}-${index}`}>
                    <span>{formatDateTime(entry.changedAt)}</span>
                    <strong>{dueLabel(entry.from)} → {dueLabel(entry.to)}</strong>
                  </div>
                ))}
              </div>
            )}
          </Row>

          <Row
            icon={<VscListFlat />}
            title="Moved from"
            meta={task.completedFromCardTitle || task.previousCardTitle || 'Not recorded'}
          />

          <Row
            icon={<VscCheck />}
            title={task.completedAt ? completionTimingLabel(task.completionTiming) : 'Not completed'}
            meta={task.completedAt ? formatDateTime(task.completedAt) : 'Completion date not recorded'}
          />
        </div>
      </div>
    </div>
  );
}

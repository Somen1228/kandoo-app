import { useEffect, useState } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { VscCheck, VscLinkExternal, VscWarning } from 'react-icons/vsc';

export const LINKED_TASK_REFRESH_EVENT = 'kandoo-linked-tasks-updated';

function LinkedTaskView({ node, extension }) {
  const { taskId, cardUid, label } = node.attrs;
  const readTask = () => extension.options.getTask?.(taskId, cardUid) || null;
  const [task, setTask] = useState(readTask);

  useEffect(() => {
    const refresh = () => setTask(readTask());
    window.addEventListener(LINKED_TASK_REFRESH_EVENT, refresh);
    refresh();
    return () => window.removeEventListener(LINKED_TASK_REFRESH_EVENT, refresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, cardUid]);

  const missing = !task;
  const done = Boolean(task?.done);
  const title = task?.text || label || 'Linked task';
  const due = task?.dueLabel;

  return (
    <NodeViewWrapper
      as="span"
      className={`linked-task-chip${done ? ' is-done' : ''}${missing ? ' is-missing' : ''}`}
      contentEditable={false}
      data-drag-handle
      data-linked-task-chip
    >
      <button
        type="button"
        className="linked-task-chip__check"
        title={done ? 'Mark task open' : 'Mark task done'}
        disabled={missing}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          extension.options.onToggle?.(taskId, cardUid);
        }}
      >
        {missing ? <VscWarning /> : done ? <VscCheck /> : <span aria-hidden="true">○</span>}
      </button>
      <button
        type="button"
        className="linked-task-chip__main"
        title={missing ? 'Linked task not found' : `Open ${task.cardTitle}`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (!missing) extension.options.onOpen?.(taskId, cardUid);
        }}
      >
        <span className="linked-task-chip__title">{title}</span>
        <span className="linked-task-chip__meta">
          {missing ? 'Missing task' : `${task.cardTitle}${due ? ` · ${due}` : ''}`}
        </span>
      </button>
      {!missing && <VscLinkExternal className="linked-task-chip__open" aria-hidden="true" />}
    </NodeViewWrapper>
  );
}

export const LinkedTask = Node.create({
  name: 'linkedTask',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addOptions() {
    return { getTask: null, onToggle: null, onOpen: null };
  },

  addAttributes() {
    return {
      taskId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-task-id'),
        renderHTML: (attrs) => (attrs.taskId ? { 'data-task-id': attrs.taskId } : {}),
      },
      cardUid: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-card-uid'),
        renderHTML: (attrs) => (attrs.cardUid ? { 'data-card-uid': attrs.cardUid } : {}),
      },
      label: {
        default: 'Linked task',
        parseHTML: (el) => el.getAttribute('data-label') || el.textContent || 'Linked task',
        renderHTML: (attrs) => ({ 'data-label': attrs.label || 'Linked task' }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-linked-task]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-linked-task': '' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(LinkedTaskView);
  },
});

export default LinkedTask;

import { useCallback, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { resolveCardColor } from '../../themes/cardPalettes';

const ANCHOR_SIDES = ['top', 'right', 'bottom', 'left'];

function FlowTextEditor({ node, onCommit, onDone }) {
  // Commit via a plain React onBlur prop on EditorContent, not TipTap's own
  // `onBlur` editor option — the latter fires from ProseMirror's internal
  // event dispatch outside React's normal event sequencing, which can land
  // mid-render under StrictMode's double-invoke and trigger "cannot update a
  // component while rendering" (matches the pattern NoteEditor.jsx uses).
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: 'Type here…' }),
    ],
    content: node.content || '',
    autofocus: 'end',
  });

  const commit = useCallback(() => {
    if (!editor) return;
    const html = editor.getHTML();
    // Defer to the next tick: onDone() unmounts this editor (editingNodeId
    // changes), which would otherwise call editor.destroy() synchronously
    // from inside the editor's own blur dispatch — ProseMirror's teardown
    // racing React's commit for the same DOM node is what was producing the
    // "cannot update a component while rendering" / runaway re-render.
    queueMicrotask(() => {
      onCommit(html);
      onDone();
    });
  }, [editor, onCommit, onDone]);

  return (
    <EditorContent
      editor={editor}
      className="flow-node__editor"
      onBlur={commit}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === 'Escape') { event.currentTarget.blur(); }
        event.stopPropagation();
      }}
    />
  );
}

export default function FlowNode({
  node, selected, isDark, zoom,
  onSelect, onMove, onResize, onCommitContent,
  onStartConnect, onContextMenu, isConnectTarget,
  editingNodeId, onStartEdit, onStopEdit,
}) {
  const dragRef = useRef(null);
  const resizeRef = useRef(null);
  const isEditing = editingNodeId === node.id;
  const colors = resolveCardColor(node.color, isDark);

  const handlePointerDown = useCallback((event) => {
    if (isEditing || event.button !== 0) return;
    event.stopPropagation();
    onSelect(node.id, event.shiftKey);
    dragRef.current = { startX: event.clientX, startY: event.clientY, startNodeX: node.x, startNodeY: node.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [isEditing, node.id, node.x, node.y, onSelect]);

  const handlePointerMove = useCallback((event) => {
    if (!dragRef.current) return;
    const dx = (event.clientX - dragRef.current.startX) / zoom;
    const dy = (event.clientY - dragRef.current.startY) / zoom;
    onMove(node.id, dragRef.current.startNodeX + dx, dragRef.current.startNodeY + dy);
  }, [node.id, onMove, zoom]);

  const handlePointerUp = useCallback((event) => {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const startResize = useCallback((event) => {
    event.stopPropagation();
    event.preventDefault();
    resizeRef.current = { startX: event.clientX, startY: event.clientY, startW: node.w, startH: node.h };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [node.w, node.h]);

  const doResize = useCallback((event) => {
    if (!resizeRef.current) return;
    const dx = (event.clientX - resizeRef.current.startX) / zoom;
    const dy = (event.clientY - resizeRef.current.startY) / zoom;
    onResize(node.id, Math.max(140, resizeRef.current.startW + dx), Math.max(70, resizeRef.current.startH + dy));
  }, [node.id, onResize, zoom]);

  const stopResize = useCallback((event) => {
    resizeRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  return (
    <div
      className={`flow-node${selected ? ' is-selected' : ''}${isEditing ? ' is-editing' : ''}${isConnectTarget ? ' is-connect-target' : ''}`}
      data-flow-node-id={node.id}
      style={{
        left: node.x, top: node.y, width: node.w, height: node.h,
        zIndex: node.zIndex || 0,
        '--flow-node-header': colors.header,
        '--flow-node-accent': colors.accent,
        '--flow-node-border': colors.tileBorder,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={(event) => { event.stopPropagation(); onStartEdit(node.id); }}
      onContextMenu={(event) => onContextMenu(event, node.id)}
    >
      <div className="flow-node__body">
        {isEditing ? (
          <FlowTextEditor
            node={node}
            onCommit={(html) => onCommitContent(node.id, html)}
            onDone={onStopEdit}
          />
        ) : (
          <div
            className="flow-node__static"
            dangerouslySetInnerHTML={{ __html: node.content || '<p class="flow-node__placeholder">Empty note — double-click to edit</p>' }}
          />
        )}
      </div>

      {selected && !isEditing && (
        <button
          type="button"
          className="flow-node__resize"
          title="Drag to resize"
          aria-label="Resize node"
          onPointerDown={startResize}
          onPointerMove={doResize}
          onPointerUp={stopResize}
          onPointerCancel={stopResize}
        />
      )}

      {selected && !isEditing && ANCHOR_SIDES.map((side) => (
        <span
          key={side}
          className={`flow-node__anchor flow-node__anchor--${side}`}
          onPointerDown={(event) => { event.stopPropagation(); onStartConnect(node.id, side, event); }}
        />
      ))}
    </div>
  );
}

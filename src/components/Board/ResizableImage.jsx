import { useRef } from 'react';
import Image from '@tiptap/extension-image';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const CROP_POSITIONS = [
  { label: 'Center', value: '50% 50%' },
  { label: 'Top', value: '50% 0%' },
  { label: 'Bottom', value: '50% 100%' },
  { label: 'Left', value: '0% 50%' },
  { label: 'Right', value: '100% 50%' },
];

function ResizableImageView({ node, updateAttributes, selected, editor }) {
  const resizeState = useRef(null);
  const width = Number(node.attrs.width) || 100;
  const cropRatio = node.attrs.cropRatio || '';
  const objectPosition = node.attrs.objectPosition || '50% 50%';

  const startResize = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const editorWidth = editor.view.dom.getBoundingClientRect().width;
    resizeState.current = { startX: event.clientX, startWidth: width, editorWidth };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const resize = (event) => {
    if (!resizeState.current) return;
    const { startX, startWidth, editorWidth } = resizeState.current;
    const next = startWidth + ((event.clientX - startX) / editorWidth) * 100;
    updateAttributes({ width: Math.round(clamp(next, 20, 100)) });
  };

  const stopResize = (event) => {
    resizeState.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <NodeViewWrapper className={`note-image-node${selected ? ' is-selected' : ''}`} contentEditable={false}>
      <div className="note-image-shell" style={{ width: `${width}%` }}>
        <div className={`note-image-frame${cropRatio ? ' is-cropped' : ''}`}
          style={cropRatio ? { aspectRatio: cropRatio } : undefined}>
          <img
            src={node.attrs.src}
            alt={node.attrs.alt || ''}
            title={node.attrs.title || undefined}
            draggable={false}
            style={cropRatio ? { objectPosition } : undefined}
          />
        </div>

        {selected && (
          <div className="note-image-tools" onMouseDown={(event) => {
            event.stopPropagation();
            if (!event.target.closest('select')) event.preventDefault();
          }}>
            <span className="note-image-tools__size">{width}%</span>
            <button type="button" className={!cropRatio ? 'is-active' : ''}
              onClick={() => updateAttributes({ cropRatio: '' })}>Fit</button>
            <select value={cropRatio} aria-label="Crop image ratio"
              onChange={(event) => updateAttributes({ cropRatio: event.target.value })}>
              <option value="">No crop</option>
              <option value="1 / 1">Crop 1:1</option>
              <option value="4 / 3">Crop 4:3</option>
              <option value="16 / 9">Crop 16:9</option>
              <option value="3 / 2">Crop 3:2</option>
            </select>
            {cropRatio && (
              <select value={objectPosition} aria-label="Crop focus"
                onChange={(event) => updateAttributes({ objectPosition: event.target.value })}>
                {CROP_POSITIONS.map((position) => (
                  <option key={position.value} value={position.value}>{position.label}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {selected && (
          <button
            type="button"
            className="note-image-resize"
            title="Drag to resize image"
            aria-label="Resize image"
            onPointerDown={startResize}
            onPointerMove={resize}
            onPointerUp={stopResize}
            onPointerCancel={stopResize}
          />
        )}
      </div>
    </NodeViewWrapper>
  );
}

export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: 100,
        parseHTML: (element) => Number(element.getAttribute('data-width')) || 100,
        renderHTML: (attributes) => ({ 'data-width': attributes.width }),
      },
      cropRatio: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-crop-ratio') || '',
        renderHTML: (attributes) => attributes.cropRatio
          ? { 'data-crop-ratio': attributes.cropRatio }
          : {},
      },
      objectPosition: {
        default: '50% 50%',
        parseHTML: (element) => element.getAttribute('data-object-position') || '50% 50%',
        renderHTML: (attributes) => ({ 'data-object-position': attributes.objectPosition }),
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },
});

export default ResizableImage;

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { VscFile, VscChevronRight } from 'react-icons/vsc';

// In-document reference to a child note/page. Clicking it navigates into that
// page. The displayed title is read live from the notes tree (via getTitle) so
// renames elsewhere stay in sync; data-title is only a stored fallback.
function PageLinkView({ node, extension }) {
  const uid = node.attrs.uid;
  const title = extension.options.getTitle?.(uid) || node.attrs.title || 'Untitled page';
  return (
    <NodeViewWrapper className="page-link-wrap" contentEditable={false} data-drag-handle>
      <button
        type="button"
        className="page-link"
        onClick={() => extension.options.onNavigate?.(uid)}
        title="Open page"
      >
        <VscFile className="page-link__icon" />
        <span className="page-link__title">{title}</span>
        <VscChevronRight className="page-link__chev" />
      </button>
    </NodeViewWrapper>
  );
}

export const PageLink = Node.create({
  name: 'pageLink',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addOptions() {
    return { getTitle: null, onNavigate: null };
  },

  addAttributes() {
    return {
      uid: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-uid'),
        renderHTML: (attrs) => (attrs.uid ? { 'data-uid': attrs.uid } : {}),
      },
      title: {
        default: 'Untitled page',
        parseHTML: (el) => el.getAttribute('data-title'),
        renderHTML: (attrs) => ({ 'data-title': attrs.title || 'Untitled page' }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-page-link]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-page-link': '' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(PageLinkView);
  },
});

export default PageLink;

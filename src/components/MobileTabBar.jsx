import { VscChecklist, VscNotebook, VscTypeHierarchy, VscAdd, VscEllipsis } from 'react-icons/vsc';

// Fixed bottom navigation for phones — the native app pattern that replaces the
// crammed desktop toolbar. Tasks / Notes switch sections; Add is the primary
// action; More opens the secondary-actions sheet.
export default function MobileTabBar({ section, onSection, onAdd, onMore }) {
  return (
    <nav className="mobile-tabbar" role="tablist" aria-label="Primary navigation">
      <button
        type="button"
        role="tab"
        aria-selected={section === 'todos'}
        className={`mobile-tab${section === 'todos' ? ' is-active' : ''}`}
        onClick={() => onSection('todos')}
      >
        <VscChecklist />
        <span>Tasks</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={section === 'notes'}
        className={`mobile-tab${section === 'notes' ? ' is-active' : ''}`}
        onClick={() => onSection('notes')}
      >
        <VscNotebook />
        <span>Notes</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={section === 'flow'}
        className={`mobile-tab${section === 'flow' ? ' is-active' : ''}`}
        onClick={() => onSection('flow')}
      >
        <VscTypeHierarchy />
        <span>Flow</span>
      </button>
      <button type="button" className="mobile-tab mobile-tab--add" onClick={onAdd} aria-label="Add">
        <VscAdd />
      </button>
      <button type="button" className="mobile-tab" onClick={onMore} aria-label="More options">
        <VscEllipsis />
        <span>More</span>
      </button>
    </nav>
  );
}

import { useContext } from "react";
import { CardsContext } from "../../contexts/CardsContext";

function DropdownMenu({ onEdit, onDelete }) {
  const { boards } = useContext(CardsContext);
  return (
    <div className="absolute right-8 mt-3 w-32 rounded shadow-lg z-20" style={{ background: 'var(--theme-bg-modal)', border: '1px solid var(--theme-border)' }}>
      <button
        onClick={onEdit}
        className="block w-full text-sm text-left px-2 py-2"
        style={{ color: 'var(--theme-text-primary)' }}
        onMouseEnter={(e) => e.target.style.background = 'var(--theme-bg-hover)'}
        onMouseLeave={(e) => e.target.style.background = 'transparent'}
      >
        Edit Board Title
      </button>
      { boards.length > 1 &&
        <button
        onClick={onDelete}
        className="block w-full text-sm text-left px-2 py-2"
        style={{ color: 'var(--theme-text-primary)' }}
        onMouseEnter={(e) => e.target.style.background = 'var(--theme-bg-hover)'}
        onMouseLeave={(e) => e.target.style.background = 'transparent'}
      >
        Delete Board
      </button>}
    </div>
  );
}

export default DropdownMenu;

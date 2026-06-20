import { useState, useEffect, useRef } from "react";

function WarningModal({ boardName, onDeleteConfirm, onCancel }) {
  const [inputValue, setInputValue] = useState("");
  const modalRef = useRef();

  const handleChange = (e) => {
    setInputValue(e.target.value);
  };

  const handleDelete = () => {
    if (inputValue === `delete ${boardName}`) {
      onDeleteConfirm();
    }
  };

  const handleClickOutside = (e) => {
    if (modalRef.current && !modalRef.current.contains(e.target)) {
      onCancel();
    }
  };

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'var(--theme-bg-overlay)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}>
      <div ref={modalRef} className="p-6 rounded shadow-lg z-60" style={{ background: 'var(--theme-bg-modal)', border: '1px solid var(--theme-border)' }}>
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--theme-text-primary)' }}>Delete Board</h2>
        <p className="mb-4" style={{ color: 'var(--theme-text-secondary)' }}>
          Are you sure you want to delete this board? This action cannot be
          undone.{" "}
        </p>
        <p className="mb-2" style={{ color: 'var(--theme-text-secondary)' }}>
          To confirm, type{" "}
          <span className="font-medium px-2 py-1 rounded-md" style={{
            color: 'var(--theme-danger)',
            background: 'var(--theme-danger-bg)',
          }}>
            delete {boardName}
          </span>{" "}
          below.
        </p>
        <input
          type="text"
          value={inputValue}
          onChange={handleChange}
          className={`p-2 w-full mb-4 drop-shadow-sm rounded`}
          style={{
            background: 'var(--theme-bg-input)',
            border: '1px solid var(--theme-border)',
            color: 'var(--theme-text-primary)',
          }}
        />
        <div className="flex justify-end">
          <button
            onClick={onCancel}
            className="font-bold py-2 px-4 rounded mr-2 transition"
            style={{ background: 'var(--theme-bg-hover)', color: 'var(--theme-text-primary)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            className="text-white font-bold py-2 px-4 rounded transition"
            style={{ background: 'var(--theme-danger)' }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default WarningModal;

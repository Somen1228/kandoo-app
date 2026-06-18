import { useState, useEffect, useRef } from "react";

function ResetWarningModal({ boardName, handleResetConfirm, handleCancel }) {
  const [inputValue, setInputValue] = useState("");
  const [animateIn, setAnimateIn] = useState(false);
  const modalRef = useRef(null);

  useEffect(() => {
    setAnimateIn(true);
  }, []);

  const handleChange = (e) => {
    setInputValue(e.target.value);
  };

  const handleReset = () => {
    if (inputValue === `reset ${boardName}`) {
      handleResetConfirm();
    }
  };

  const handleClickOutside = (e) => {
    if (modalRef.current && !modalRef.current.contains(e.target)) {
      handleCancel();
    }
  };

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
      <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm" style={{ background: 'var(--theme-bg-overlay)' }}>
        <div
            ref={modalRef}
            className={`w-[26rem] rounded-xl shadow-2xl p-6 transform transition-all duration-300
        ${animateIn ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}
            style={{ background: 'var(--theme-bg-modal)', border: '1px solid var(--theme-border)' }}
        >
          {/* icon */}
          <div className="flex justify-center mb-3">
            <span className="text-3xl">⚠️</span>
          </div>

          {/* title */}
          <h2 className="text-lg font-semibold text-center" style={{ color: 'var(--theme-text-primary)' }}>
            Reset Board
          </h2>

          {/* description */}
          <p className="text-sm text-center mt-2" style={{ color: 'var(--theme-text-secondary)' }}>
            This will remove all cards and tasks from the board.
          </p>

          {/* instruction */}
          <p className="text-sm mt-4" style={{ color: 'var(--theme-text-secondary)' }}>
            To confirm, type{" "}
            <span className="font-medium px-2 py-1 rounded-md" style={{
              color: 'var(--theme-danger)',
              background: 'var(--theme-danger-bg)',
            }}>
            reset {boardName}
          </span>{" "}
            below.
          </p>

          {/* input */}
          <input
              type="text"
              value={inputValue}
              onChange={handleChange}
              className="mt-3 p-2 w-full rounded-md focus:outline-none focus:ring-2"
              style={{
                background: 'var(--theme-bg-input)',
                border: '1px solid var(--theme-border)',
                color: 'var(--theme-text-primary)',
              }}
              placeholder={`reset ${boardName}`}
          />

          {/* actions */}
          <div className="flex justify-end gap-3 mt-6">
            <button
                onClick={handleCancel}
                className="px-5 py-2 rounded-lg text-sm font-medium transition"
                style={{ background: 'var(--theme-bg-hover)', color: 'var(--theme-text-primary)' }}
            >
              Cancel
            </button>

            <button
                onClick={handleReset}
                className={`px-5 py-2 rounded-lg text-white text-sm font-medium transition`}
                style={{
                  background: inputValue === `reset ${boardName}` ? 'var(--theme-danger)' : 'var(--theme-danger-light)',
                  cursor: inputValue === `reset ${boardName}` ? 'pointer' : 'not-allowed',
                }}
            >
              Reset
            </button>
          </div>
        </div>
      </div>
  );
}

export default ResetWarningModal;
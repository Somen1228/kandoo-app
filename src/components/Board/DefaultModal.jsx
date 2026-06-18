import { useEffect, useState } from "react";
import ReactDOM from "react-dom";

function DefaultModal({ setDefaultModal }) {
    const [animateIn, setAnimateIn] = useState(false);

    useEffect(() => {
        // trigger enter animation
        setAnimateIn(true);
    }, []);

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm" style={{ background: 'var(--theme-bg-overlay)' }}>
            <div
                className={`w-[22rem] rounded-xl shadow-2xl p-6 transform transition-all duration-300
        ${animateIn ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}
                style={{ background: 'var(--theme-bg-modal)', border: '1px solid var(--theme-border)' }}
            >
                {/* icon */}
                <div className="flex justify-center mb-3">
                    <span className="text-3xl">⚠️</span>
                </div>

                {/* text */}
                <h2 className="text-lg font-semibold text-center" style={{ color: 'var(--theme-text-primary)' }}>
                    Card is empty
                </h2>
                <p className="text-sm text-center mt-1" style={{ color: 'var(--theme-text-secondary)' }}>
                    There are no tasks to delete in this card.
                </p>

                {/* action */}
                <div className="flex justify-center mt-6">
                    <button
                        onClick={() => setDefaultModal(false)}
                        className="px-6 py-2 rounded-lg text-white text-sm font-medium active:scale-95 transition"
                        style={{ background: 'var(--theme-accent)' }}
                    >
                        Go back
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

export default DefaultModal;
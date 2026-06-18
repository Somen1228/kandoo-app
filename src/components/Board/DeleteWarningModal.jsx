import { useEffect, useState } from "react";
import ReactDOM from "react-dom";

function DeleteWarningModal({
                                index,
                                updateCardTasks,
                                setShowDeleteWarning,
                                toDelete,
                                updateCards,
                            }) {
    const [animateIn, setAnimateIn] = useState(false);

    useEffect(() => {
        setAnimateIn(true);
    }, []);

    const toDeleteText = toDelete === "card" ? "this card" : "all tasks";

    const onDeleteConfirm = () => {
        if (toDelete === "card") {
            updateCards((prev) => prev.filter((_, i) => i !== index));
        } else if (toDelete === "tasks") {
            updateCardTasks(index, {});
        }

        setShowDeleteWarning(false);
    };

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm" style={{ background: 'var(--theme-bg-overlay)' }}>
            <div
                className={`w-[24rem] rounded-xl shadow-2xl p-6 transform transition-all duration-300
        ${animateIn ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}
                style={{ background: 'var(--theme-bg-modal)', border: '1px solid var(--theme-border)' }}
            >
                {/* icon */}
                <div className="flex justify-center mb-3">
                    <span className="text-3xl">⚠️</span>
                </div>

                {/* title */}
                <h2 className="text-lg font-semibold text-center" style={{ color: 'var(--theme-text-primary)' }}>
                    Delete {toDeleteText}
                </h2>

                {/* description */}
                <p className="text-sm text-center mt-2" style={{ color: 'var(--theme-text-secondary)' }}>
                    Are you sure you want to delete {toDeleteText}?
                </p>

                {/* actions */}
                <div className="flex justify-center gap-3 mt-6">
                    <button
                        onClick={() => setShowDeleteWarning(false)}
                        className="px-5 py-2 rounded-lg text-sm font-medium transition"
                        style={{ background: 'var(--theme-bg-hover)', color: 'var(--theme-text-primary)' }}
                    >
                        Cancel
                    </button>

                    <button
                        onClick={onDeleteConfirm}
                        className="px-5 py-2 rounded-lg text-white text-sm font-medium active:scale-95 transition"
                        style={{ background: 'var(--theme-danger)' }}
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

export default DeleteWarningModal;
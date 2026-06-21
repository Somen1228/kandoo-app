import { forwardRef, useEffect, useState } from "react";
import { VscChecklist, VscNote, VscArrowLeft } from "react-icons/vsc";

// Two-step add-card flow:
//   step 1: pick card type (To-do / Note)
//   step 2: title + colour (existing form)
const Modal = forwardRef(({ addCard, cards, initialType = null }, ref) => {
  // When `initialType` is passed in, skip the picker — the section tabs
  // already established what type of card we're adding.
  const [step, setStep] = useState(initialType ? 'details' : 'type');
  const [type, setType] = useState(initialType);      // 'todo' | 'note'
  const [cardTitle, setCardTitle] = useState("");
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);

  const isNote = type === 'note';

  const handleAddCard = () => {
    if (cardTitle.trim() === "") {
      setShowDuplicateWarning(true);
    } else if (cards.some((c) => c.title.toLowerCase() === cardTitle.toLowerCase())) {
      setShowDuplicateWarning(true);
    } else {
      // Colour is auto-assigned (random hue from the theme palette).
      addCard(cardTitle, undefined, type);
      setCardTitle("");
      setShowDuplicateWarning(false);
    }
  };

  const handleNewCardName = (e) => {
    setCardTitle(e.target.value);
    setShowDuplicateWarning(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && step === 'details') handleAddCard();
  };

  useEffect(() => {
    const handleKeyDown = (e) => handleKeyPress(e);
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardTitle, step]);

  const pickType = (t) => {
    setType(t);
    setStep('details');
  };

  const TypeTile = ({ icon, title, description, onClick }) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        padding: '18px 14px',
        borderRadius: '0.5rem',
        border: '1px solid var(--theme-border)',
        background: 'var(--theme-bg-input)',
        color: 'var(--theme-text-primary)',
        cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
        transition: 'transform 0.12s, background 0.12s, border-color 0.12s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--theme-accent)'; e.currentTarget.style.background = 'var(--theme-bg-hover)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--theme-border)'; e.currentTarget.style.background = 'var(--theme-bg-input)'; }}
    >
      <span style={{ fontSize: '1.75rem', color: 'var(--theme-accent)', display: 'flex' }}>{icon}</span>
      <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{title}</span>
      <span style={{ fontSize: '0.7rem', color: 'var(--theme-text-muted)', textAlign: 'center', lineHeight: 1.3 }}>{description}</span>
    </button>
  );

  return (
    <div className="fixed inset-0 flex items-center justify-center z-20" style={{ background: 'var(--theme-bg-overlay)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}>
      <div
        ref={ref}
        className="px-4 pt-4 pb-4 rounded shadow-lg"
        style={{
          background: 'var(--theme-bg-modal)',
          border: '1px solid var(--theme-border)',
          width: step === 'type' ? '22rem' : '20rem',
        }}
      >
        {step === 'type' ? (
          <>
            <div className="text-center pb-2">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--theme-text-primary)' }}>
                What kind of card?
              </h3>
              <p className="text-xs mt-1" style={{ color: 'var(--theme-text-muted)' }}>
                Pick a format to get started.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <TypeTile
                icon={<VscChecklist />}
                title="To-do"
                description="Classic kanban column with task tiles"
                onClick={() => pickType('todo')}
              />
              <TypeTile
                icon={<VscNote />}
                title="Note"
                description="Free-form rich text notes with images"
                onClick={() => pickType('note')}
              />
            </div>
          </>
        ) : (
          <>
            {/* Back button + type indicator */}
            <div className="flex items-center justify-between mb-2">
              {initialType ? (
                <span /> /* spacer so type-indicator aligns right */
              ) : (
                <button
                  type="button"
                  onClick={() => { setStep('type'); setType(null); }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--theme-text-muted)', fontSize: '0.78rem',
                    display: 'flex', alignItems: 'center', gap: 4, padding: 0,
                  }}
                >
                  <VscArrowLeft /> Back
                </button>
              )}
              <span style={{
                fontSize: '0.7rem', padding: '2px 8px', borderRadius: 999,
                background: 'var(--theme-bg-hover)', color: 'var(--theme-text-secondary)',
                display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 500,
              }}>
                {type === 'note' ? <><VscNote /> Note</> : <><VscChecklist /> To-do</>}
              </span>
            </div>

            <input
              className="w-full h-10 resize-none text-sm p-2 rounded-md drop-shadow-lg focus:outline-none font-normal"
              style={{
                background: 'var(--theme-bg-input)',
                color: 'var(--theme-text-primary)',
                border: '1px solid var(--theme-border)',
              }}
              placeholder={type === 'note' ? "Title for your note..." : "Title for your column..."}
              value={cardTitle}
              onChange={handleNewCardName}
              autoFocus
            />
            {showDuplicateWarning && (
              <div className="px-4 py-3 rounded relative mt-2" role="alert" style={{
                background: 'var(--theme-danger-bg)',
                border: '1px solid var(--theme-danger)',
                color: 'var(--theme-danger)',
              }}>
                <span className="block sm:inline text-sm">
                  The name &quot;{cardTitle}&quot; is either invalid or already in use on this board. Please provide a unique and valid name for your card.
                </span>
              </div>
            )}
            <div className="flex flex-col items-center mt-4">
              {!isNote && (
                <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                  A colour is picked for you — change it anytime from the card menu.
                </p>
              )}
              <div className="mt-4 w-full flex justify-end">
                <button
                  onClick={handleAddCard}
                  className="w-full h-10 font-medium rounded-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: 'var(--theme-accent)', color: 'white' }}
                  disabled={!cardTitle || showDuplicateWarning}
                >
                  Create {type === 'note' ? 'Note' : 'To-do'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
});

Modal.displayName = "Modal";

export default Modal;

import { useState, useEffect } from 'react';
import { VscClose, VscChevronLeft, VscChevronRight } from 'react-icons/vsc';

function ImageModal({ images, initialIndex = 0, onClose }) {
  const [idx, setIdx] = useState(initialIndex);
  const multi = images.length > 1;

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (!multi) return;
      if (e.key === 'ArrowLeft')  setIdx(i => (i - 1 + images.length) % images.length);
      if (e.key === 'ArrowRight') setIdx(i => (i + 1) % images.length);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, multi, images.length]);

  const btnStyle = {
    background: 'rgba(255,255,255,0.12)',
    border: 'none',
    borderRadius: '50%',
    color: 'white',
    fontSize: '1.4rem',
    width: '2.5rem',
    height: '2.5rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 3000,
        background: 'rgba(0,0,0,0.88)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {/* Close */}
      <button onClick={onClose} style={{ ...btnStyle, position: 'absolute', top: '1rem', right: '1rem' }}>
        <VscClose />
      </button>

      {/* Counter */}
      {multi && (
        <span style={{ position: 'absolute', top: '1.125rem', left: '1rem', color: 'rgba(255,255,255,0.65)', fontSize: '0.8rem' }}>
          {idx + 1} / {images.length}
        </span>
      )}

      {/* Prev */}
      {multi && (
        <button
          onClick={e => { e.stopPropagation(); setIdx(i => (i - 1 + images.length) % images.length); }}
          style={{ ...btnStyle, position: 'absolute', left: '1rem' }}
        >
          <VscChevronLeft />
        </button>
      )}

      {/* Image */}
      <img
        src={images[idx]}
        alt={`Attachment ${idx + 1}`}
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '88vw', maxHeight: '84vh', objectFit: 'contain', borderRadius: '0.5rem', boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }}
      />

      {/* Next */}
      {multi && (
        <button
          onClick={e => { e.stopPropagation(); setIdx(i => (i + 1) % images.length); }}
          style={{ ...btnStyle, position: 'absolute', right: '1rem' }}
        >
          <VscChevronRight />
        </button>
      )}

      {/* Dot indicators */}
      {multi && (
        <div style={{ position: 'absolute', bottom: '1rem', display: 'flex', gap: '6px' }}>
          {images.map((_, i) => (
            <button
              key={i}
              onClick={e => { e.stopPropagation(); setIdx(i); }}
              style={{
                width: '8px', height: '8px', borderRadius: '50%', border: 'none', padding: 0, cursor: 'pointer',
                background: i === idx ? 'white' : 'rgba(255,255,255,0.35)',
                transition: 'background 0.2s',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default ImageModal;

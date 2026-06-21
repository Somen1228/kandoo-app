import { useState, useEffect, useRef } from 'react';
import { VscClose, VscBug, VscLightbulb, VscCommentDiscussion } from 'react-icons/vsc';
import { toast } from '../utils/toast';

const CATEGORIES = [
  { id: 'bug',     label: 'Bug Report',      icon: VscBug },
  { id: 'feature', label: 'Feature Request', icon: VscLightbulb },
  { id: 'general', label: 'General Feedback', icon: VscCommentDiscussion },
];

export default function FeedbackModal({ isOpen, onClose }) {
  const [category, setCategory] = useState('general');
  const [message, setMessage]   = useState('');
  const overlayRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setMessage('');
      setCategory('general');
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const fn = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!message.trim()) {
      toast.warning('Please write something before sending.');
      return;
    }
    const categoryLabel = CATEGORIES.find(c => c.id === category)?.label || category;
    const subject = encodeURIComponent(`Kandoo Feedback — ${categoryLabel}`);
    const body = encodeURIComponent(`Category: ${categoryLabel}\n\n${message.trim()}`);
    window.open(`mailto:somen1228@gmail.com?subject=${subject}&body=${body}`, '_blank');
    toast.success('Opening your mail client…');
    onClose();
  };

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 3000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.35)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
    >
      <div style={{
        width: 500,
        background: 'var(--theme-bg-modal)',
        border: '1px solid var(--theme-border)',
        borderRadius: 16,
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 20px 14px',
          borderBottom: '1px solid var(--theme-border)',
        }}>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--theme-text-primary)' }}>
              Send Feedback
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--theme-text-muted)', marginTop: 2 }}>
              Help us make Kandoo better
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-text-muted)', fontSize: '1.1rem', display: 'flex', padding: 4, borderRadius: 6 }}
          >
            <VscClose />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Category pills */}
          <div style={{ display: 'flex', gap: 8}}>
            {CATEGORIES.map(c => {
              const Icon = c.icon;
              const active = category === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  style={{
                    flex: 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                    padding: '7px 10px',
                    borderRadius: 20,
                    border: `1.5px solid ${active ? 'var(--theme-accent)' : 'var(--theme-border)'}`,
                    background: active ? 'var(--theme-accent)' : 'transparent',
                    color: active ? '#fff' : 'var(--theme-text-secondary)',
                    fontSize: '0.78rem', fontWeight: 600,
                    cursor: 'pointer', transition: 'all 0.15s',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = 'var(--theme-accent)'; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = 'var(--theme-border)'; }}
                >
                  <Icon style={{ fontSize: '0.95em', flexShrink: 0 }} />
                  {c.label}
                </button>
              );
            })}
          </div>

          {/* Message */}
          <textarea
            ref={textareaRef}
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="What's on your mind? Describe the bug, idea, or anything else…"
            rows={5}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'var(--theme-bg-input)',
              border: '1px solid var(--theme-border)',
              borderRadius: 10,
              color: 'var(--theme-text-primary)',
              fontSize: '0.875rem',
              fontFamily: 'inherit',
              lineHeight: 1.6,
              padding: '10px 12px',
              resize: 'none',
              outline: 'none',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--theme-accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--theme-border)'}
          />

          <div style={{ fontSize: '0.75rem', color: 'var(--theme-text-muted)' }}>
            This will open your mail client with your feedback pre-filled.
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', gap: 10, justifyContent: 'flex-end',
          padding: '0 20px 18px',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 18px', borderRadius: 8,
              border: '1.5px solid var(--theme-border)',
              background: 'transparent', color: 'var(--theme-text-secondary)',
              fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            style={{
              padding: '8px 22px', borderRadius: 8,
              border: 'none',
              background: 'var(--theme-accent)', color: '#fff',
              fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
              boxShadow: '0 2px 8px color-mix(in srgb, var(--theme-accent) 40%, transparent)',
            }}
          >
            Send Feedback
          </button>
        </div>
      </div>
    </div>
  );
}

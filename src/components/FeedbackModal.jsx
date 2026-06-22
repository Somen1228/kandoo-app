import { useState, useEffect, useRef } from 'react';
import { VscClose, VscBug, VscLightbulb, VscCommentDiscussion } from 'react-icons/vsc';
import { toast } from '../utils/toast';
import { useAuth } from '../contexts/AuthContext';

const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

const CATEGORIES = [
  { id: 'bug',     label: 'Bug Report',      icon: VscBug },
  { id: 'feature', label: 'Feature Request', icon: VscLightbulb },
  { id: 'general', label: 'General Feedback', icon: VscCommentDiscussion },
];

// Web3Forms delivers the submission straight to the owner's inbox — no backend,
// works in both the web build and the Tauri webview (a plain fetch, unlike
// mailto: which the webview swallows). The access key is a public submit key.
const WEB3FORMS_ENDPOINT = 'https://api.web3forms.com/submit';
const WEB3FORMS_ACCESS_KEY = import.meta.env.VITE_WEB3FORMS_ACCESS_KEY?.trim() || '';

export default function FeedbackModal({ isOpen, onClose }) {
  const { user } = useAuth();
  const [category, setCategory] = useState('general');
  const [message, setMessage]   = useState('');
  const [email, setEmail]       = useState('');
  const [sending, setSending]   = useState(false);
  const overlayRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setMessage('');
      setCategory('general');
      setEmail(user?.email || ''); // pre-fill for signed-in users; guests can type one
      setSending(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [isOpen, user?.email]);

  useEffect(() => {
    if (!isOpen) return;
    const fn = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (sending) return;
    if (!message.trim()) {
      toast.warning('Please write something before sending.');
      return;
    }
    if (!WEB3FORMS_ACCESS_KEY) {
      toast.error('Feedback isn’t configured yet (missing access key).');
      return;
    }
    const contactEmail = email.trim();
    if (contactEmail && !isValidEmail(contactEmail)) {
      toast.warning('That email doesn’t look right — fix it or clear it.');
      return;
    }
    const categoryLabel = CATEGORIES.find(c => c.id === category)?.label || category;
    setSending(true);
    try {
      const res = await fetch(WEB3FORMS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          access_key: WEB3FORMS_ACCESS_KEY,
          subject: `Kandoo Feedback — ${categoryLabel}`,
          from_name: user?.displayName || contactEmail || 'Kandoo Feedback',
          // Reply-To so you can answer the sender straight from your inbox.
          ...(contactEmail ? { email: contactEmail, replyto: contactEmail } : {}),
          category: categoryLabel,
          sender_account: user ? `${user.displayName || ''} <${user.email || ''}> (uid: ${user.uid})` : 'Guest (not signed in)',
          message: message.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        toast.success('Thanks! Your feedback was sent.');
        onClose();
      } else {
        toast.error(data.message || 'Could not send feedback. Please try again.');
      }
    } catch {
      toast.error('Network error — could not send feedback. Please try again.');
    } finally {
      setSending(false);
    }
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

          {/* Reply-to email — pre-filled when signed in, optional for guests */}
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Your email (optional, so we can reply)"
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'var(--theme-bg-input)',
              border: '1px solid var(--theme-border)',
              borderRadius: 10,
              color: 'var(--theme-text-primary)',
              fontSize: '0.875rem',
              fontFamily: 'inherit',
              padding: '9px 12px',
              outline: 'none',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--theme-accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--theme-border)'}
          />

          <div style={{ fontSize: '0.75rem', color: 'var(--theme-text-muted)' }}>
            {email.trim()
              ? 'We’ll reply to the email above.'
              : 'Add your email if you’d like a reply — otherwise it’s anonymous.'}
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
            disabled={sending}
            style={{
              padding: '8px 22px', borderRadius: 8,
              border: 'none',
              background: 'var(--theme-accent)', color: '#fff',
              fontSize: '0.875rem', fontWeight: 600,
              cursor: sending ? 'default' : 'pointer',
              opacity: sending ? 0.7 : 1,
              boxShadow: '0 2px 8px color-mix(in srgb, var(--theme-accent) 40%, transparent)',
            }}
          >
            {sending ? 'Sending…' : 'Send Feedback'}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useContext, useState } from 'react';
import { createPortal } from 'react-dom';
import { VscClose, VscCheck } from 'react-icons/vsc';
import { CardsContext } from '../../contexts/CardsContext';

function TaskSide({ label, task, selected, onPick }) {
  return (
    <button
      onClick={onPick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.375rem',
        padding: '0.75rem 0.875rem',
        background: selected
          ? 'color-mix(in srgb, var(--theme-accent) 14%, var(--theme-bg-primary))'
          : 'var(--theme-bg-primary)',
        border: 'none',
        outline: selected ? '2px solid var(--theme-accent)' : '2px solid transparent',
        outlineOffset: '-2px',
        cursor: 'pointer',
        textAlign: 'left',
        flex: 1,
        minWidth: 0,
        transition: 'background 0.12s',
      }}
    >
      {/* side label */}
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.3rem',
        fontSize: '0.67rem',
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: selected ? 'var(--theme-accent)' : 'var(--theme-text-muted)',
      }}>
        {selected && <VscCheck style={{ fontSize: '0.8rem' }} />}
        {label}
      </span>

      {/* task text */}
      <span style={{
        fontSize: '0.82rem',
        color: 'var(--theme-text-primary)',
        lineHeight: 1.5,
        wordBreak: 'break-word',
        display: 'block',
      }}>
        {typeof task?.value === 'string' && task.value.trim()
          ? task.value
          : <em style={{ color: 'var(--theme-text-muted)', fontStyle: 'italic' }}>(empty)</em>
        }
      </span>

      {/* metadata badges */}
      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.1rem' }}>
        {task?.done && (
          <span style={{
            fontSize: '0.64rem', fontWeight: 600,
            padding: '1px 7px', borderRadius: '999px',
            background: 'color-mix(in srgb, #10b981 18%, transparent)',
            color: '#10b981',
          }}>Done</span>
        )}
        {task?.due && (
          <span style={{
            fontSize: '0.64rem', fontWeight: 500,
            padding: '1px 7px', borderRadius: '999px',
            background: 'var(--theme-bg-hover)',
            color: 'var(--theme-text-muted)',
          }}>Due {task.due}</span>
        )}
        {task?.images?.length > 0 && (
          <span style={{
            fontSize: '0.64rem', fontWeight: 500,
            padding: '1px 7px', borderRadius: '999px',
            background: 'var(--theme-bg-hover)',
            color: 'var(--theme-text-muted)',
          }}>{task.images.length} image{task.images.length !== 1 ? 's' : ''}</span>
        )}
      </div>
    </button>
  );
}

function ConflictRow({ conflict, choice, onPick }) {
  return (
    <div style={{
      borderRadius: '0.75rem',
      border: `1px solid ${choice ? 'var(--theme-accent)' : 'var(--theme-border)'}`,
      overflow: 'hidden',
      background: 'var(--theme-bg-card)',
      transition: 'border-color 0.15s',
    }}>
      {/* context breadcrumb */}
      <div style={{
        padding: '0.4rem 0.875rem',
        background: 'var(--theme-bg-hover)',
        borderBottom: '1px solid var(--theme-border)',
        fontSize: '0.7rem',
        color: 'var(--theme-text-muted)',
        letterSpacing: '0.02em',
      }}>
        <span style={{ color: 'var(--theme-text-secondary)', fontWeight: 500 }}>
          {conflict.boardTitle || 'Board'}
        </span>
        <span style={{ margin: '0 0.35rem', opacity: 0.5 }}>›</span>
        <span>{conflict.colTitle || 'Column'}</span>
      </div>

      {/* side-by-side picker */}
      <div style={{ display: 'flex' }}>
        <TaskSide
          label="This device"
          task={conflict.local}
          selected={choice === 'local'}
          onPick={() => onPick('local')}
        />
        <div style={{ width: 1, background: 'var(--theme-border)', flexShrink: 0 }} />
        <TaskSide
          label="Cloud"
          task={conflict.cloud}
          selected={choice === 'cloud'}
          onPick={() => onPick('cloud')}
        />
      </div>
    </div>
  );
}

export default function TaskConflictModal() {
  const { pendingMerge, resolveTaskConflicts, cancelMerge } = useContext(CardsContext);
  const [choices, setChoices] = useState({});
  const [applying, setApplying] = useState(false);

  if (!pendingMerge) return null;
  const { conflicts } = pendingMerge;

  const resolvedCount = conflicts.filter(c => choices[c.key]).length;
  const allResolved = resolvedCount === conflicts.length;

  const pick = (key, side) => setChoices(prev => ({ ...prev, [key]: side }));

  const apply = async () => {
    if (!allResolved || applying) return;
    setApplying(true);
    await resolveTaskConflicts(choices);
    setApplying(false);
  };

  // Escape key to cancel
  const onKeyDown = (e) => { if (e.key === 'Escape') cancelMerge(); };

  return createPortal(
    <div
      onKeyDown={onKeyDown}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.35)',
        backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
        zIndex: 4500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
    >
      <div style={{
        background: 'var(--theme-bg-modal)',
        border: '1px solid var(--theme-border)',
        borderRadius: '1rem',
        boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
        width: '100%',
        maxWidth: 640,
        maxHeight: '82vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>

        {/* header */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          padding: '1.125rem 1.25rem 0.875rem',
          borderBottom: '1px solid var(--theme-border)',
          flexShrink: 0,
          gap: '0.75rem',
        }}>
          <div>
            <div style={{
              fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: 'var(--theme-text-muted)',
              marginBottom: '0.25rem',
            }}>
              Merge conflict · {conflicts.length} task{conflicts.length !== 1 ? 's' : ''}
            </div>
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--theme-text-primary)' }}>
              Choose a version for each task
            </h2>
            <p style={{ margin: '0.3rem 0 0', fontSize: '0.76rem', color: 'var(--theme-text-muted)', lineHeight: 1.5 }}>
              These tasks were edited on both this device and the cloud.
              Pick which version to keep — everything else merges automatically.
            </p>
          </div>
          <button
            onClick={cancelMerge}
            title="Cancel merge"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28, borderRadius: '50%',
              background: 'var(--theme-bg-hover)',
              border: '1px solid var(--theme-border)',
              color: 'var(--theme-text-muted)',
              cursor: 'pointer', flexShrink: 0,
              fontSize: '0.9rem',
            }}
          >
            <VscClose />
          </button>
        </div>

        {/* conflict list */}
        <div style={{
          overflowY: 'auto',
          padding: '0.875rem 1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.625rem',
          flex: 1,
        }}>
          {conflicts.map(conflict => (
            <ConflictRow
              key={conflict.key}
              conflict={conflict}
              choice={choices[conflict.key]}
              onPick={(side) => pick(conflict.key, side)}
            />
          ))}
        </div>

        {/* footer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1.25rem',
          borderTop: '1px solid var(--theme-border)',
          flexShrink: 0,
          gap: '0.75rem',
        }}>
          <span style={{ fontSize: '0.74rem', color: 'var(--theme-text-muted)' }}>
            {resolvedCount} of {conflicts.length} resolved
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={cancelMerge}
              className="settings-btn"
              style={{ fontSize: '0.8rem' }}
            >
              Cancel
            </button>
            <button
              onClick={apply}
              disabled={!allResolved || applying}
              className="settings-btn settings-btn--primary"
              style={{ fontSize: '0.8rem', opacity: allResolved ? 1 : 0.45, cursor: allResolved ? 'pointer' : 'not-allowed' }}
            >
              {applying ? 'Applying…' : 'Apply merge'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

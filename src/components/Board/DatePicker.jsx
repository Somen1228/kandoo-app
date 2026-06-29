import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { composeDue, formatDueShort, getDueDatePart, getDueTimePart, toDueString, parseDue } from '../../utils/dueDate';
import { VscCalendar, VscClose, VscChevronLeft, VscChevronRight } from 'react-icons/vsc';

const DAYS    = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS  = ['January','February','March','April','May','June',
                 'July','August','September','October','November','December'];

const NAV_BTN = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--theme-text-muted)', padding: '4px 6px',
  borderRadius: 6, display: 'flex', alignItems: 'center', fontSize: '1rem',
  lineHeight: 1,
};

function todayStr()    { return toDueString(new Date()); }
function tomorrowStr() {
  const d = new Date(); d.setDate(d.getDate() + 1); return toDueString(d);
}

export default function DatePicker({ value, onChange, onPointerDown, style = {}, triggerClassName = '', tone = null }) {
  const [open, setOpen]           = useState(false);
  const [pending, setPending]     = useState(value || '');
  const [viewYear, setViewYear]   = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [popPos, setPopPos]       = useState({ top: 0, left: 0 });

  const triggerRef = useRef(null);

  const computePos = () => {
    if (!triggerRef.current) return;
    const r  = triggerRef.current.getBoundingClientRect();
    const PW = 280;
    setPopPos({
      top:  r.bottom + 6,
      left: Math.min(r.left, window.innerWidth - PW - 12),
    });
  };

  const openPicker = (e) => {
    e.stopPropagation();
    const cur = parseDue(value);
    if (cur) { setViewYear(cur.getFullYear()); setViewMonth(cur.getMonth()); }
    else     { const n = new Date(); setViewYear(n.getFullYear()); setViewMonth(n.getMonth()); }
    setPending(value || '');
    computePos();
    setOpen(true);
  };

  // Close on outside click + reposition on scroll/resize while open
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const id = setTimeout(() => document.addEventListener('click', close), 0);
    const reposition = () => computePos();
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      clearTimeout(id);
      document.removeEventListener('click', close);
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open]);

  const done   = () => { onChange(pending); setOpen(false); };
  const cancel = () => { setPending(value || ''); setOpen(false); };
  const quick  = (str) => { onChange(str); setOpen(false); };
  const clear  = (e) => { e.stopPropagation(); onChange(''); };

  const prevMonth = () => setViewMonth(m => {
    if (m === 0) { setViewYear(y => y - 1); return 11; } return m - 1;
  });
  const nextMonth = () => setViewMonth(m => {
    if (m === 11) { setViewYear(y => y + 1); return 0; } return m + 1;
  });

  // Build calendar cells
  const firstDow     = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth  = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null); // empty leading slots
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  // pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  const TODAY_STR    = todayStr();
  const TOMORROW_STR = tomorrowStr();
  const pendingDate  = getDueDatePart(pending);
  const pendingTime  = getDueTimePart(pending);

  const parsed    = parseDue(value);
  const labelText = parsed ? formatDueShort(value) : null;

  const setDatePart = (datePart) => setPending(composeDue(datePart, pendingTime) || '');
  const setTimePart = (timePart) => {
    const datePart = pendingDate || TODAY_STR;
    setPending(composeDue(datePart, timePart) || datePart);
  };
  const clearTime = () => {
    if (!pendingDate) return;
    setPending(pendingDate);
  };

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 4, ...style }}
      onPointerDown={onPointerDown}
    >
      {/* ── Trigger ── */}
      <button
        ref={triggerRef}
        type="button"
        onClick={openPicker}
        className={`mac-due-trigger${labelText ? ' has-date' : ''}${triggerClassName ? ` ${triggerClassName}` : ''}`}
        data-tone={tone || undefined}
        aria-label="Set due date"
      >
        <VscCalendar />
        <span>{labelText || 'Due date'}</span>
      </button>

      {value && (
        <button
          type="button"
          className="mac-due-row__clear"
          onClick={clear}
          aria-label="Clear due date"
        >
          <VscClose />
        </button>
      )}

      {/* Popover portal */}
      {open && createPortal(
        <div
          className="mac-date-popover"
          style={{
            position: 'fixed',
            top: popPos.top,
            left: popPos.left,
            zIndex: 10100,
            width: 280,
            background: 'var(--theme-bg-card)',
            border: '1px solid var(--theme-border)',
            borderRadius: 16,
            boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
            fontFamily: 'inherit',
            userSelect: 'none',
          }}
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
          onPointerDown={e => e.stopPropagation()}
        >
            {/* Quick chips */}
            <div style={{ display: 'flex', gap: 8, padding: '14px 14px 0' }}>
              {[
                { label: 'Today',    str: TODAY_STR },
                { label: 'Tomorrow', str: TOMORROW_STR },
              ].map(({ label, str }) => {
                const active = pendingDate === str;
                return (
                  <button
                    key={label}
                    type="button"
                    onMouseDown={e => e.stopPropagation()}
                    onClick={() => quick(composeDue(str, pendingTime) || str)}
                    style={{
                      flex: 1, padding: '7px 0',
                      borderRadius: 20,
                      border: `1.5px solid ${active ? 'var(--theme-accent)' : 'var(--theme-border)'}`,
                      background: active ? 'var(--theme-accent)' : 'transparent',
                      color: active ? '#fff' : 'var(--theme-text-primary)',
                      fontSize: '0.8125rem', fontWeight: 600,
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Month navigation */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '10px 10px 6px' }}>
              <button type="button" onMouseDown={e => e.stopPropagation()} onClick={prevMonth} style={NAV_BTN}><VscChevronLeft /></button>
              <span style={{
                flex: 1, textAlign: 'center',
                fontSize: '0.875rem', fontWeight: 700,
                color: 'var(--theme-text-primary)',
              }}>
                {MONTHS[viewMonth]} {viewYear}
              </span>
              <button type="button" onMouseDown={e => e.stopPropagation()} onClick={nextMonth} style={NAV_BTN}><VscChevronRight /></button>
            </div>

            {/* Day-of-week headers */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
              padding: '0 10px 2px', textAlign: 'center',
            }}>
              {DAYS.map((d, i) => (
                <div key={i} style={{
                  fontSize: '0.68rem', fontWeight: 700,
                  color: 'var(--theme-text-muted)', padding: '2px 0',
                }}>{d}</div>
              ))}
            </div>

            {/* Calendar grid */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
              padding: '0 10px 6px', gap: 1,
            }}>
              {cells.map((day, i) => {
                if (!day) return <div key={i} />;
                const cellStr    = toDueString(new Date(viewYear, viewMonth, day));
                const isSelected = pendingDate === cellStr;
                const isToday    = cellStr === TODAY_STR;

                return (
                  <button
                    key={i}
                    type="button"
                    onMouseDown={e => e.stopPropagation()}
                    onClick={() => setDatePart(cellStr)}
                    style={{
                      padding: '7px 0', textAlign: 'center',
                      borderRadius: '50%', aspectRatio: '1',
                      border: isToday && !isSelected
                        ? '1.5px solid var(--theme-accent)'
                        : '1.5px solid transparent',
                      background: isSelected ? 'var(--theme-accent)' : 'transparent',
                      color: isSelected ? '#fff' : isToday ? 'var(--theme-accent)' : 'var(--theme-text-primary)',
                      fontSize: '0.8125rem',
                      fontWeight: isSelected || isToday ? 700 : 400,
                      cursor: 'pointer', transition: 'background 0.1s',
                      lineHeight: 1,
                    }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--theme-bg-secondary)'; }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: 8,
              alignItems: 'center',
              padding: '8px 14px 12px',
              borderTop: '1px solid var(--theme-border)',
            }}>
              <label style={{
                display: 'grid',
                gap: 5,
                color: 'var(--theme-text-secondary)',
                fontSize: '0.72rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}>
                Time
                <input
                  type="time"
                  value={pendingTime}
                  onMouseDown={e => e.stopPropagation()}
                  onClick={e => e.stopPropagation()}
                  onChange={(e) => setTimePart(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    border: '1.5px solid var(--theme-border)',
                    borderRadius: 10,
                    background: 'var(--theme-bg-secondary)',
                    color: 'var(--theme-text-primary)',
                    padding: '7px 10px',
                    font: 'inherit',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                  }}
                />
              </label>
              <button
                type="button"
                onMouseDown={e => e.stopPropagation()}
                onClick={clearTime}
                disabled={!pendingTime}
                style={{
                  alignSelf: 'end',
                  border: '1.5px solid var(--theme-border)',
                  borderRadius: 10,
                  background: 'transparent',
                  color: pendingTime ? 'var(--theme-text-secondary)' : 'var(--theme-text-muted)',
                  padding: '8px 10px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: pendingTime ? 'pointer' : 'default',
                  opacity: pendingTime ? 1 : 0.55,
                }}
              >
                No time
              </button>
            </div>

            {/* Footer */}
            <div style={{
              display: 'flex', gap: 8,
              padding: '10px 14px 14px',
              borderTop: '1px solid var(--theme-border)',
            }}>
              <button
                type="button"
                onMouseDown={e => e.stopPropagation()}
                onClick={cancel}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: 8,
                  border: '1.5px solid var(--theme-border)',
                  background: 'transparent', color: 'var(--theme-text-secondary)',
                  fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onMouseDown={e => e.stopPropagation()}
                onClick={done}
                style={{
                  flex: 2, padding: '8px 0', borderRadius: 8,
                  border: 'none',
                  background: 'var(--theme-accent)', color: '#fff',
                  fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
                }}
              >
                Done
              </button>
            </div>
        </div>,
        document.body
      )}
    </div>
  );
}

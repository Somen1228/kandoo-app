import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { composeDue, formatDueShort, getDueDatePart, getDueTimePart, toDueString, parseDue } from '../../utils/dueDate';
import { VscCalendar, VscClose, VscChevronLeft, VscChevronRight } from 'react-icons/vsc';

const DAYS   = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

const HOUR_ITEMS = ['12','01','02','03','04','05','06','07','08','09','10','11'];
const MIN_ITEMS  = ['00','05','10','15','20','25','30','35','40','45','50','55'];
const AMPM_ITEMS = ['AM','PM'];

const DH  = 40;  // item height px
const VIS = 3;   // visible rows
const PAD = 1;   // blank rows above/below center

const CONTAINER_CENTER = (DH * VIS) / 2; // 60px

const NAV_BTN = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--theme-text-muted)', padding: '4px 6px',
  borderRadius: 6, display: 'flex', alignItems: 'center', fontSize: '1rem', lineHeight: 1,
};

function todayStr()    { return toDueString(new Date()); }
function tomorrowStr() { const d = new Date(); d.setDate(d.getDate() + 1); return toDueString(d); }

const POP_W = 280;
const POP_H = 390;

// Apply scale/opacity to each item element based on its distance from center.
// Called directly on DOM refs on every scroll tick — no React re-render needed.
function applyDrumScales(itemEls, scrollTop) {
  itemEls.forEach((el, i) => {
    if (!el) return;
    const itemCenter = i * DH + DH / 2 - scrollTop;
    const t = Math.min(Math.abs(itemCenter - CONTAINER_CENTER) / DH, 1.6);
    // Wide contrast: center=1.0, ±1 slot≈0.62, ±2 slots≈0.38
    const scale   = Math.max(0.38, 1 - t * 0.38);
    // Fade strongly: center=1.0, ±1 slot≈0.28
    const opacity = Math.max(0.10, 1 - t * 0.72);
    el.style.transform  = `scale(${scale.toFixed(3)})`;
    el.style.opacity    = opacity.toFixed(2);
    el.style.fontWeight = t < 0.25 ? '500' : '400';
  });
}

function DrumColumn({ items, value, onChange, width = 58 }) {
  const scrollRef       = useRef(null);
  const itemEls         = useRef([]);
  const snapTimer       = useRef(null);
  const isUserScrolling = useRef(false);

  const padded     = [...Array(PAD).fill(null), ...items, ...Array(PAD).fill(null)];
  const toTop      = (i) => i * DH;
  const currentIdx = Math.max(0, items.indexOf(value));

  // Set initial scroll position + scales without animation
  useLayoutEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = toTop(currentIdx);
    applyDrumScales(itemEls.current, toTop(currentIdx));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // When value changes externally, smooth-scroll to it
  useEffect(() => {
    if (scrollRef.current && !isUserScrolling.current) {
      scrollRef.current.scrollTo({ top: toTop(currentIdx), behavior: 'smooth' });
      // scroll events fire during smooth scroll, so applyDrumScales runs naturally
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const scrollTop = scrollRef.current.scrollTop;

    // Live scale update — no state, direct DOM
    applyDrumScales(itemEls.current, scrollTop);

    isUserScrolling.current = true;
    clearTimeout(snapTimer.current);
    // Wait for CSS scroll-snap to settle, then just read the position.
    // Do NOT call scrollTo here — it would race with the snap animation and cause jitter.
    snapTimer.current = setTimeout(() => {
      if (!scrollRef.current) return;
      const idx  = Math.round(scrollRef.current.scrollTop / DH);
      const safe = Math.max(0, Math.min(items.length - 1, idx));
      if (items[safe] !== value) onChange(items[safe]);
      // Keep guard up long enough so the useEffect value-change scroll doesn't fire
      setTimeout(() => { isUserScrolling.current = false; }, 250);
    }, 120);
  };

  return (
    <div style={{ position: 'relative', width, height: DH * VIS, flexShrink: 0, overflow: 'hidden', borderRadius: 10 }}>
      {/* Center selection band */}
      <div style={{
        position: 'absolute', left: 3, right: 3,
        top: DH * PAD, height: DH,
        background: 'var(--theme-bg-secondary)',
        borderRadius: 8, pointerEvents: 'none', zIndex: 1,
      }} />
      {/* Top gradient fade */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: DH * PAD + 14,
        background: 'linear-gradient(to bottom, var(--theme-bg-card) 20%, transparent)',
        pointerEvents: 'none', zIndex: 2,
      }} />
      {/* Bottom gradient fade */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: DH * PAD + 14,
        background: 'linear-gradient(to top, var(--theme-bg-card) 20%, transparent)',
        pointerEvents: 'none', zIndex: 2,
      }} />

      <div
        ref={scrollRef}
        className="dp-drum-scroll"
        onScroll={handleScroll}
        style={{
          height: DH * VIS,
          overflowY: 'scroll',
          scrollSnapType: 'y mandatory',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {padded.map((item, i) => {
          const isEmpty = item === null;
          return (
            <div
              key={i}
              ref={el => { itemEls.current[i] = el; }}
              onMouseDown={() => {
                if (isEmpty || item === value) return;
                const realIdx = items.indexOf(item);
                scrollRef.current?.scrollTo({ top: toTop(realIdx), behavior: 'smooth' });
                onChange(item);
              }}
              style={{
                height: DH,
                scrollSnapAlign: isEmpty ? 'none' : 'center',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.12rem',
                fontWeight: '400',
                color: 'var(--theme-text-primary)',
                cursor: isEmpty ? 'default' : 'pointer',
                userSelect: 'none',
                position: 'relative', zIndex: 3,
                letterSpacing: '-0.01em',
                willChange: 'transform, opacity',
              }}
            >
              {item}
            </div>
          );
        })}
      </div>
    </div>
  );
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
    const r          = triggerRef.current.getBoundingClientRect();
    const left       = Math.min(r.left, window.innerWidth - POP_W - 12);
    const spaceBelow = window.innerHeight - r.bottom - 6;
    const top        = spaceBelow >= POP_H ? r.bottom + 6 : Math.max(6, r.top - POP_H - 6);
    setPopPos({ top, left });
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

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const id = setTimeout(() => document.addEventListener('click', close), 0);
    const repos = () => computePos();
    window.addEventListener('scroll', repos, true);
    window.addEventListener('resize', repos);
    return () => {
      clearTimeout(id);
      document.removeEventListener('click', close);
      window.removeEventListener('scroll', repos, true);
      window.removeEventListener('resize', repos);
    };
  }, [open]);

  const done   = () => { onChange(pending); setOpen(false); };
  const cancel = () => { setPending(value || ''); setOpen(false); };
  const quick  = (str) => { onChange(str); setOpen(false); };
  const clear  = (e) => { e.stopPropagation(); onChange(''); };

  const prevMonth = () => setViewMonth(m => { if (m === 0) { setViewYear(y => y - 1); return 11; } return m - 1; });
  const nextMonth = () => setViewMonth(m => { if (m === 11) { setViewYear(y => y + 1); return 0; } return m + 1; });

  const firstDow    = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const TODAY_STR    = todayStr();
  const TOMORROW_STR = tomorrowStr();
  const pendingDate  = getDueDatePart(pending);
  const pendingTime  = getDueTimePart(pending);

  const hour24        = pendingTime ? parseInt(pendingTime.split(':')[0], 10) : 9;
  const minuteNum     = pendingTime ? parseInt(pendingTime.split(':')[1], 10) : 0;
  const hour12Num     = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
  const ampmVal       = hour24 < 12 ? 'AM' : 'PM';
  const hour12Str     = String(hour12Num).padStart(2, '0');
  const minuteSnapped = MIN_ITEMS.includes(String(minuteNum).padStart(2, '0'))
    ? String(minuteNum).padStart(2, '0') : '00';

  const parsed    = parseDue(value);
  const labelText = parsed ? formatDueShort(value) : null;

  const setDatePart = (datePart) => setPending(composeDue(datePart, pendingTime) || '');

  const applyTime = (h24, m) => {
    const datePart = pendingDate || TODAY_STR;
    const t = `${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    setPending(composeDue(datePart, t) || datePart);
  };

  const onHour12Change  = (h12s) => { const h12 = parseInt(h12s, 10); const h24 = ampmVal === 'AM' ? (h12 === 12 ? 0 : h12) : (h12 === 12 ? 12 : h12 + 12); applyTime(h24, minuteNum); };
  const onMinChange     = (ms) => applyTime(hour24, parseInt(ms, 10));
  const onAmpmChange    = (ap) => { const h12 = hour12Num; const h24 = ap === 'AM' ? (h12 === 12 ? 0 : h12) : (h12 === 12 ? 12 : h12 + 12); applyTime(h24, minuteNum); };
  const clearTime       = () => { if (pendingDate) setPending(pendingDate); };

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 4, ...style }}
      onPointerDown={onPointerDown}
    >
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
        <button type="button" className="mac-due-row__clear" onClick={clear} aria-label="Clear due date">
          <VscClose />
        </button>
      )}

      {open && createPortal(
        <div
          className="mac-date-popover"
          style={{
            position: 'fixed', top: popPos.top, left: popPos.left,
            zIndex: 10100, width: POP_W,
            background: 'var(--theme-bg-card)',
            border: '1px solid var(--theme-border)',
            borderRadius: 16,
            boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
            fontFamily: 'inherit', userSelect: 'none',
          }}
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
          onPointerDown={e => e.stopPropagation()}
        >
          {/* Quick chips */}
          <div style={{ display: 'flex', gap: 8, padding: '14px 14px 0' }}>
            {[{ label: 'Today', str: TODAY_STR }, { label: 'Tomorrow', str: TOMORROW_STR }].map(({ label, str }) => {
              const active = pendingDate === str;
              return (
                <button key={label} type="button" onMouseDown={e => e.stopPropagation()}
                  onClick={() => quick(composeDue(str, pendingTime) || str)}
                  style={{
                    flex: 1, padding: '7px 0', borderRadius: 20,
                    border: `1.5px solid ${active ? 'var(--theme-accent)' : 'var(--theme-border)'}`,
                    background: active ? 'var(--theme-accent)' : 'transparent',
                    color: active ? '#fff' : 'var(--theme-text-primary)',
                    fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Month nav */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '10px 10px 6px' }}>
            <button type="button" onMouseDown={e => e.stopPropagation()} onClick={prevMonth} style={NAV_BTN}><VscChevronLeft /></button>
            <span style={{ flex: 1, textAlign: 'center', fontSize: '0.875rem', fontWeight: 600, color: 'var(--theme-text-primary)' }}>
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button type="button" onMouseDown={e => e.stopPropagation()} onClick={nextMonth} style={NAV_BTN}><VscChevronRight /></button>
          </div>

          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '0 10px 2px', textAlign: 'center' }}>
            {DAYS.map((d, i) => (
              <div key={i} style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--theme-text-muted)', padding: '2px 0' }}>{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '0 10px 6px', gap: 1 }}>
            {cells.map((day, i) => {
              if (!day) return <div key={i} />;
              const cellStr    = toDueString(new Date(viewYear, viewMonth, day));
              const isSelected = pendingDate === cellStr;
              const isToday    = cellStr === TODAY_STR;
              return (
                <button key={i} type="button" onMouseDown={e => e.stopPropagation()}
                  onClick={() => setDatePart(cellStr)}
                  style={{
                    padding: '7px 0', textAlign: 'center', borderRadius: '50%', aspectRatio: '1',
                    border: isToday && !isSelected ? '1.5px solid var(--theme-accent)' : '1.5px solid transparent',
                    background: isSelected ? 'var(--theme-accent)' : 'transparent',
                    color: isSelected ? '#fff' : isToday ? 'var(--theme-accent)' : 'var(--theme-text-primary)',
                    fontSize: '0.8125rem', fontWeight: isSelected || isToday ? 600 : 400,
                    cursor: 'pointer', transition: 'background 0.1s', lineHeight: 1,
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--theme-bg-secondary)'; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Time drums */}
          <div style={{ borderTop: '1px solid var(--theme-border)', padding: '12px 16px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--theme-text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                Time
              </span>
              {pendingTime ? (
                <button type="button" onMouseDown={e => e.stopPropagation()} onClick={clearTime}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--theme-accent)', fontSize: '0.78rem', fontWeight: 500, padding: 0 }}
                >
                  No time
                </button>
              ) : (
                <span style={{ fontSize: '0.72rem', color: 'var(--theme-text-muted)', fontStyle: 'italic' }}>scroll to set</span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <DrumColumn items={HOUR_ITEMS}  value={hour12Str}     onChange={onHour12Change} width={60} />
              <span style={{ fontSize: '1.2rem', fontWeight: 300, color: 'var(--theme-text-muted)', flexShrink: 0, lineHeight: 1, paddingBottom: 2 }}>:</span>
              <DrumColumn items={MIN_ITEMS}   value={minuteSnapped} onChange={onMinChange}    width={60} />
              <DrumColumn items={AMPM_ITEMS}  value={ampmVal}       onChange={onAmpmChange}   width={52} />
            </div>
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', gap: 8, padding: '10px 14px 14px', borderTop: '1px solid var(--theme-border)' }}>
            <button type="button" onMouseDown={e => e.stopPropagation()} onClick={cancel}
              style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: '1.5px solid var(--theme-border)', background: 'transparent', color: 'var(--theme-text-secondary)', fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button type="button" onMouseDown={e => e.stopPropagation()} onClick={done}
              style={{ flex: 2, padding: '8px 0', borderRadius: 8, border: 'none', background: 'var(--theme-accent)', color: '#fff', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}
            >
              Done
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

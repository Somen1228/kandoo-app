import { useState, useEffect } from 'react';

// Drives all responsive/touch branching from two capability queries, so desktop
// behaviour is never touched: `isCompact` swaps the sidebar to a drawer on small
// screens, `isTouch` gates touch-only affordances. Both update live on resize /
// device change.
const COMPACT_QUERY = '(max-width: 820px)';
const TOUCH_QUERY = '(hover: none) and (pointer: coarse)';

const read = (query) =>
  typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false;

export function useViewport() {
  const [state, setState] = useState(() => ({
    isCompact: read(COMPACT_QUERY),
    isTouch: read(TOUCH_QUERY),
  }));

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const compact = window.matchMedia(COMPACT_QUERY);
    const touch = window.matchMedia(TOUCH_QUERY);
    const update = () => setState({ isCompact: compact.matches, isTouch: touch.matches });
    update();
    compact.addEventListener('change', update);
    touch.addEventListener('change', update);
    return () => {
      compact.removeEventListener('change', update);
      touch.removeEventListener('change', update);
    };
  }, []);

  return state;
}

export default useViewport;

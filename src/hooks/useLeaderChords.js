import { useEffect, useRef, useState } from 'react';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

// Human-readable label for the leader combo, e.g. "⌘ J" / "Ctrl J".
export const LEADER_LABEL = `${isMac ? '⌘' : 'Ctrl'} J`;

// A VS Code-style chord (leader → key). The leader is a modifier combo
// (Cmd/Ctrl + J) so it can be intercepted globally — even while a text input or
// the note editor holds focus — without ever inserting a character. Once the
// leader is "armed", the next key is matched against `commands` and consumed.
//
// `commands` maps a lowercase key (e.g. 'n', '?') to a handler. Returns whether
// the chord is currently armed, so callers can surface a hint.
export function useLeaderChords(commands, { timeout = 1600 } = {}) {
  const [armed, setArmed] = useState(false);
  const armedRef = useRef(false);
  const timerRef = useRef(null);
  const commandsRef = useRef(commands);
  useEffect(() => { commandsRef.current = commands; });

  useEffect(() => {
    const disarm = () => {
      armedRef.current = false;
      setArmed(false);
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    };

    const isLeader = (e) =>
      (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'j';

    const onKeyDown = (e) => {
      // Bare modifier presses (building up the next chord key) never disarm.
      if (e.key === 'Shift' || e.key === 'Meta' || e.key === 'Control' || e.key === 'Alt' || e.key === 'OS') {
        return;
      }

      if (armedRef.current) {
        const key = e.key.toLowerCase();
        if (key === 'escape') {
          e.preventDefault();
          e.stopPropagation();
          disarm();
          return;
        }
        const cmd = commandsRef.current[key];
        if (cmd) {
          // Swallow the key so it never reaches a focused input / other hotkeys.
          e.preventDefault();
          e.stopPropagation();
          disarm();
          cmd(e);
          return;
        }
        // Not a known command — quietly disarm and let the keystroke through.
        disarm();
        return;
      }

      if (isLeader(e)) {
        e.preventDefault();
        e.stopPropagation();
        armedRef.current = true;
        setArmed(true);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(disarm, timeout);
      }
    };

    // Capture phase on window runs before document-level hotkey handlers and
    // before the focused input sees the key, so stopPropagation fully claims it.
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [timeout]);

  return armed;
}

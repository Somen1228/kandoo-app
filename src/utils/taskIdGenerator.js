/**
 * Generate a task id.
 *
 * Ids are internal-only (never shown to users) and used purely as stable,
 * unique keys for a card's `tasks` map, drag-and-drop, and jump-to-match. They
 * therefore no longer derive from the card title — that old scheme only had a
 * 10k random space per title prefix and collided silently (a duplicate id
 * overwrites an existing task). This uses a UUID for collision resistance, with
 * a timestamp+random fallback for runtimes without `crypto.randomUUID`.
 */
export const generateTaskID = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `t_${crypto.randomUUID()}`;
  }
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 11)}`;
};

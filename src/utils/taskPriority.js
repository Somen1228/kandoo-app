// Task priority levels. Stored on a task as `task.priority` ('high'|'medium'|'low').
// Colours are theme-independent so the urgency reads the same in every theme.
export const PRIORITIES = [
  { id: 'high',   label: 'High',   short: 'P1', color: '#e5484d', bg: 'rgba(229,72,77,0.14)' },
  { id: 'medium', label: 'Medium', short: 'P2', color: '#e8a13a', bg: 'rgba(232,161,58,0.16)' },
  { id: 'low',    label: 'Low',    short: 'P3', color: '#4f86df', bg: 'rgba(79,134,223,0.14)' },
];

export const PRIORITY_RANK = { high: 3, medium: 2, low: 1 };

export function getPriority(id) {
  return PRIORITIES.find((p) => p.id === id) || null;
}

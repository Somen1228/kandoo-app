// Workspace label palette + id helper. Labels are stored denormalized on each
// task ({ id, name, color }) so they stay searchable across boards without a
// lookup, and a registry of known labels lives in settings.labels for the picker.
export const LABEL_COLORS = [
  '#e5484d', '#e8a13a', '#5baa5b', '#4f86df',
  '#8b5cf6', '#ec4899', '#06b6d4', '#64748b',
];

let counter = 0;
export const newLabelId = () => `lbl_${Date.now().toString(36)}_${counter++}`;

export function nextLabelColor(existing = []) {
  const used = new Set(existing.map((l) => l.color));
  return LABEL_COLORS.find((c) => !used.has(c)) || LABEL_COLORS[existing.length % LABEL_COLORS.length];
}

// Export / import boards as JSON files.
// On import: validates structure, rejects unsafe image payloads, regenerates
// all IDs so imports never collide with existing data.

import { v4 as uuidv4 } from 'uuid';
import { generateTaskID } from './taskIdGenerator';
import { isHtml, htmlToText } from './htmlEditor';

const EXPORT_VERSION = 1;

export function serializeBoards(boards) {
  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    boards,
  };
}

export function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function safeFilename(s) {
  return (s || 'export').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'export';
}

export function parseExportFile(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('File is not valid JSON');
  }

  // Accept wrapped `{ boards: [...] }` or a raw array for flexibility
  const boards = Array.isArray(parsed) ? parsed : parsed?.boards;
  if (!Array.isArray(boards)) throw new Error('File is missing a "boards" array');
  if (boards.length === 0) throw new Error('File contains no boards');

  for (const b of boards) {
    if (!b || typeof b.title !== 'string') throw new Error('A board is missing a title');
    if (!Array.isArray(b.cards)) throw new Error(`Board "${b.title}" has no cards array`);
    for (const c of b.cards) {
      if (!c || typeof c.title !== 'string') throw new Error(`A card in "${b.title}" is missing a title`);
      if (c.tasks != null && (typeof c.tasks !== 'object' || Array.isArray(c.tasks))) {
        throw new Error(`Card "${c.title}" has an invalid tasks object`);
      }
      // Validate note shape if present
      if (c.note != null) {
        if (typeof c.note !== 'object' || Array.isArray(c.note)) {
          throw new Error(`Card "${c.title}" has an invalid note object`);
        }
        if (c.note.content != null && typeof c.note.content !== 'string') {
          throw new Error(`Note in "${c.title}" has an invalid content`);
        }
        if (c.note.images != null) {
          if (!Array.isArray(c.note.images)) throw new Error(`Note in "${c.title}" has invalid images`);
          for (const img of c.note.images) {
            if (typeof img !== 'string' || !/^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,/i.test(img)) {
              throw new Error(`Note in "${c.title}" has an unsafe image attachment`);
            }
          }
        }
      }
      for (const t of Object.values(c.tasks || {})) {
        if (!t || typeof t.value !== 'string') {
          throw new Error(`A task in "${c.title}" has an invalid value`);
        }
        if (t.images != null) {
          if (!Array.isArray(t.images)) throw new Error(`A task in "${c.title}" has invalid images`);
          for (const img of t.images) {
            if (typeof img !== 'string' || !/^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,/i.test(img)) {
              throw new Error(`A task in "${c.title}" has an unsafe image attachment`);
            }
          }
        }
      }
    }
  }

  return boards;
}

// Strip incoming IDs and assign fresh ones so imports can't clobber existing data
function regenerateTaskIds(tasks) {
  const out = {};
  for (const t of Object.values(tasks || {})) {
    const id = generateTaskID();
    out[id] = { ...t, id };
  }
  return out;
}

export function regenerateIds(boards) {
  return boards.map((b) => ({
    ...b,
    id: uuidv4(),
    cards: (b.cards || []).map((c) => ({
      ...c,
      uid: uuidv4(),
      tasks: regenerateTaskIds(c.tasks),
    })),
  }));
}

// ── XLSX export ──────────────────────────────────────────────────────────
// Excel sheet name limits: max 31 chars; can't contain / \ ? * [ ]
const INVALID_SHEET_CHARS = /[/\\?*[\]:]/g;

function sanitizeSheetName(name, used) {
  let base = (name || 'Sheet').replace(INVALID_SHEET_CHARS, '-').trim().slice(0, 31) || 'Sheet';
  let candidate = base;
  let n = 2;
  while (used.has(candidate.toLowerCase())) {
    const suffix = ` (${n++})`;
    candidate = base.slice(0, 31 - suffix.length) + suffix;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

function taskToCell(task) {
  const raw = task.value || '';
  const text = isHtml(raw) ? htmlToText(raw) : raw;
  const imgCount = Array.isArray(task.images) ? task.images.length : 0;
  if (imgCount > 0) return `${text}${text ? '\n' : ''}[${imgCount} image${imgCount > 1 ? 's' : ''}]`;
  return text;
}

export async function downloadBoardsAsXlsx(boards, filename) {
  // Lazy-load xlsx (~300KB) so users who never export XLSX don't pay for it
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const usedSheetNames = new Set();

  for (const board of boards) {
    const sheetName = sanitizeSheetName(board.title, usedSheetNames);
    const cards = board.cards || [];
    // Header row = card titles (note cards get a [Note] suffix)
    const headers = cards.map((c) => (c.type === 'note' ? `${c.title || '(untitled)'} [Note]` : (c.title || '(untitled)')));
    // Build column-oriented data: each column = card.
    // - todo: each row = one task
    // - note: a single row with the note's plain-text content
    const taskColumns = cards.map((c) => {
      if (c.type === 'note') {
        const text = htmlToText(c.note?.content || '');
        const imgCount = c.note?.images?.length || 0;
        const cell = text + (imgCount > 0 ? `${text ? '\n' : ''}[${imgCount} image${imgCount > 1 ? 's' : ''}]` : '');
        return cell ? [cell] : [];
      }
      return Object.values(c.tasks || {}).map(taskToCell);
    });
    const maxRows = taskColumns.reduce((m, col) => Math.max(m, col.length), 0);

    // aoa = array-of-arrays, row-major
    const aoa = [headers];
    for (let r = 0; r < maxRows; r++) {
      aoa.push(taskColumns.map((col) => col[r] ?? ''));
    }

    // Empty board → at least one row so the sheet isn't completely blank
    if (maxRows === 0 && headers.length === 0) aoa.push(['(empty board)']);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    // Reasonable column widths
    ws['!cols'] = headers.map((h) => ({
      wch: Math.min(60, Math.max(20, (h || '').length + 4)),
    }));
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  // Edge case: no boards passed
  if (boards.length === 0) {
    const ws = XLSX.utils.aoa_to_sheet([['(no boards to export)']]);
    XLSX.utils.book_append_sheet(wb, ws, 'Empty');
  }

  XLSX.writeFile(wb, filename);
}

// Append "(imported)" / "(imported 2)" suffixes if title would clash
export function dedupeTitles(toImport, existing) {
  const taken = new Set(existing.map((b) => b.title));
  return toImport.map((b) => {
    if (!taken.has(b.title)) {
      taken.add(b.title);
      return b;
    }
    let n = 1;
    let candidate;
    do {
      candidate = n === 1 ? `${b.title} (imported)` : `${b.title} (imported ${n})`;
      n++;
    } while (taken.has(candidate));
    taken.add(candidate);
    return { ...b, title: candidate };
  });
}

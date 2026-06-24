export const CORE_TODO_COLUMNS = [
  { uid: 'col-todo',       title: 'To-do',       color: 'violet' },
  { uid: 'col-inprogress', title: 'In-Progress', color: 'sky' },
  { uid: 'col-inreview',   title: 'In-Review',   color: 'rose' },
  { uid: 'col-done',       title: 'Done',        color: 'mint' },
];

export const PROTECTED_COLUMN_TITLES = new Set(CORE_TODO_COLUMNS.map((column) => column.title));
export const PROTECTED_COLUMN_UIDS = new Set(CORE_TODO_COLUMNS.map((column) => column.uid));

export const defaultCards = CORE_TODO_COLUMNS.map((column) => ({
  ...column,
  type: 'todo',
  isVisible: true,
  tasks: {},
}));

export function isProtectedCoreColumnTitle(title) {
  return PROTECTED_COLUMN_TITLES.has((title || '').trim());
}

export function isProtectedCoreColumn(card) {
  return PROTECTED_COLUMN_UIDS.has(card?.uid) || isProtectedCoreColumnTitle(card?.title);
}

export function ensureCoreColumns(boards = []) {
  return boards.map((board) => {
    const cards = Array.isArray(board.cards) ? board.cards : [];
    const todoCards = cards.filter((card) => (card.type || 'todo') !== 'note');
    const existingTitles = new Set(todoCards.map((card) => (card.title || '').trim()));
    const existingUids = new Set(todoCards.map((card) => card.uid).filter(Boolean));

    let nextCards = cards;
    for (const coreColumn of CORE_TODO_COLUMNS) {
      if (existingUids.has(coreColumn.uid) || existingTitles.has(coreColumn.title)) continue;
      const newColumn = {
        ...coreColumn,
        type: 'todo',
        isVisible: true,
        tasks: {},
      };
      const doneIndex = nextCards.findIndex((card) => (card.type || 'todo') !== 'note' && card.title === 'Done');
      const insertBeforeDone = coreColumn.title !== 'Done' && doneIndex >= 0;
      nextCards = insertBeforeDone
        ? [...nextCards.slice(0, doneIndex), newColumn, ...nextCards.slice(doneIndex)]
        : [...nextCards, newColumn];
      existingTitles.add(coreColumn.title);
      existingUids.add(coreColumn.uid);
    }

    return nextCards === cards ? board : { ...board, cards: nextCards };
  });
}

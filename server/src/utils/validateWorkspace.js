const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateWorkspaceBoards(boards) {
  if (!Array.isArray(boards)) return 'boards must be an array';
  if (boards.length > 250) return 'workspace exceeds the 250-board limit';

  for (const board of boards) {
    if (!board || typeof board !== 'object' || Array.isArray(board)) return 'every board must be an object';
    if (typeof board.id !== 'string' || !UUID_RX.test(board.id)) return 'every board must have a UUID id';
    if (typeof board.title !== 'string' || board.title.length > 255) return 'board titles must be at most 255 characters';
    if (!Array.isArray(board.cards)) return 'every board must contain a cards array';
    if (board.cards.length > 500) return 'a board exceeds the 500-card limit';
  }
  return null;
}


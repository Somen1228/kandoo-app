import calm from './expressions/kandoo-calm.png';
import success from './expressions/kandoo-success.png';
import loading from './expressions/kandoo-loading.png';
import error from './expressions/kandoo-error.png';
import warning from './expressions/kandoo-warning.png';
import online from './expressions/kandoo-online.png';
import offline from './expressions/kandoo-offline.png';

export const kandooMascots = Object.freeze({
  calm,
  success,
  loading,
  error,
  warning,
  online,
  offline,
});

const TOAST_MASCOTS = Object.freeze({
  success,
  error,
  warning,
  loading,
  info: calm,
  default: calm,
});

export function mascotForToast(type) {
  return TOAST_MASCOTS[type] || calm;
}

export function mascotForSync(syncState, saveState = 'saved') {
  if (saveState === 'error' || syncState === 'conflict') return error;
  if (syncState === 'syncing' || syncState === 'connecting') return loading;
  if (syncState === 'synced') return online;
  return offline;
}

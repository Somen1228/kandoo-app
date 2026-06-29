// Lightweight event-emitter toast API — mirrors sonner's interface so all
// existing call-sites work without changes, just swap the import path.

let listeners = new Set();
let counter = 0;

function genId() { return `kt_${++counter}`; }

function dispatch(event) {
  listeners.forEach(fn => fn(event));
}

export function _subscribeToasts(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function add(type, message, opts = {}) {
  const id = opts.id || genId();
  dispatch({ kind: 'add', id, type, message, action: opts.action ?? null, duration: opts.duration ?? null });
  return id;
}

// Default (neutral) toast
export const toast = (message, opts = {}) => add('default', message, opts);

toast.success = (message, opts = {}) => add('success', message, opts);
toast.error   = (message, opts = {}) => add('error',   message, opts);
toast.warning = (message, opts = {}) => add('warning', message, opts);
toast.info    = (message, opts = {}) => add('info',    message, opts);
toast.due     = (message, opts = {}) => add('due',     message, opts);
toast.loading = (message, opts = {}) => add('loading', message, { duration: Infinity, ...opts });

toast.dismiss = (id) => dispatch({ kind: 'remove', id });

export default toast;

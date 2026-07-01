/**
 * Generate ids for Flow (canvas) entities. Same collision-resistant scheme as
 * `taskIdGenerator.js`, with distinct prefixes per entity so ids stay easy to
 * tell apart when debugging a raw board JSON dump.
 */
const makeId = (prefix) => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}${crypto.randomUUID()}`;
  }
  return `${prefix}${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 11)}`;
};

export const generateFlowId = () => makeId('fc_');
export const generateFlowNodeId = () => makeId('fn_');
export const generateFlowEdgeId = () => makeId('fe_');

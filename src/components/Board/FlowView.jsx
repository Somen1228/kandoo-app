import { useCallback, useEffect, useState } from 'react';
import { VscAdd, VscTrash, VscEdit } from 'react-icons/vsc';
import FlowCanvas from './FlowCanvas';
import { generateFlowId } from '../../utils/flowIdGenerator';
import { useTheme } from '../../contexts/ThemeContext';
import { isDarkSurface } from '../../themes/cardPalettes';

const newFlow = (title) => ({
  id: generateFlowId(),
  title,
  parentId: null,
  color: null,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  viewport: { x: 0, y: 0, zoom: 1 },
  nodes: [],
  edges: [],
});

export default function FlowView({ flows, updateFlows, updateFlowsSilent }) {
  const { currentTheme } = useTheme();
  const isDark = isDarkSurface(currentTheme?.colors?.bgCard);
  const [activeFlowId, setActiveFlowId] = useState(flows[0]?.id || null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameDraft, setRenameDraft] = useState('');

  useEffect(() => {
    if (activeFlowId && flows.some((f) => f.id === activeFlowId)) return;
    setActiveFlowId(flows[0]?.id || null);
  }, [flows, activeFlowId]);

  const createFlow = useCallback(() => {
    const flow = newFlow(`Untitled Flow ${flows.length + 1}`);
    updateFlows((prev) => [...prev, flow]);
    setActiveFlowId(flow.id);
  }, [flows.length, updateFlows]);

  const deleteFlow = useCallback((id) => {
    updateFlows((prev) => prev.filter((f) => f.id !== id));
  }, [updateFlows]);

  const startRename = useCallback((flow) => {
    setRenamingId(flow.id);
    setRenameDraft(flow.title);
  }, []);

  const commitRename = useCallback(() => {
    const title = renameDraft.trim();
    if (renamingId && title) {
      updateFlows((prev) => prev.map((f) => (f.id === renamingId ? { ...f, title, updatedAt: Date.now() } : f)));
    }
    setRenamingId(null);
  }, [renamingId, renameDraft, updateFlows]);

  const onChangeNodes = useCallback((updater) => {
    updateFlows((prev) => prev.map((f) => (
      f.id === activeFlowId
        ? { ...f, nodes: typeof updater === 'function' ? updater(f.nodes || []) : updater, updatedAt: Date.now() }
        : f
    )));
  }, [updateFlows, activeFlowId]);

  const onChangeEdges = useCallback((updater) => {
    updateFlows((prev) => prev.map((f) => (
      f.id === activeFlowId
        ? { ...f, edges: typeof updater === 'function' ? updater(f.edges || []) : updater, updatedAt: Date.now() }
        : f
    )));
  }, [updateFlows, activeFlowId]);

  const onChangeViewportSilent = useCallback((viewport) => {
    updateFlowsSilent((prev) => prev.map((f) => (f.id === activeFlowId ? { ...f, viewport } : f)));
  }, [updateFlowsSilent, activeFlowId]);

  const activeFlow = flows.find((f) => f.id === activeFlowId) || null;

  return (
    <div className="flow-layout">
      <div className="flow-sidebar">
        <div className="flow-sidebar__head">
          <span>Canvases</span>
          <button type="button" onClick={createFlow} title="New canvas" aria-label="New canvas">
            <VscAdd />
          </button>
        </div>
        <div className="flow-sidebar__scroll">
          {flows.length === 0 && <div className="flow-sidebar__empty">No canvases yet</div>}
          {flows.map((flow) => (
            <div
              key={flow.id}
              className={`flow-sidebar__row${flow.id === activeFlowId ? ' is-active' : ''}`}
              onClick={() => setActiveFlowId(flow.id)}
            >
              {renamingId === flow.id ? (
                <input
                  autoFocus
                  className="flow-sidebar__rename"
                  value={renameDraft}
                  onChange={(event) => setRenameDraft(event.target.value)}
                  onBlur={commitRename}
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') { event.preventDefault(); commitRename(); }
                    if (event.key === 'Escape') setRenamingId(null);
                  }}
                />
              ) : (
                <span className="flow-sidebar__title">{flow.title}</span>
              )}
              <span className="flow-sidebar__actions">
                <button type="button" onClick={(event) => { event.stopPropagation(); startRename(flow); }} title="Rename" aria-label="Rename canvas">
                  <VscEdit />
                </button>
                <button type="button" onClick={(event) => { event.stopPropagation(); deleteFlow(flow.id); }} title="Delete" aria-label="Delete canvas">
                  <VscTrash />
                </button>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flow-main">
        {activeFlow ? (
          <FlowCanvas
            key={activeFlow.id}
            flow={activeFlow}
            onChangeNodes={onChangeNodes}
            onChangeEdges={onChangeEdges}
            onChangeViewportSilent={onChangeViewportSilent}
            isDark={isDark}
          />
        ) : (
          <div className="flow-main__empty">
            <p>Create a canvas to start mapping ideas.</p>
            <button type="button" className="mac-chip" onClick={createFlow}>New canvas</button>
          </div>
        )}
      </div>
    </div>
  );
}

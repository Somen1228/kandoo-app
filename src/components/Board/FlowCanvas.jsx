import { useCallback, useEffect, useRef, useState } from 'react';
import { VscZoomIn, VscZoomOut, VscScreenFull } from 'react-icons/vsc';
import FlowNode from './FlowNode';
import FlowEdgeLayer, { nearestAnchorSide } from './FlowEdgeLayer';
import ContextMenu from '../ContextMenu';
import { generateFlowNodeId, generateFlowEdgeId } from '../../utils/flowIdGenerator';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2.5;

// Module-level (not component state) so copy/paste survives switching
// between canvases — a real clipboard, not per-mount scratch state.
let flowClipboard = null; // { nodes, edges } | null

export default function FlowCanvas({ flow, onChangeNodes, onChangeEdges, onChangeViewportSilent, isDark }) {
  const viewportRef = useRef(null);
  const panRef = useRef(null);
  const spaceHeldRef = useRef(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [editingNodeId, setEditingNodeId] = useState(null);
  const [marquee, setMarquee] = useState(null);
  const [connecting, setConnecting] = useState(null); // { fromId, fromSide, x, y, hoverNodeId, hoverSide } in world space
  const [ctxMenu, setCtxMenu] = useState(null); // { x, y, type: 'node'|'edge'|'canvas', nodeId?, edgeId?, world? }

  const nodes = flow.nodes || [];
  const edges = flow.edges || [];
  const viewport = flow.viewport || { x: 0, y: 0, zoom: 1 };

  // Space bar held → next background drag pans instead of marquee-selecting.
  useEffect(() => {
    const down = (event) => { if (event.code === 'Space' && !event.repeat) spaceHeldRef.current = true; };
    const up = (event) => { if (event.code === 'Space') spaceHeldRef.current = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  const deleteSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    onChangeNodes((prev) => prev.filter((n) => !selectedIds.has(n.id)));
    onChangeEdges((prev) => prev.filter((e) => !selectedIds.has(e.from) && !selectedIds.has(e.to)));
    setSelectedIds(new Set());
  }, [selectedIds, onChangeNodes, onChangeEdges]);

  const copySelected = useCallback(() => {
    const copiedNodes = nodes.filter((n) => selectedIds.has(n.id));
    if (copiedNodes.length === 0) return;
    const copiedEdges = edges.filter((e) => selectedIds.has(e.from) && selectedIds.has(e.to));
    flowClipboard = { nodes: copiedNodes, edges: copiedEdges };
  }, [nodes, edges, selectedIds]);

  // targetPoint (world coords) pastes so the clipboard's top-left lands there
  // (used for "Paste" at the right-click position); omitted, it pastes with a
  // fixed offset from the copied originals (used for Cmd+V / Duplicate).
  const pasteClipboard = useCallback((targetPoint) => {
    if (!flowClipboard || flowClipboard.nodes.length === 0) return;
    const originX = Math.min(...flowClipboard.nodes.map((n) => n.x));
    const originY = Math.min(...flowClipboard.nodes.map((n) => n.y));
    const dx = targetPoint ? targetPoint.x - originX : 24;
    const dy = targetPoint ? targetPoint.y - originY : 24;
    const idMap = {};
    const maxZ = nodes.reduce((max, n) => Math.max(max, n.zIndex || 0), 0);
    const newNodes = flowClipboard.nodes.map((n, i) => {
      const id = generateFlowNodeId();
      idMap[n.id] = id;
      return { ...n, id, x: n.x + dx, y: n.y + dy, zIndex: maxZ + 1 + i, groupId: null };
    });
    // Preserve group membership only if the group node was also copied.
    newNodes.forEach((n, i) => {
      const origGroupId = flowClipboard.nodes[i].groupId;
      if (origGroupId && idMap[origGroupId]) n.groupId = idMap[origGroupId];
    });
    const newEdges = flowClipboard.edges.map((e) => ({
      ...e, id: generateFlowEdgeId(), from: idMap[e.from], to: idMap[e.to],
    }));
    onChangeNodes((prev) => [...prev, ...newNodes]);
    if (newEdges.length > 0) onChangeEdges((prev) => [...prev, ...newEdges]);
    setSelectedIds(new Set(newNodes.map((n) => n.id)));
  }, [nodes, onChangeNodes, onChangeEdges]);

  const duplicateSelected = useCallback(() => {
    copySelected();
    pasteClipboard();
  }, [copySelected, pasteClipboard]);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(nodes.map((n) => n.id)));
  }, [nodes]);

  const bringToFront = useCallback(() => {
    if (selectedIds.size === 0) return;
    const maxZ = nodes.reduce((max, n) => Math.max(max, n.zIndex || 0), 0);
    onChangeNodes((prev) => prev.map((n) => (selectedIds.has(n.id) ? { ...n, zIndex: maxZ + 1 } : n)));
  }, [nodes, selectedIds, onChangeNodes]);

  const sendToBack = useCallback(() => {
    if (selectedIds.size === 0) return;
    const minZ = nodes.reduce((min, n) => Math.min(min, n.zIndex || 0), 0);
    onChangeNodes((prev) => prev.map((n) => (selectedIds.has(n.id) ? { ...n, zIndex: minZ - 1 } : n)));
  }, [nodes, selectedIds, onChangeNodes]);

  useEffect(() => {
    const handler = (event) => {
      if (editingNodeId) return;
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;

      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === 'c') {
        if (selectedIds.size === 0) return;
        event.preventDefault();
        copySelected();
      } else if (mod && event.key.toLowerCase() === 'v') {
        event.preventDefault();
        pasteClipboard();
      } else if (mod && event.key.toLowerCase() === 'd') {
        if (selectedIds.size === 0) return;
        event.preventDefault();
        duplicateSelected();
      } else if (mod && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        selectAll();
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && selectedIds.size > 0) {
        event.preventDefault();
        deleteSelected();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editingNodeId, selectedIds, copySelected, pasteClipboard, duplicateSelected, selectAll, deleteSelected]);

  const screenToWorld = useCallback((clientX, clientY) => {
    const rect = viewportRef.current.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    return { x: (px - viewport.x) / viewport.zoom, y: (py - viewport.y) / viewport.zoom };
  }, [viewport.x, viewport.y, viewport.zoom]);

  // Native (non-passive) wheel listener so preventDefault reliably stops
  // page/board scroll — React's synthetic onWheel may be attached passively.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return undefined;
    const handler = (event) => {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        const nextZoom = clamp(viewport.zoom * (1 - event.deltaY * 0.001), MIN_ZOOM, MAX_ZOOM);
        const rect = el.getBoundingClientRect();
        const px = event.clientX - rect.left, py = event.clientY - rect.top;
        const wx = (px - viewport.x) / viewport.zoom, wy = (py - viewport.y) / viewport.zoom;
        onChangeViewportSilent({ x: px - wx * nextZoom, y: py - wy * nextZoom, zoom: nextZoom });
      } else {
        onChangeViewportSilent({ ...viewport, x: viewport.x - event.deltaX, y: viewport.y - event.deltaY });
      }
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [viewport, onChangeViewportSilent]);

  const handleBackgroundPointerDown = useCallback((event) => {
    if (event.target !== event.currentTarget) return;
    const isPan = event.button === 1 || spaceHeldRef.current;
    if (isPan) {
      panRef.current = { startClientX: event.clientX, startClientY: event.clientY, startVX: viewport.x, startVY: viewport.y };
    } else if (event.button === 0) {
      const world = screenToWorld(event.clientX, event.clientY);
      setMarquee({ x0: world.x, y0: world.y, x1: world.x, y1: world.y, additive: event.shiftKey });
      if (!event.shiftKey) setSelectedIds(new Set());
    }
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [viewport.x, viewport.y, screenToWorld]);

  const handleBackgroundPointerMove = useCallback((event) => {
    if (panRef.current) {
      const dx = event.clientX - panRef.current.startClientX;
      const dy = event.clientY - panRef.current.startClientY;
      onChangeViewportSilent({ ...viewport, x: panRef.current.startVX + dx, y: panRef.current.startVY + dy });
      return;
    }
    if (marquee) {
      const world = screenToWorld(event.clientX, event.clientY);
      setMarquee((m) => (m ? { ...m, x1: world.x, y1: world.y } : m));
    }
  }, [viewport, marquee, onChangeViewportSilent, screenToWorld]);

  const handleBackgroundPointerUp = useCallback((event) => {
    if (panRef.current) {
      panRef.current = null;
    } else if (marquee) {
      const minX = Math.min(marquee.x0, marquee.x1), maxX = Math.max(marquee.x0, marquee.x1);
      const minY = Math.min(marquee.y0, marquee.y1), maxY = Math.max(marquee.y0, marquee.y1);
      const hits = nodes.filter((n) => n.x < maxX && n.x + n.w > minX && n.y < maxY && n.y + n.h > minY).map((n) => n.id);
      setSelectedIds((prev) => {
        const next = marquee.additive ? new Set(prev) : new Set();
        hits.forEach((id) => next.add(id));
        return next;
      });
      setMarquee(null);
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, [marquee, nodes]);

  const handleBackgroundDoubleClick = useCallback((event) => {
    if (event.target !== event.currentTarget) return;
    const world = screenToWorld(event.clientX, event.clientY);
    const id = generateFlowNodeId();
    const maxZ = nodes.reduce((max, n) => Math.max(max, n.zIndex || 0), 0);
    const newNode = {
      id, type: 'text', x: world.x - 120, y: world.y - 60, w: 240, h: 120,
      color: null, content: '', zIndex: maxZ + 1, groupId: null,
    };
    onChangeNodes((prev) => [...prev, newNode]);
    setSelectedIds(new Set([id]));
    setEditingNodeId(id);
  }, [nodes, screenToWorld, onChangeNodes]);

  const handleBackgroundContextMenu = useCallback((event) => {
    if (event.target !== event.currentTarget) return;
    event.preventDefault();
    const world = screenToWorld(event.clientX, event.clientY);
    setCtxMenu({ x: event.clientX, y: event.clientY, type: 'canvas', world });
  }, [screenToWorld]);

  const handleNodeContextMenu = useCallback((event, nodeId) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedIds((prev) => (prev.has(nodeId) ? prev : new Set([nodeId])));
    setCtxMenu({ x: event.clientX, y: event.clientY, type: 'node', nodeId });
  }, []);

  const handleEdgeContextMenu = useCallback((event, edgeId) => {
    event.preventDefault();
    event.stopPropagation();
    setCtxMenu({ x: event.clientX, y: event.clientY, type: 'edge', edgeId });
  }, []);

  const selectNode = useCallback((id, additive) => {
    setSelectedIds((prev) => {
      if (additive) {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      }
      return new Set([id]);
    });
  }, []);

  const moveNode = useCallback((id, x, y) => {
    onChangeNodes((prev) => prev.map((n) => (n.id === id ? { ...n, x, y } : n)));
  }, [onChangeNodes]);

  const resizeNode = useCallback((id, w, h) => {
    onChangeNodes((prev) => prev.map((n) => (n.id === id ? { ...n, w, h } : n)));
  }, [onChangeNodes]);

  const commitContent = useCallback((id, content) => {
    onChangeNodes((prev) => prev.map((n) => (n.id === id ? { ...n, content } : n)));
  }, [onChangeNodes]);

  const deleteEdge = useCallback((id) => {
    onChangeEdges((prev) => prev.filter((e) => e.id !== id));
  }, [onChangeEdges]);

  const startConnect = useCallback((nodeId, side, event) => {
    const world = screenToWorld(event.clientX, event.clientY);
    setConnecting({ fromId: nodeId, fromSide: side, x: world.x, y: world.y, hoverNodeId: null, hoverSide: null });
  }, [screenToWorld]);

  // Connect gesture uses window-level listeners (not pointer capture on the
  // anchor) so pointerup can land on a *different* node's DOM element.
  useEffect(() => {
    if (!connecting) return undefined;
    const move = (event) => {
      const world = screenToWorld(event.clientX, event.clientY);
      const target = document.elementFromPoint(event.clientX, event.clientY);
      const nodeEl = target?.closest('[data-flow-node-id]');
      const hoverId = nodeEl?.getAttribute('data-flow-node-id');
      let hoverNodeId = null, hoverSide = null;
      if (hoverId && hoverId !== connecting.fromId) {
        const hoverNode = nodes.find((n) => n.id === hoverId);
        if (hoverNode) { hoverNodeId = hoverId; hoverSide = nearestAnchorSide(hoverNode, world.x, world.y); }
      }
      setConnecting((c) => (c ? { ...c, x: world.x, y: world.y, hoverNodeId, hoverSide } : c));
    };
    // Reads `connecting` from the closure rather than a setConnecting updater —
    // updater functions must be pure and may be invoked more than once by
    // React, so calling onChangeEdges from inside one updates a different
    // component's state as a side effect and triggers React's "Cannot update
    // a component while rendering" + runaway re-render bug.
    const up = () => {
      if (connecting.hoverNodeId && connecting.hoverNodeId !== connecting.fromId) {
        onChangeEdges((prev) => [...prev, {
          id: generateFlowEdgeId(), from: connecting.fromId, fromAnchor: connecting.fromSide,
          to: connecting.hoverNodeId, toAnchor: connecting.hoverSide, label: '', arrow: 'end', color: null,
        }]);
      }
      setConnecting(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, [connecting, screenToWorld, nodes, onChangeEdges]);

  const zoomBy = useCallback((factor) => {
    const rect = viewportRef.current.getBoundingClientRect();
    const px = rect.width / 2, py = rect.height / 2;
    const nextZoom = clamp(viewport.zoom * factor, MIN_ZOOM, MAX_ZOOM);
    const wx = (px - viewport.x) / viewport.zoom, wy = (py - viewport.y) / viewport.zoom;
    onChangeViewportSilent({ x: px - wx * nextZoom, y: py - wy * nextZoom, zoom: nextZoom });
  }, [viewport, onChangeViewportSilent]);

  const resetView = useCallback(() => onChangeViewportSilent({ x: 0, y: 0, zoom: 1 }), [onChangeViewportSilent]);

  const pendingEdge = connecting ? {
    fromNode: nodes.find((n) => n.id === connecting.fromId),
    fromSide: connecting.fromSide,
    x: connecting.x,
    y: connecting.y,
    hoverNode: connecting.hoverNodeId ? nodes.find((n) => n.id === connecting.hoverNodeId) : null,
    hoverSide: connecting.hoverSide,
  } : null;

  return (
    <div
      className="flow-canvas"
      ref={viewportRef}
      onPointerDown={handleBackgroundPointerDown}
      onPointerMove={handleBackgroundPointerMove}
      onPointerUp={handleBackgroundPointerUp}
      onPointerCancel={handleBackgroundPointerUp}
      onDoubleClick={handleBackgroundDoubleClick}
      onContextMenu={handleBackgroundContextMenu}
    >
      <div
        className="flow-canvas__world"
        style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})` }}
      >
        <FlowEdgeLayer
          nodes={nodes}
          edges={edges}
          pendingEdge={pendingEdge?.fromNode ? pendingEdge : null}
          onDeleteEdge={deleteEdge}
          onEdgeContextMenu={handleEdgeContextMenu}
        />
        {nodes.map((node) => (
          <FlowNode
            key={node.id}
            node={node}
            selected={selectedIds.has(node.id)}
            isDark={isDark}
            zoom={viewport.zoom}
            onSelect={selectNode}
            onMove={moveNode}
            onResize={resizeNode}
            onCommitContent={commitContent}
            onStartConnect={startConnect}
            onContextMenu={handleNodeContextMenu}
            isConnectTarget={connecting?.hoverNodeId === node.id}
            editingNodeId={editingNodeId}
            onStartEdit={setEditingNodeId}
            onStopEdit={() => setEditingNodeId(null)}
          />
        ))}
        {marquee && (
          <div
            className="flow-canvas__marquee"
            style={{
              left: Math.min(marquee.x0, marquee.x1), top: Math.min(marquee.y0, marquee.y1),
              width: Math.abs(marquee.x1 - marquee.x0), height: Math.abs(marquee.y1 - marquee.y0),
            }}
          />
        )}
      </div>

      {nodes.length === 0 && (
        <div className="flow-canvas__hint">Double-click anywhere to add a note</div>
      )}

      <div className="flow-canvas__toolbar">
        <button type="button" onClick={() => zoomBy(0.8)} aria-label="Zoom out"><VscZoomOut /></button>
        <span className="flow-canvas__zoom">{Math.round(viewport.zoom * 100)}%</span>
        <button type="button" onClick={() => zoomBy(1.25)} aria-label="Zoom in"><VscZoomIn /></button>
        <button type="button" onClick={resetView} aria-label="Reset view"><VscScreenFull /></button>
      </div>

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
          items={
            ctxMenu.type === 'node' ? [
              { label: 'Copy', shortcut: '⌘C', onClick: copySelected },
              { label: 'Duplicate', shortcut: '⌘D', onClick: duplicateSelected },
              { divider: true },
              { label: 'Bring to Front', onClick: bringToFront },
              { label: 'Send to Back', onClick: sendToBack },
              { divider: true },
              { label: 'Delete', shortcut: '⌫', danger: true, onClick: deleteSelected },
            ] : ctxMenu.type === 'edge' ? [
              { label: 'Delete edge', danger: true, onClick: () => deleteEdge(ctxMenu.edgeId) },
            ] : [
              { label: 'Paste', shortcut: '⌘V', disabled: !flowClipboard, onClick: () => pasteClipboard(ctxMenu.world) },
              { divider: true },
              { label: 'Select All', shortcut: '⌘A', onClick: selectAll },
            ]
          }
        />
      )}
    </div>
  );
}

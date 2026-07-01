import { memo, useMemo } from 'react';

export function anchorPoint(node, side) {
  switch (side) {
    case 'top':    return { x: node.x + node.w / 2, y: node.y };
    case 'bottom': return { x: node.x + node.w / 2, y: node.y + node.h };
    case 'left':   return { x: node.x, y: node.y + node.h / 2 };
    case 'right':  return { x: node.x + node.w, y: node.y + node.h / 2 };
    default:       return { x: node.x + node.w / 2, y: node.y + node.h / 2 };
  }
}

// Nearest side of `node` to a world-space point — used when the connect
// gesture ends over a node so the edge lands on a sensible anchor without
// requiring the user to target an exact anchor dot.
export function nearestAnchorSide(node, worldX, worldY) {
  const cx = node.x + node.w / 2;
  const cy = node.y + node.h / 2;
  const dx = worldX - cx;
  const dy = worldY - cy;
  if (Math.abs(dx) > Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
  return dy >= 0 ? 'bottom' : 'top';
}

function sideOffset(side, dist) {
  switch (side) {
    case 'top':    return { x: 0, y: -dist };
    case 'bottom': return { x: 0, y: dist };
    case 'left':   return { x: -dist, y: 0 };
    case 'right':  return { x: dist, y: 0 };
    default:       return { x: 0, y: 0 };
  }
}

// Used for the free end of a pending edge while it isn't hovering a target
// yet — treating the cursor as if it were approaching from the opposite side
// keeps the curve a natural, symmetric "S" instead of bowing back on itself.
function oppositeSide(side) {
  switch (side) {
    case 'top':    return 'bottom';
    case 'bottom': return 'top';
    case 'left':   return 'right';
    case 'right':  return 'left';
    default:       return side;
  }
}

function buildPath(p1, side1, p2, side2) {
  const dist = Math.max(40, Math.hypot(p2.x - p1.x, p2.y - p1.y) / 2);
  const o1 = sideOffset(side1, dist);
  const o2 = sideOffset(side2, dist);
  const c1x = p1.x + o1.x, c1y = p1.y + o1.y;
  const c2x = p2.x + o2.x, c2y = p2.y + o2.y;
  return `M ${p1.x},${p1.y} C ${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
}

// Memoized on its own from/to node references so dragging one node only
// recomputes the paths of edges actually touching it, not the whole layer.
const Edge = memo(function Edge({ edge, fromNode, toNode, onDelete, onContextMenu }) {
  if (!fromNode || !toNode) return null;
  const p1 = anchorPoint(fromNode, edge.fromAnchor);
  const p2 = anchorPoint(toNode, edge.toAnchor);
  const d = buildPath(p1, edge.fromAnchor, p2, edge.toAnchor);
  const color = edge.color || 'var(--theme-accent)';
  return (
    <g className="flow-edge">
      <path
        d={d} fill="none" stroke={color} strokeWidth={2}
        markerEnd={edge.arrow !== 'none' ? 'url(#flow-arrow-end)' : undefined}
        markerStart={edge.arrow === 'both' ? 'url(#flow-arrow-start)' : undefined}
      />
      <path
        d={d} fill="none" stroke="transparent" strokeWidth={16}
        className="flow-edge__hit"
        onDoubleClick={(event) => { event.stopPropagation(); onDelete(edge.id); }}
        onContextMenu={(event) => { event.stopPropagation(); onContextMenu(event, edge.id); }}
      />
    </g>
  );
});

export default function FlowEdgeLayer({ nodes, edges, pendingEdge, onDeleteEdge, onEdgeContextMenu }) {
  const nodesById = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);

  // Snap to the hovered node's nearest anchor (and curve as if truly
  // connected) once the drag is over a valid target, so the "rubber band"
  // and the eventual real edge look identical — no last-instant jump.
  let pendingPath = null;
  let targetPoint = null;
  if (pendingEdge) {
    const p1 = anchorPoint(pendingEdge.fromNode, pendingEdge.fromSide);
    const hovering = !!pendingEdge.hoverNode;
    const toSide = hovering ? pendingEdge.hoverSide : oppositeSide(pendingEdge.fromSide);
    const p2 = hovering ? anchorPoint(pendingEdge.hoverNode, pendingEdge.hoverSide) : { x: pendingEdge.x, y: pendingEdge.y };
    pendingPath = buildPath(p1, pendingEdge.fromSide, p2, toSide);
    if (hovering) targetPoint = p2;
  }

  return (
    <svg className="flow-edge-layer" width="1" height="1" style={{ overflow: 'visible' }}>
      <defs>
        <marker id="flow-arrow-end" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--theme-accent)" />
        </marker>
        <marker id="flow-arrow-start" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="8" markerHeight="8" orient="auto">
          <path d="M10,0 L0,5 L10,10 z" fill="var(--theme-accent)" />
        </marker>
      </defs>
      {edges.map((edge) => (
        <Edge key={edge.id} edge={edge} fromNode={nodesById[edge.from]} toNode={nodesById[edge.to]} onDelete={onDeleteEdge} onContextMenu={onEdgeContextMenu} />
      ))}
      {pendingPath && (
        <>
          <path d={pendingPath} fill="none" stroke="var(--theme-accent)" strokeWidth={2} strokeDasharray="6 4" />
          {targetPoint && (
            <circle
              className="flow-edge-layer__target-anchor"
              cx={targetPoint.x} cy={targetPoint.y} r={7}
            />
          )}
        </>
      )}
    </svg>
  );
}

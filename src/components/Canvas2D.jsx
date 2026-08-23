import React, { useState, useRef } from 'react';
import { pointInPolygon } from '../utils/geometry';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCALE = 40;          // 40 px = 1 metre
const SNAP = 20;           // snap every 0.5 m (20 px)
const HIT_THRESHOLD = 12;  // px — how close a click must be to hit a wall/door/window
const ENDPOINT_RADIUS = 8; // px — grab radius for wall endpoints

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

function snapCoord(raw) {
  return Math.round(raw / SNAP) * SNAP;
}

/** Distance from point P to segment AB, plus normalised t along AB. */
function pointToSegmentInfo(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { distance: Math.hypot(px - ax, py - ay), t: 0 };
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return { distance: Math.hypot(px - cx, py - cy), t };
}

// ---------------------------------------------------------------------------
// Canvas2D
// ---------------------------------------------------------------------------

/**
 * Props:
 *   walls, doors, windows   — arrays from the design JSON
 *   mode                    — 'wall' | 'door' | 'window' | 'select'
 *   selectedId              — currently selected wall/door/window id (or null)
 *   onAddWall / onAddDoor / onAddWindow — add callbacks
 *   onSelect(id|null)       — select or deselect
 *   onMoveDoor / onMoveWindow — slide along wall
 *   onMoveWallEndpoint      — reposition a wall endpoint
 *   onToggleDoor            — flip open/closed
 */
export default function Canvas2D({
  walls,
  doors,
  windows = [],
  closedLoops = [],
  materials = {},
  mode,
  selectedId,
  onAddWall,
  onAddDoor,
  onAddWindow,
  onSelect,
  onMoveDoor,
  onMoveWindow,
  onMoveWallEndpoint,
  onToggleDoor,
}) {
  const containerRef = useRef(null);

  // ---- Wall-drawing state ----
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState(null);
  const [currentPoint, setCurrentPoint] = useState(null);

  // ---- Door/Window-mode hover ----
  const [hoveredWallId, setHoveredWallId] = useState(null);

  // ---- Select-mode drag state ----
  //   { type: 'door',     doorId }
  //   { type: 'window',   windowId }
  //   { type: 'endpoint', wallId, whichEnd }
  //   null
  const [dragTarget, setDragTarget] = useState(null);

  // -------------------------------------------------------
  // Coordinate helpers
  // -------------------------------------------------------
  function getRawCoords(e) {
    if (!containerRef.current) return { rx: 0, ry: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return { rx: e.clientX - rect.left, ry: e.clientY - rect.top };
  }

  function getSnappedCoords(e) {
    const { rx, ry } = getRawCoords(e);
    return { x: snapCoord(rx), y: snapCoord(ry) };
  }

  // -------------------------------------------------------
  // Hit-testing helpers
  // -------------------------------------------------------

  function findNearestWall(rx, ry) {
    let best = null;
    let bestDist = HIT_THRESHOLD;
    for (const wall of walls) {
      const { distance, t } = pointToSegmentInfo(
        rx, ry,
        wall.start.x * SCALE, wall.start.y * SCALE,
        wall.end.x * SCALE, wall.end.y * SCALE,
      );
      if (distance < bestDist) { bestDist = distance; best = { wall, t }; }
    }
    return best;
  }

  /** Find nearest door icon. Returns door object or null. */
  function findNearestDoor(rx, ry) {
    let best = null;
    let bestDist = HIT_THRESHOLD + 6;
    for (const door of doors) {
      const wall = walls.find((w) => w.id === door.wallId);
      if (!wall) continue;
      const cx = wall.start.x * SCALE + door.position * (wall.end.x - wall.start.x) * SCALE;
      const cy = wall.start.y * SCALE + door.position * (wall.end.y - wall.start.y) * SCALE;
      const dist = Math.hypot(rx - cx, ry - cy);
      if (dist < bestDist) { bestDist = dist; best = door; }
    }
    return best;
  }

  /** Find nearest window icon. Returns window object or null. */
  function findNearestWindow(rx, ry) {
    let best = null;
    let bestDist = HIT_THRESHOLD + 6;
    for (const win of windows) {
      const wall = walls.find((w) => w.id === win.wallId);
      if (!wall) continue;
      const cx = wall.start.x * SCALE + win.position * (wall.end.x - wall.start.x) * SCALE;
      const cy = wall.start.y * SCALE + win.position * (wall.end.y - wall.start.y) * SCALE;
      const dist = Math.hypot(rx - cx, ry - cy);
      if (dist < bestDist) { bestDist = dist; best = win; }
    }
    return best;
  }

  /** Check if (rx,ry) is close to a wall's start or end point. */
  function findNearestEndpoint(rx, ry) {
    for (const wall of walls) {
      const sx = wall.start.x * SCALE;
      const sy = wall.start.y * SCALE;
      if (Math.hypot(rx - sx, ry - sy) < ENDPOINT_RADIUS) {
        return { wallId: wall.id, whichEnd: 'start' };
      }
      const ex = wall.end.x * SCALE;
      const ey = wall.end.y * SCALE;
      if (Math.hypot(rx - ex, ry - ey) < ENDPOINT_RADIUS) {
        return { wallId: wall.id, whichEnd: 'end' };
      }
    }
    return null;
  }

  // -------------------------------------------------------
  // Clamp an opening's position so it doesn't overlap
  // other openings (doors AND windows) or exceed wall ends.
  // -------------------------------------------------------
  function clampOpeningPosition(openingId, wallId, rawT, openingWidth) {
    const wall = walls.find((w) => w.id === wallId);
    if (!wall) return rawT;
    const wallLen = Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
    if (wallLen === 0) return rawT;

    const halfW = (openingWidth / 2) / wallLen;
    let t = Math.max(halfW, Math.min(1 - halfW, rawT));

    // Collect ALL openings on this wall (doors + windows) except ourselves
    const siblings = [
      ...doors.filter((d) => d.wallId === wallId && d.id !== openingId),
      ...windows.filter((w) => w.wallId === wallId && w.id !== openingId),
    ];

    for (const sib of siblings) {
      const sibHalfW = (sib.width / 2) / wallLen;
      const gap = halfW + sibHalfW + 0.001;
      if (Math.abs(t - sib.position) < gap) {
        t = t < sib.position ? sib.position - gap : sib.position + gap;
      }
    }

    return Math.max(halfW, Math.min(1 - halfW, t));
  }

  // -------------------------------------------------------
  // Pointer event handlers
  // -------------------------------------------------------

  function handlePointerDown(e) {
    const { rx, ry } = getRawCoords(e);

    if (mode === 'wall') {
      const pt = getSnappedCoords(e);
      setStartPoint(pt);
      setCurrentPoint(pt);
      setIsDrawing(true);
      e.target.setPointerCapture(e.pointerId);

    } else if (mode === 'door') {
      const hit = findNearestWall(rx, ry);
      if (hit) {
        onAddDoor({
          wallId: hit.wall.id,
          position: hit.t,
          width: 0.9,
          height: 2.1,
          isOpen: false,
        });
      }

    } else if (mode === 'window') {
      // ----- Add window mode -----
      const hit = findNearestWall(rx, ry);
      if (hit) {
        onAddWindow({
          wallId: hit.wall.id,
          position: hit.t,
          width: 1.2,         // metres
          height: 1.0,        // metres
          sillHeight: 1.0,    // metres above floor
        });
      }

    } else if (mode === 'select') {
      // Priority: endpoint > door/window > wall > deselect

      // 1) Endpoint of the selected wall
      if (selectedId) {
        const ep = findNearestEndpoint(rx, ry);
        if (ep && ep.wallId === selectedId) {
          setDragTarget({ type: 'endpoint', wallId: ep.wallId, whichEnd: ep.whichEnd });
          e.target.setPointerCapture(e.pointerId);
          return;
        }
      }

      // 2) Door hit
      const doorHit = findNearestDoor(rx, ry);
      if (doorHit) {
        onSelect(doorHit.id);
        setDragTarget({ type: 'door', doorId: doorHit.id });
        e.target.setPointerCapture(e.pointerId);
        return;
      }

      // 3) Window hit
      const winHit = findNearestWindow(rx, ry);
      if (winHit) {
        onSelect(winHit.id);
        setDragTarget({ type: 'window', windowId: winHit.id });
        e.target.setPointerCapture(e.pointerId);
        return;
      }

      // 4) Wall hit
      const wallHit = findNearestWall(rx, ry);
      if (wallHit) {
        onSelect(wallHit.wall.id);
        const ep = findNearestEndpoint(rx, ry);
        if (ep && ep.wallId === wallHit.wall.id) {
          setDragTarget({ type: 'endpoint', wallId: ep.wallId, whichEnd: ep.whichEnd });
        }
        e.target.setPointerCapture(e.pointerId);
        return;
      }

      // 4.5) Room hit (Floor selection)
      // Check from smallest area to largest area (so inner rooms are hit first if nested)
      const sortedLoops = [...closedLoops].sort((a, b) => a.area - b.area);
      for (const loop of sortedLoops) {
        if (pointInPolygon({ x: rx / SCALE, y: ry / SCALE }, loop.points)) {
          onSelect(loop.id);
          return;
        }
      }

      // 5) Empty space — deselect
      onSelect(null);
    }
  }

  function handlePointerMove(e) {
    const { rx, ry } = getRawCoords(e);

    if (mode === 'wall' && isDrawing) {
      setCurrentPoint(getSnappedCoords(e));

    } else if (mode === 'door' || mode === 'window') {
      const hit = findNearestWall(rx, ry);
      setHoveredWallId(hit ? hit.wall.id : null);

    } else if (mode === 'select' && dragTarget) {
      if (dragTarget.type === 'door') {
        const door = doors.find((d) => d.id === dragTarget.doorId);
        if (!door) return;
        const wall = walls.find((w) => w.id === door.wallId);
        if (!wall) return;
        const { t: rawT } = pointToSegmentInfo(
          rx, ry,
          wall.start.x * SCALE, wall.start.y * SCALE,
          wall.end.x * SCALE, wall.end.y * SCALE,
        );
        const clampedT = clampOpeningPosition(door.id, door.wallId, rawT, door.width);
        onMoveDoor(door.id, clampedT);

      } else if (dragTarget.type === 'window') {
        const win = windows.find((w) => w.id === dragTarget.windowId);
        if (!win) return;
        const wall = walls.find((w) => w.id === win.wallId);
        if (!wall) return;
        const { t: rawT } = pointToSegmentInfo(
          rx, ry,
          wall.start.x * SCALE, wall.start.y * SCALE,
          wall.end.x * SCALE, wall.end.y * SCALE,
        );
        const clampedT = clampOpeningPosition(win.id, win.wallId, rawT, win.width);
        onMoveWindow(win.id, clampedT);

      } else if (dragTarget.type === 'endpoint') {
        const snapped = getSnappedCoords(e);
        onMoveWallEndpoint(
          dragTarget.wallId,
          dragTarget.whichEnd,
          { x: snapped.x / SCALE, y: snapped.y / SCALE },
        );
      }
    }
  }

  function handlePointerUp(e) {
    if (mode === 'wall' && isDrawing) {
      setIsDrawing(false);
      const endPoint = getSnappedCoords(e);
      if (startPoint && (startPoint.x !== endPoint.x || startPoint.y !== endPoint.y)) {
        onAddWall({
          start: { x: startPoint.x / SCALE, y: startPoint.y / SCALE },
          end: { x: endPoint.x / SCALE, y: endPoint.y / SCALE },
          height: 3,
          thickness: 0.2,
        });
      }
      setStartPoint(null);
      setCurrentPoint(null);
    }
    if (dragTarget) setDragTarget(null);
  }

  // -------------------------------------------------------
  // SVG rendering — door icon
  // -------------------------------------------------------
  function renderDoorIcon(door, key) {
    const wall = walls.find((w) => w.id === door.wallId);
    if (!wall) return null;
    const ax = wall.start.x * SCALE, ay = wall.start.y * SCALE;
    const bx = wall.end.x * SCALE,   by = wall.end.y * SCALE;
    const cx = ax + door.position * (bx - ax);
    const cy = ay + door.position * (by - ay);
    const angle = Math.atan2(by - ay, bx - ax) * (180 / Math.PI);
    const iconW = door.width * SCALE;
    const iconH = 16;
    const isSelected = door.id === selectedId;
    const arcAngle = door.isOpen ? Math.PI / 2 : Math.PI / 3;
    const arcEndX = -iconW / 2 + iconW * Math.cos(arcAngle);
    const arcEndY = iconW / 2 * Math.sin(arcAngle);
    const strokeColor = isSelected ? '#22c55e' : '#f59e0b';
    const fillColor = isSelected ? 'rgba(34,197,94,0.15)' : '#0f172a';

    return (
      <g key={key} transform={`translate(${cx},${cy}) rotate(${angle})`}>
        {isSelected && (
          <circle r={iconW / 2 + 6} fill="none" stroke="#22c55e" strokeWidth={2} strokeDasharray="4 3" opacity={0.6} />
        )}
        <rect x={-iconW / 2} y={-iconH / 2} width={iconW} height={iconH} fill={fillColor} stroke={strokeColor} strokeWidth={1.5} />
        <path
          d={`M ${-iconW / 2} 0 A ${iconW / 2} ${iconW / 2} 0 0 1 ${arcEndX} ${arcEndY}`}
          fill="none" stroke={strokeColor} strokeWidth={1.5}
        />
        {door.isOpen && (
          <line x1={-iconW / 2} y1={0} x2={arcEndX} y2={arcEndY} stroke={strokeColor} strokeWidth={1} opacity={0.5} />
        )}
      </g>
    );
  }

  // -------------------------------------------------------
  // SVG rendering — window icon (two parallel lines = glass)
  // -------------------------------------------------------
  function renderWindowIcon(win, key) {
    const wall = walls.find((w) => w.id === win.wallId);
    if (!wall) return null;
    const ax = wall.start.x * SCALE, ay = wall.start.y * SCALE;
    const bx = wall.end.x * SCALE,   by = wall.end.y * SCALE;
    const cx = ax + win.position * (bx - ax);
    const cy = ay + win.position * (by - ay);
    const angle = Math.atan2(by - ay, bx - ax) * (180 / Math.PI);
    const iconW = win.width * SCALE;
    const iconH = 14;
    const isSelected = win.id === selectedId;
    const strokeColor = isSelected ? '#22c55e' : '#38bdf8';
    const fillColor = isSelected ? 'rgba(34,197,94,0.15)' : 'rgba(56,189,248,0.15)';

    return (
      <g key={key} transform={`translate(${cx},${cy}) rotate(${angle})`}>
        {isSelected && (
          <circle r={iconW / 2 + 6} fill="none" stroke="#22c55e" strokeWidth={2} strokeDasharray="4 3" opacity={0.6} />
        )}
        {/* Outer frame */}
        <rect x={-iconW / 2} y={-iconH / 2} width={iconW} height={iconH} fill={fillColor} stroke={strokeColor} strokeWidth={1.5} />
        {/* Centre mullion (vertical divider line) */}
        <line x1={0} y1={-iconH / 2} x2={0} y2={iconH / 2} stroke={strokeColor} strokeWidth={1} />
        {/* Horizontal bar */}
        <line x1={-iconW / 2} y1={0} x2={iconW / 2} y2={0} stroke={strokeColor} strokeWidth={1} />
      </g>
    );
  }

  // -------------------------------------------------------
  // Cursor logic
  // -------------------------------------------------------
  let cursorStyle = 'crosshair';
  if (mode === 'door' || mode === 'window') {
    cursorStyle = hoveredWallId ? 'cell' : 'not-allowed';
  } else if (mode === 'select') {
    cursorStyle = dragTarget ? 'grabbing' : 'default';
  }

  // -------------------------------------------------------
  // Render
  // -------------------------------------------------------
  return (
    <div
      className="canvas-2d-container"
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ touchAction: 'none', cursor: cursorStyle }}
    >
      <svg width="100%" height="100%" style={{ pointerEvents: 'none' }}>

        {/* ---- Rooms (Floor area) ---- */}
        {closedLoops.map(loop => (
          <polygon
            key={loop.id}
            points={loop.points.map(p => `${p.x * SCALE},${p.y * SCALE}`).join(' ')}
            fill={loop.id === selectedId ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.03)'}
            stroke="none"
          />
        ))}

        {/* ---- Walls ---- */}
        {walls.map((wall) => {
          const isSel = wall.id === selectedId;
          const isHov = wall.id === hoveredWallId;
          // Use the global wall color for normal state so it matches 3D view
          let stroke = materials.wallColor || '#3b82f6';
          if (isSel) stroke = '#22c55e';
          else if (isHov) stroke = '#f59e0b';
          return (
            <line
              key={wall.id}
              x1={wall.start.x * SCALE} y1={wall.start.y * SCALE}
              x2={wall.end.x * SCALE}   y2={wall.end.y * SCALE}
              stroke={stroke}
              strokeWidth={wall.thickness * SCALE}
              strokeLinecap="round"
            />
          );
        })}

        {/* ---- Wall endpoints ---- */}
        {walls.map((wall) => {
          const isSel = wall.id === selectedId;
          const dotFill = isSel ? '#22c55e' : '#ffffff';
          const dotR = isSel ? 6 : 4;
          return (
            <React.Fragment key={`pts-${wall.id}`}>
              <circle cx={wall.start.x * SCALE} cy={wall.start.y * SCALE} r={dotR} fill={dotFill} />
              <circle cx={wall.end.x * SCALE}   cy={wall.end.y * SCALE}   r={dotR} fill={dotFill} />
            </React.Fragment>
          );
        })}

        {/* ---- Drawing preview ---- */}
        {isDrawing && startPoint && currentPoint && (
          <line
            x1={startPoint.x} y1={startPoint.y}
            x2={currentPoint.x} y2={currentPoint.y}
            stroke="#60a5fa" strokeWidth={0.2 * SCALE} strokeLinecap="round" strokeDasharray="4 4"
          />
        )}

        {/* ---- Door icons ---- */}
        {doors.map((door, idx) => renderDoorIcon(door, `door-${door.id ?? idx}`))}

        {/* ---- Window icons ---- */}
        {windows.map((win, idx) => renderWindowIcon(win, `win-${win.id ?? idx}`))}
      </svg>
    </div>
  );
}

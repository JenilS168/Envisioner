import React, { useState, useRef, useMemo } from 'react';
import { pointInPolygon } from '../utils/geometry';
import {
  FURNITURE_CATALOG,
  furnitureFootprint,
  furnitureCorners,
  furnitureCornersAt,
  checkFurnitureOverlap,
} from '../utils/furniture';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const SCALE = 40;          // pixels per metre
const SNAP  = 20;          // pixels per snap-grid cell (0.5 m)
const HIT_THRESHOLD    = 12; // px — max distance for wall / opening click
const ENDPOINT_RADIUS  = 8;  // px — radius around wall endpoints
const ROTATE_HANDLE_OFFSET = 24; // px beyond half-depth edge to handle centre
const ROTATE_HANDLE_HIT    = 10; // px hit radius for the rotate grip circle

const FURNITURE_LABELS = {
  bed:            'BED',
  sofa:           'SOFA',
  table:          'TABLE',
  chair:          'CHR',
  wardrobe:       'WARD',
  kitchen_counter:'CNTR',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function snapCoord(raw) { return Math.round(raw / SNAP) * SNAP; }

function pointToSegmentInfo(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { distance: Math.hypot(px - ax, py - ay), t: 0 };
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return { distance: Math.hypot(px - (ax + t * dx), py - (ay + t * dy)), t };
}

function getRotateHandlePixelPos(item) {
  const { d } = furnitureFootprint(item);
  const halfD_px = (d * SCALE) / 2;
  const rad = ((item.rotation ?? 0) * Math.PI) / 180;
  return {
    x: item.x * SCALE + (halfD_px + ROTATE_HANDLE_OFFSET) * Math.sin(rad),
    y: item.y * SCALE - (halfD_px + ROTATE_HANDLE_OFFSET) * Math.cos(rad),
  };
}

// ---------------------------------------------------------------------------
// Canvas2D
// ---------------------------------------------------------------------------
/**
 * All pointer interactions use the three-phase pattern:
 *   pointerdown  → call onXxxStart() (saves snapshot in App)
 *   pointermove  → call onXxx() live handler (setStateOnly — no undo entry)
 *   pointerup    → call onCommitXxx() (pushState with snapshot — one undo entry)
 */
export default function Canvas2D({
  walls        = [],
  doors        = [],
  windows      = [],
  closedLoops  = [],
  materials    = {},
  furniture    = [],
  selectedFurnitureType = 'bed',
  snapRotation = true,
  mode,
  selectedId,
  onAddWall,
  onAddDoor,
  onAddWindow,
  onAddFurniture,
  onSelect,
  // Door move
  onDoorMoveStart,
  onMoveDoor,
  onCommitMoveDoor,
  // Window move
  onWindowMoveStart,
  onMoveWindow,
  onCommitMoveWindow,
  // Wall endpoint
  onEndpointStart,
  onMoveWallEndpoint,
  onCommitWallEndpoint,
  // Furniture move
  onFurnMoveStart,
  onMoveFurniture,
  onCommitMoveFurniture,
  // Furniture rotate
  onFurnRotateStart,
  onSetFurnitureRotation,
  onCommitFurnitureRotation,
  // Misc
  onToggleDoor,
}) {
  const containerRef = useRef(null);

  // Wall-drawing state
  const [isDrawing,    setIsDrawing]    = useState(false);
  const [startPoint,   setStartPoint]   = useState(null);
  const [currentPoint, setCurrentPoint] = useState(null);

  // Hover state
  const [hoveredWallId, setHoveredWallId] = useState(null);

  // Ghost preview for furniture mode
  const [ghostPos,    setGhostPos]    = useState(null);
  const [ghostLoopId, setGhostLoopId] = useState(null);

  // Drag state — tracks the TYPE of active drag plus the data needed to
  // drive it during pointermove and finalize it on pointerup.
  //
  //   { type:'door',             doorId, latestPosition }
  //   { type:'window',           windowId, latestPosition }
  //   { type:'endpoint',         wallId, whichEnd, latestCoords }
  //   { type:'furniture',        furnitureId, offsetX, offsetY, latestX, latestY }
  //   { type:'furniture-rotate', furnitureId, startAngleDeg, itemStartRotation, latestDeg }
  const [dragTarget, setDragTarget] = useState(null);

  // ---------------------------------------------------------------------------
  // Overlap detection (visual warning — no blocking)
  // ---------------------------------------------------------------------------
  const overlappingIds = useMemo(() => {
    const ids = new Set();
    for (let i = 0; i < furniture.length; i++) {
      for (let j = i + 1; j < furniture.length; j++) {
        if (
          furniture[i].roomId === furniture[j].roomId &&
          checkFurnitureOverlap(furniture[i], furniture[j])
        ) {
          ids.add(furniture[i].id);
          ids.add(furniture[j].id);
        }
      }
    }
    return ids;
  }, [furniture]);

  // ---------------------------------------------------------------------------
  // Coordinate helpers
  // ---------------------------------------------------------------------------
  function getRawCoords(e) {
    if (!containerRef.current) return { rx: 0, ry: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return { rx: e.clientX - rect.left, ry: e.clientY - rect.top };
  }
  function getSnappedCoords(e) {
    const { rx, ry } = getRawCoords(e);
    return { x: snapCoord(rx), y: snapCoord(ry) };
  }

  // ---------------------------------------------------------------------------
  // Hit-testing helpers
  // ---------------------------------------------------------------------------
  function findNearestWall(rx, ry) {
    let best = null, bestDist = HIT_THRESHOLD;
    for (const wall of walls) {
      const { distance, t } = pointToSegmentInfo(
        rx, ry,
        wall.start.x * SCALE, wall.start.y * SCALE,
        wall.end.x   * SCALE, wall.end.y   * SCALE,
      );
      if (distance < bestDist) { bestDist = distance; best = { wall, t }; }
    }
    return best;
  }

  function findNearestDoor(rx, ry) {
    let best = null, bestDist = HIT_THRESHOLD + 8;
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

  function findNearestWindow(rx, ry) {
    let best = null, bestDist = HIT_THRESHOLD + 8;
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

  function findNearestEndpoint(rx, ry) {
    for (const wall of walls) {
      const sx = wall.start.x * SCALE, sy = wall.start.y * SCALE;
      if (Math.hypot(rx - sx, ry - sy) < ENDPOINT_RADIUS)
        return { wallId: wall.id, whichEnd: 'start' };
      const ex = wall.end.x * SCALE, ey = wall.end.y * SCALE;
      if (Math.hypot(rx - ex, ry - ey) < ENDPOINT_RADIUS)
        return { wallId: wall.id, whichEnd: 'end' };
    }
    return null;
  }

  function findNearestFurniture(rx, ry) {
    for (let i = furniture.length - 1; i >= 0; i--) {
      const item = furniture[i];
      const cornersPx = furnitureCorners(item).map((c) => ({ x: c.x * SCALE, y: c.y * SCALE }));
      if (pointInPolygon({ x: rx, y: ry }, cornersPx)) return item;
    }
    return null;
  }

  function findLoopAtPoint(mx, my) {
    const sorted = [...closedLoops].sort((a, b) => a.area - b.area);
    for (const loop of sorted) {
      if (pointInPolygon({ x: mx, y: my }, loop.points)) return loop;
    }
    return null;
  }

  function allCornersInLoop(cx, cy, rotation, scale, type, loop) {
    const corners = furnitureCornersAt(cx, cy, rotation, scale ?? 1.0, type);
    return corners.every((c) => pointInPolygon(c, loop.points));
  }

  // ---------------------------------------------------------------------------
  // Opening clamp helper
  // ---------------------------------------------------------------------------
  function clampOpeningPosition(openingId, wallId, rawT, openingWidth) {
    const wall = walls.find((w) => w.id === wallId);
    if (!wall) return rawT;
    const wallLen = Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
    if (wallLen === 0) return rawT;
    const halfW = (openingWidth / 2) / wallLen;
    let t = Math.max(halfW, Math.min(1 - halfW, rawT));
    const siblings = [
      ...doors.filter((d) => d.wallId === wallId && d.id !== openingId),
      ...windows.filter((w) => w.wallId === wallId && w.id !== openingId),
    ];
    for (const sib of siblings) {
      const sibHalf = (sib.width / 2) / wallLen;
      const gap = halfW + sibHalf + 0.001;
      if (Math.abs(t - sib.position) < gap) {
        t = t < sib.position ? sib.position - gap : sib.position + gap;
      }
    }
    return Math.max(halfW, Math.min(1 - halfW, t));
  }

  // ---------------------------------------------------------------------------
  // Pointer event handlers
  // ---------------------------------------------------------------------------

  function handlePointerDown(e) {
    const { rx, ry } = getRawCoords(e);

    // ---- Wall drawing ----
    if (mode === 'wall') {
      const pt = getSnappedCoords(e);
      setStartPoint(pt);
      setCurrentPoint(pt);
      setIsDrawing(true);
      e.target.setPointerCapture(e.pointerId);
      return;
    }

    // ---- Door placement ----
    if (mode === 'door') {
      const hit = findNearestWall(rx, ry);
      if (hit) onAddDoor({ wallId: hit.wall.id, position: hit.t, width: 0.9, height: 2.1, isOpen: false });
      return;
    }

    // ---- Window placement ----
    if (mode === 'window') {
      const hit = findNearestWall(rx, ry);
      if (hit) onAddWindow({ wallId: hit.wall.id, position: hit.t, width: 1.2, height: 1.0, sillHeight: 1.0 });
      return;
    }

    // ---- Furniture placement ----
    if (mode === 'furniture') {
      const mx = rx / SCALE, my = ry / SCALE;
      const loop = findLoopAtPoint(mx, my);
      if (loop && onAddFurniture) {
        const cat = FURNITURE_CATALOG[selectedFurnitureType] || FURNITURE_CATALOG.table;
        onAddFurniture({ type: selectedFurnitureType, roomId: loop.id, x: mx, y: my, rotation: 0, scale: 1.0, color: cat.color });
      }
      return;
    }

    // ---- Select mode ----
    if (mode === 'select') {
      // 0. Rotate handle — must be tested before furniture body
      if (selectedId) {
        const selFurn = furniture.find((f) => f.id === selectedId);
        if (selFurn) {
          const hp = getRotateHandlePixelPos(selFurn);
          if (Math.hypot(rx - hp.x, ry - hp.y) <= ROTATE_HANDLE_HIT) {
            // Snapshot BEFORE starting the rotate drag
            onFurnRotateStart && onFurnRotateStart();
            const itemCx = selFurn.x * SCALE;
            const itemCy = selFurn.y * SCALE;
            setDragTarget({
              type:               'furniture-rotate',
              furnitureId:         selFurn.id,
              startAngleDeg:       Math.atan2(ry - itemCy, rx - itemCx) * 180 / Math.PI,
              itemStartRotation:   selFurn.rotation ?? 0,
              latestDeg:           selFurn.rotation ?? 0,
            });
            e.target.setPointerCapture(e.pointerId);
            return;
          }
        }

        // Wall endpoint drag
        const ep = findNearestEndpoint(rx, ry);
        if (ep && ep.wallId === selectedId) {
          // Snapshot BEFORE endpoint drag
          onEndpointStart && onEndpointStart();
          setDragTarget({ type: 'endpoint', wallId: ep.wallId, whichEnd: ep.whichEnd, latestCoords: null });
          e.target.setPointerCapture(e.pointerId);
          return;
        }
      }

      // 1. Door
      const doorHit = findNearestDoor(rx, ry);
      if (doorHit) {
        onSelect(doorHit.id);
        // Snapshot BEFORE door drag
        onDoorMoveStart && onDoorMoveStart();
        setDragTarget({ type: 'door', doorId: doorHit.id, latestPosition: doorHit.position });
        e.target.setPointerCapture(e.pointerId);
        return;
      }

      // 2. Window
      const winHit = findNearestWindow(rx, ry);
      if (winHit) {
        onSelect(winHit.id);
        // Snapshot BEFORE window drag
        onWindowMoveStart && onWindowMoveStart();
        setDragTarget({ type: 'window', windowId: winHit.id, latestPosition: winHit.position });
        e.target.setPointerCapture(e.pointerId);
        return;
      }

      // 3. Furniture body
      const furnHit = findNearestFurniture(rx, ry);
      if (furnHit) {
        onSelect(furnHit.id);
        // Snapshot BEFORE furniture move drag
        onFurnMoveStart && onFurnMoveStart();
        setDragTarget({
          type:        'furniture',
          furnitureId: furnHit.id,
          offsetX:     furnHit.x - rx / SCALE,
          offsetY:     furnHit.y - ry / SCALE,
          latestX:     furnHit.x,
          latestY:     furnHit.y,
        });
        e.target.setPointerCapture(e.pointerId);
        return;
      }

      // 4. Wall
      const wallHit = findNearestWall(rx, ry);
      if (wallHit) {
        onSelect(wallHit.wall.id);
        const ep = findNearestEndpoint(rx, ry);
        if (ep && ep.wallId === wallHit.wall.id) {
          onEndpointStart && onEndpointStart();
          setDragTarget({ type: 'endpoint', wallId: ep.wallId, whichEnd: ep.whichEnd, latestCoords: null });
          e.target.setPointerCapture(e.pointerId);
        }
        return;
      }

      // 5. Room floor
      const sortedLoops = [...closedLoops].sort((a, b) => a.area - b.area);
      for (const loop of sortedLoops) {
        if (pointInPolygon({ x: rx / SCALE, y: ry / SCALE }, loop.points)) {
          onSelect(loop.id);
          return;
        }
      }

      // 6. Empty space
      onSelect(null);
    }
  }

  function handlePointerMove(e) {
    const { rx, ry } = getRawCoords(e);

    if (mode === 'wall' && isDrawing) {
      setCurrentPoint(getSnappedCoords(e));
      return;
    }

    if (mode === 'door' || mode === 'window') {
      const hit = findNearestWall(rx, ry);
      setHoveredWallId(hit ? hit.wall.id : null);
      return;
    }

    if (mode === 'furniture') {
      const mx = rx / SCALE, my = ry / SCALE;
      const loop = findLoopAtPoint(mx, my);
      setGhostPos({ x: mx, y: my });
      setGhostLoopId(loop ? loop.id : null);
      return;
    }

    if (mode === 'select' && dragTarget) {
      if (dragTarget.type === 'door') {
        const door = doors.find((d) => d.id === dragTarget.doorId);
        if (!door) return;
        const wall = walls.find((w) => w.id === door.wallId);
        if (!wall) return;
        const { t: rawT } = pointToSegmentInfo(rx, ry,
          wall.start.x * SCALE, wall.start.y * SCALE,
          wall.end.x * SCALE, wall.end.y * SCALE);
        const clamped = clampOpeningPosition(door.id, door.wallId, rawT, door.width);
        // Live update — no history
        onMoveDoor && onMoveDoor(door.id, clamped);
        setDragTarget((prev) => ({ ...prev, latestPosition: clamped }));

      } else if (dragTarget.type === 'window') {
        const win = windows.find((w) => w.id === dragTarget.windowId);
        if (!win) return;
        const wall = walls.find((w) => w.id === win.wallId);
        if (!wall) return;
        const { t: rawT } = pointToSegmentInfo(rx, ry,
          wall.start.x * SCALE, wall.start.y * SCALE,
          wall.end.x * SCALE, wall.end.y * SCALE);
        const clamped = clampOpeningPosition(win.id, win.wallId, rawT, win.width);
        // Live update — no history
        onMoveWindow && onMoveWindow(win.id, clamped);
        setDragTarget((prev) => ({ ...prev, latestPosition: clamped }));

      } else if (dragTarget.type === 'endpoint') {
        const snapped = getSnappedCoords(e);
        const newCoords = { x: snapped.x / SCALE, y: snapped.y / SCALE };
        // Live update — no history
        onMoveWallEndpoint && onMoveWallEndpoint(dragTarget.wallId, dragTarget.whichEnd, newCoords);
        setDragTarget((prev) => ({ ...prev, latestCoords: newCoords }));

      } else if (dragTarget.type === 'furniture') {
        const item = furniture.find((f) => f.id === dragTarget.furnitureId);
        if (!item) return;
        const proposedX = rx / SCALE + dragTarget.offsetX;
        const proposedY = ry / SCALE + dragTarget.offsetY;
        const loop = closedLoops.find((l) => l.id === item.roomId);
        if (!loop) return;
        if (allCornersInLoop(proposedX, proposedY, item.rotation ?? 0, item.scale ?? 1.0, item.type, loop)) {
          // Live update — no history
          onMoveFurniture && onMoveFurniture(item.id, proposedX, proposedY);
          setDragTarget((prev) => ({ ...prev, latestX: proposedX, latestY: proposedY }));
        }

      } else if (dragTarget.type === 'furniture-rotate') {
        const item = furniture.find((f) => f.id === dragTarget.furnitureId);
        if (!item) return;
        const itemCx = item.x * SCALE;
        const itemCy = item.y * SCALE;
        const currentAngleDeg = Math.atan2(ry - itemCy, rx - itemCx) * 180 / Math.PI;
        const deltaAngle = currentAngleDeg - dragTarget.startAngleDeg;
        let newRotation = ((dragTarget.itemStartRotation + deltaAngle) % 360 + 360) % 360;
        if (snapRotation) newRotation = (Math.round(newRotation / 15) * 15) % 360;
        const loop = closedLoops.find((l) => l.id === item.roomId);
        const valid = !loop || allCornersInLoop(item.x, item.y, newRotation, item.scale ?? 1.0, item.type, loop);
        if (valid) {
          // Live update — no history
          onSetFurnitureRotation && onSetFurnitureRotation(item.id, newRotation);
          setDragTarget((prev) => ({ ...prev, latestDeg: newRotation }));
        }
      }
    }
  }

  function handlePointerUp(e) {
    // ---- Wall drawing commit ----
    if (mode === 'wall' && isDrawing) {
      setIsDrawing(false);
      const endPt = getSnappedCoords(e);
      if (startPoint && (startPoint.x !== endPt.x || startPoint.y !== endPt.y)) {
        onAddWall({
          start: { x: startPoint.x / SCALE, y: startPoint.y / SCALE },
          end:   { x: endPt.x / SCALE, y: endPt.y / SCALE },
          height: 3, thickness: 0.2,
        });
      }
      setStartPoint(null);
      setCurrentPoint(null);
      return;
    }

    // ---- Drag commit (one history entry) ----
    if (dragTarget) {
      if (dragTarget.type === 'door' && dragTarget.latestPosition != null) {
        const door = doors.find((d) => d.id === dragTarget.doorId);
        if (door) onCommitMoveDoor && onCommitMoveDoor(door.id, dragTarget.latestPosition);

      } else if (dragTarget.type === 'window' && dragTarget.latestPosition != null) {
        const win = windows.find((w) => w.id === dragTarget.windowId);
        if (win) onCommitMoveWindow && onCommitMoveWindow(win.id, dragTarget.latestPosition);

      } else if (dragTarget.type === 'endpoint' && dragTarget.latestCoords != null) {
        onCommitWallEndpoint && onCommitWallEndpoint(
          dragTarget.wallId, dragTarget.whichEnd, dragTarget.latestCoords
        );

      } else if (dragTarget.type === 'furniture' && dragTarget.latestX != null) {
        onCommitMoveFurniture && onCommitMoveFurniture(
          dragTarget.furnitureId, dragTarget.latestX, dragTarget.latestY
        );

      } else if (dragTarget.type === 'furniture-rotate') {
        onCommitFurnitureRotation && onCommitFurnitureRotation(
          dragTarget.furnitureId, dragTarget.latestDeg
        );
      }

      setDragTarget(null);
    }
  }

  // ---------------------------------------------------------------------------
  // SVG sub-renders
  // ---------------------------------------------------------------------------

  function renderDoorIcon(door, key) {
    const wall = walls.find((w) => w.id === door.wallId);
    if (!wall) return null;
    const ax = wall.start.x * SCALE, ay = wall.start.y * SCALE;
    const bx = wall.end.x   * SCALE, by = wall.end.y   * SCALE;
    const cx = ax + door.position * (bx - ax);
    const cy = ay + door.position * (by - ay);
    const angle  = Math.atan2(by - ay, bx - ax) * (180 / Math.PI);
    const iconW  = door.width * SCALE;
    const iconH  = 16;
    const isSelected = door.id === selectedId;
    const strokeColor = isSelected ? '#22c55e' : '#f59e0b';
    const fillColor   = isSelected ? 'rgba(34,197,94,0.15)' : '#0f172a';
    const arcAngle    = door.isOpen ? Math.PI / 2 : Math.PI / 3;
    const arcEndX     = -iconW / 2 + iconW * Math.cos(arcAngle);
    const arcEndY     = (iconW / 2) * Math.sin(arcAngle);
    return (
      <g key={key} transform={`translate(${cx},${cy}) rotate(${angle})`}>
        {isSelected && (
          <circle r={iconW / 2 + 6} fill="none" stroke="#22c55e"
            strokeWidth={2} strokeDasharray="4 3" opacity={0.6} />
        )}
        <rect x={-iconW/2} y={-iconH/2} width={iconW} height={iconH}
          fill={fillColor} stroke={strokeColor} strokeWidth={1.5} />
        <path d={`M ${-iconW/2} 0 A ${iconW/2} ${iconW/2} 0 0 1 ${arcEndX} ${arcEndY}`}
          fill="none" stroke={strokeColor} strokeWidth={1.5} />
        {door.isOpen && (
          <line x1={-iconW/2} y1={0} x2={arcEndX} y2={arcEndY}
            stroke={strokeColor} strokeWidth={1} opacity={0.5} />
        )}
      </g>
    );
  }

  function renderWindowIcon(win, key) {
    const wall = walls.find((w) => w.id === win.wallId);
    if (!wall) return null;
    const ax = wall.start.x * SCALE, ay = wall.start.y * SCALE;
    const bx = wall.end.x   * SCALE, by = wall.end.y   * SCALE;
    const cx = ax + win.position * (bx - ax);
    const cy = ay + win.position * (by - ay);
    const angle  = Math.atan2(by - ay, bx - ax) * (180 / Math.PI);
    const iconW  = win.width * SCALE;
    const iconH  = 14;
    const isSelected = win.id === selectedId;
    const strokeColor = isSelected ? '#22c55e' : '#38bdf8';
    const fillColor   = isSelected ? 'rgba(34,197,94,0.15)' : 'rgba(56,189,248,0.15)';
    return (
      <g key={key} transform={`translate(${cx},${cy}) rotate(${angle})`}>
        {isSelected && (
          <circle r={iconW / 2 + 6} fill="none" stroke="#22c55e"
            strokeWidth={2} strokeDasharray="4 3" opacity={0.6} />
        )}
        <rect x={-iconW/2} y={-iconH/2} width={iconW} height={iconH}
          fill={fillColor} stroke={strokeColor} strokeWidth={1.5} />
        <line x1={0} y1={-iconH/2} x2={0} y2={iconH/2} stroke={strokeColor} strokeWidth={1} />
        <line x1={-iconW/2} y1={0} x2={iconW/2} y2={0} stroke={strokeColor} strokeWidth={1} />
      </g>
    );
  }

  function renderFurnitureItem(item, key) {
    const { w, d } = furnitureFootprint(item);
    const cx = item.x * SCALE;
    const cy = item.y * SCALE;
    const pw = w * SCALE;
    const ph = d * SCALE;
    const rotDeg = item.rotation ?? 0;
    const isSelected    = item.id === selectedId;
    const isOverlapping = overlappingIds.has(item.id);
    const baseColor = item.color || FURNITURE_CATALOG[item.type]?.color || '#888888';
    const label    = FURNITURE_LABELS[item.type] || item.type.slice(0, 4).toUpperCase();
    const fontSize = Math.max(7, Math.min(pw, ph) * 0.28);
    const stroke      = isOverlapping ? '#ef4444' : isSelected ? '#22c55e' : 'rgba(255,255,255,0.35)';
    const strokeWidth = isOverlapping ? 3 : isSelected ? 2.5 : 1;
    const handleOffsetPx = ph / 2 + ROTATE_HANDLE_OFFSET;
    return (
      <g key={key} transform={`translate(${cx}, ${cy}) rotate(${rotDeg})`}>
        <rect x={-pw/2} y={-ph/2} width={pw} height={ph}
          fill={baseColor} fillOpacity={isSelected ? 0.92 : 0.72}
          stroke={stroke} strokeWidth={strokeWidth} rx={3} />
        {isSelected && !isOverlapping && (
          <rect x={-pw/2-4} y={-ph/2-4} width={pw+8} height={ph+8}
            fill="none" stroke="#22c55e" strokeWidth={1.5} strokeDasharray="5 3" rx={4} opacity={0.65} />
        )}
        {isOverlapping && (
          <rect x={-pw/2-4} y={-ph/2-4} width={pw+8} height={ph+8}
            fill="none" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 3" rx={4} opacity={0.75} />
        )}
        <text x={0} y={fontSize * 0.38} textAnchor="middle" fontSize={fontSize}
          fill="rgba(255,255,255,0.9)" fontWeight="700" fontFamily="system-ui, sans-serif"
          style={{ pointerEvents: 'none', userSelect: 'none' }}>
          {label}
        </text>
        {isSelected && mode === 'select' && (
          <>
            <line x1={0} y1={-ph/2} x2={0} y2={-handleOffsetPx}
              stroke="#a78bfa" strokeWidth={1.5} strokeDasharray="3 3"
              style={{ pointerEvents: 'none' }} />
            <circle cx={0} cy={-handleOffsetPx} r={7}
              fill="#a78bfa" fillOpacity={0.9} stroke="white" strokeWidth={1.5}
              style={{ cursor: 'grab' }} />
            <text x={11} y={-handleOffsetPx+4} fontSize={9} fill="#a78bfa"
              fontFamily="system-ui, sans-serif"
              style={{ pointerEvents: 'none', userSelect: 'none' }}>
              {Math.round(rotDeg)}°
            </text>
          </>
        )}
      </g>
    );
  }

  // Ghost preview
  const ghostRect = (() => {
    if (mode !== 'furniture' || !ghostPos || !ghostLoopId || !selectedFurnitureType) return null;
    const cat = FURNITURE_CATALOG[selectedFurnitureType];
    if (!cat) return null;
    const pw = cat.footprintW * SCALE;
    const ph = cat.footprintD * SCALE;
    return (
      <rect x={ghostPos.x * SCALE - pw/2} y={ghostPos.y * SCALE - ph/2}
        width={pw} height={ph} fill={cat.color} fillOpacity={0.28}
        stroke={cat.color} strokeWidth={1.5} strokeDasharray="6 3" rx={3}
        style={{ pointerEvents: 'none' }} />
    );
  })();

  let cursorStyle = 'crosshair';
  if (mode === 'door' || mode === 'window') cursorStyle = hoveredWallId ? 'cell' : 'not-allowed';
  else if (mode === 'furniture') cursorStyle = ghostLoopId ? 'copy' : 'not-allowed';
  else if (mode === 'select') {
    if (dragTarget?.type === 'furniture-rotate') cursorStyle = 'grab';
    else if (dragTarget) cursorStyle = 'grabbing';
    else cursorStyle = 'default';
  }

  return (
    <div className="canvas-2d-container" ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ touchAction: 'none', cursor: cursorStyle }}>
      <svg width="100%" height="100%" style={{ display: 'block' }}>

        {/* Room fills */}
        {closedLoops.map((loop) => (
          <polygon key={loop.id}
            points={loop.points.map((p) => `${p.x * SCALE},${p.y * SCALE}`).join(' ')}
            fill={loop.id === selectedId ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.03)'}
            stroke="none" style={{ pointerEvents: 'none' }} />
        ))}

        {/* Furniture */}
        {furniture.map((item, idx) => renderFurnitureItem(item, `furn-${item.id ?? idx}`))}

        {/* Ghost preview */}
        {ghostRect}

        {/* Walls */}
        {walls.map((wall) => {
          const isSel = wall.id === selectedId;
          const isHov = wall.id === hoveredWallId;
          const baseColor = wall.material?.color || materials.wallColor || '#3b82f6';
          const stroke = isSel ? '#22c55e' : isHov ? '#f59e0b' : baseColor;
          return (
            <line key={wall.id}
              x1={wall.start.x * SCALE} y1={wall.start.y * SCALE}
              x2={wall.end.x   * SCALE} y2={wall.end.y   * SCALE}
              stroke={stroke} strokeWidth={wall.thickness * SCALE} strokeLinecap="round" />
          );
        })}

        {/* Wall endpoint dots */}
        {walls.map((wall) => {
          const isSel = wall.id === selectedId;
          const r = isSel ? 6 : 4;
          const fill = isSel ? '#22c55e' : '#ffffff';
          return (
            <React.Fragment key={`ep-${wall.id}`}>
              <circle cx={wall.start.x * SCALE} cy={wall.start.y * SCALE} r={r} fill={fill} />
              <circle cx={wall.end.x   * SCALE} cy={wall.end.y   * SCALE} r={r} fill={fill} />
            </React.Fragment>
          );
        })}

        {/* Wall-draw preview */}
        {isDrawing && startPoint && currentPoint && (
          <line x1={startPoint.x} y1={startPoint.y} x2={currentPoint.x} y2={currentPoint.y}
            stroke="#60a5fa" strokeWidth={0.2 * SCALE} strokeLinecap="round" strokeDasharray="4 4"
            style={{ pointerEvents: 'none' }} />
        )}

        {/* Doors */}
        {doors.map((door, idx) => renderDoorIcon(door, `door-${door.id ?? idx}`))}

        {/* Windows */}
        {windows.map((win, idx) => renderWindowIcon(win, `win-${win.id ?? idx}`))}

      </svg>
    </div>
  );
}

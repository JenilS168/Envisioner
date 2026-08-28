import React, { useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { FURNITURE_CATALOG, furnitureFootprint, checkFurnitureOverlap } from '../utils/furniture';
import { findClosedLoops } from '../utils/geometry';


// ---------------------------------------------------------------------------
// Procedural canvas textures — no external images, works offline
// ---------------------------------------------------------------------------

function makeBrickTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#b5651d';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#c8753e';
  const brickW = 64, brickH = 32, gap = 4;
  for (let row = 0; row < size / brickH; row++) {
    const offsetX = (row % 2 === 0) ? 0 : brickW / 2;
    for (let col = -1; col < size / brickW + 1; col++) {
      ctx.fillRect(col * brickW + offsetX + gap / 2, row * brickH + gap / 2, brickW - gap, brickH - gap);
    }
  }
  ctx.strokeStyle = '#8b4513';
  ctx.lineWidth = gap;
  return new THREE.CanvasTexture(canvas);
}

function makeConcreteTexture(tint = '#94a3b8') {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = Math.random() * 2;
    const alpha = Math.random() * 0.12;
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return new THREE.CanvasTexture(canvas);
}

function makeWoodTexture(tint = '#8b5a2b') {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, size, size);
  const grainCount = 18;
  for (let i = 0; i < grainCount; i++) {
    const y = (i / grainCount) * size;
    const grainWidth = 1 + Math.random() * 2;
    ctx.strokeStyle = `rgba(0,0,0,${0.08 + Math.random() * 0.1})`;
    ctx.lineWidth = grainWidth;
    ctx.beginPath();
    ctx.moveTo(0, y + Math.random() * 4);
    ctx.bezierCurveTo(size * 0.3, y + Math.random() * 8, size * 0.7, y - Math.random() * 8, size, y + Math.random() * 4);
    ctx.stroke();
  }
  return new THREE.CanvasTexture(canvas);
}

function makeTilesTexture(tint = '#555555') {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, size, size);
  const tileW = 64, tileH = 40, gap = 3;
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = gap;
  for (let row = 0; row < size / tileH + 1; row++) {
    for (let col = 0; col < size / tileW + 1; col++) {
      ctx.strokeRect(col * tileW + gap / 2, row * tileH + gap / 2, tileW - gap, tileH - gap);
    }
  }
  return new THREE.CanvasTexture(canvas);
}

function makeMetalTexture(tint = '#708090') {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, tint);
  grad.addColorStop(0.5, '#c0c8d0');
  grad.addColorStop(1, tint);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 16; i++) {
    const y = (i / 16) * size;
    ctx.fillStyle = `rgba(255,255,255,0.07)`;
    ctx.fillRect(0, y, size, 6);
  }
  return new THREE.CanvasTexture(canvas);
}

// ---------------------------------------------------------------------------
// makeTexture — builds a texture for a given preset + color combo.
// Called once per unique (preset, color) combination via memoization in components.
// ---------------------------------------------------------------------------
function makeTexture(preset, color) {
  switch (preset) {
    case 'brick':    return makeBrickTexture();
    case 'concrete': return makeConcreteTexture(color);
    case 'wood':     return makeWoodTexture(color);
    case 'tiles':    return makeTilesTexture(color);
    case 'metal':    return makeMetalTexture(color);
    default:         return null;
  }
}

// ---------------------------------------------------------------------------
// darkenColor — multiplies an RGB hex toward black by the given factor.
// Used to derive dark-shade colours for furniture component accents.
// ---------------------------------------------------------------------------
function darkenColor(hex, factor = 0.62) {
  const num = parseInt((hex || '#888888').replace('#', ''), 16);
  const r = Math.max(0, Math.floor(((num >> 16) & 0xff) * factor));
  const g = Math.max(0, Math.floor(((num >> 8) & 0xff) * factor));
  const b = Math.max(0, Math.floor((num & 0xff) * factor));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// WallSegment — a single box slab (part of a wall)
// Memoizes its own texture by (preset, color) so each wall is independent.
// ---------------------------------------------------------------------------
function WallSegment({ position, angle, length, height, thickness, isSelected, onClick, wallColor, wallPreset }) {
  if (length <= 0 || height <= 0) return null;

  // Memoize texture per unique (preset, color) combo for this segment
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const wallTexture = useMemo(
    () => makeTexture(wallPreset, wallColor),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wallPreset, wallColor]
  );

  return (
    <mesh position={position} rotation={[0, -angle, 0]} castShadow receiveShadow onClick={onClick}>
      <boxGeometry args={[length, height, thickness]} />
      <meshStandardMaterial
        color={isSelected ? '#86efac' : wallColor}
        map={!isSelected ? wallTexture : null}
        roughness={0.7}
      />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Door3D — frame + openable panel
// ---------------------------------------------------------------------------
function Door3D({ door, wallStart, wallAngle, wallUx, wallUz, wallLength, wallThickness, isSelected, onClick, frameColor, panelColor }) {
  const { position: tPos, width: doorW, height: doorH, isOpen } = door;
  const centreMetre = tPos * wallLength;
  const worldX = wallStart.x + wallUx * centreMetre;
  const worldZ = wallStart.y + wallUz * centreMetre;

  const frameThick = 0.04;
  const frameDepth = wallThickness + 0.02;
  const panelW = doorW - frameThick * 2;
  const panelH = doorH - frameThick * 2;
  const panelDepth = 0.04;
  const hingeAngle = isOpen ? (85 * Math.PI) / 180 : 0;
  const color = isSelected ? '#a3e635' : panelColor;
  const frameCol = isSelected ? '#6b9c45' : frameColor;

  return (
    <group position={[worldX, 0, worldZ]} rotation={[0, -wallAngle, 0]}
      onClick={(e) => { e.stopPropagation(); onClick && onClick(); }}>
      {/* Left jamb */}
      <mesh position={[-doorW / 2 + frameThick / 2, doorH / 2, 0]} castShadow>
        <boxGeometry args={[frameThick, doorH, frameDepth]} />
        <meshStandardMaterial color={frameCol} roughness={0.8} />
      </mesh>
      {/* Right jamb */}
      <mesh position={[doorW / 2 - frameThick / 2, doorH / 2, 0]} castShadow>
        <boxGeometry args={[frameThick, doorH, frameDepth]} />
        <meshStandardMaterial color={frameCol} roughness={0.8} />
      </mesh>
      {/* Top lintel */}
      <mesh position={[0, doorH - frameThick / 2, 0]} castShadow>
        <boxGeometry args={[doorW, frameThick, frameDepth]} />
        <meshStandardMaterial color={frameCol} roughness={0.8} />
      </mesh>
      {/* Bottom sill */}
      <mesh position={[0, frameThick / 2, 0]} castShadow>
        <boxGeometry args={[doorW, frameThick, frameDepth]} />
        <meshStandardMaterial color={frameCol} roughness={0.8} />
      </mesh>
      {/* Panel (openable) — pivots on left hinge edge */}
      <group position={[-panelW / 2, frameThick, 0]} rotation={[0, hingeAngle, 0]}>
        <mesh position={[panelW / 2, panelH / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[panelW, panelH, panelDepth]} />
          <meshStandardMaterial color={color} roughness={0.5} />
        </mesh>
        {/* Handle */}
        <mesh position={[panelW - 0.08, panelH / 2, panelDepth / 2 + 0.015]}>
          <sphereGeometry args={[0.03, 12, 12]} />
          <meshStandardMaterial color="#c0c0c0" metalness={0.8} roughness={0.2} />
        </mesh>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Window3D — frame + semi-transparent glass pane
// ---------------------------------------------------------------------------
function Window3D({ win, wallStart, wallAngle, wallUx, wallUz, wallLength, wallThickness, isSelected, onClick, frameColor, glassColor }) {
  const { position: tPos, width: winW, height: winH, sillHeight } = win;
  const centreMetre = tPos * wallLength;
  const worldX = wallStart.x + wallUx * centreMetre;
  const worldZ = wallStart.y + wallUz * centreMetre;

  const frameThick = 0.035;
  const frameDepth = wallThickness + 0.02;
  const glassW = winW - frameThick * 2;
  const glassH = winH - frameThick * 2;
  const glassDepth = 0.01;

  const frameCol = isSelected ? '#86efac' : frameColor;
  const glassCol = isSelected ? '#bbf7d0' : glassColor;

  return (
    <group
      position={[worldX, sillHeight, worldZ]}
      rotation={[0, -wallAngle, 0]}
      onClick={(e) => { e.stopPropagation(); onClick && onClick(); }}
    >
      <mesh position={[-winW / 2 + frameThick / 2, winH / 2, 0]}>
        <boxGeometry args={[frameThick, winH, frameDepth]} />
        <meshStandardMaterial color={frameCol} roughness={0.4} />
      </mesh>
      <mesh position={[winW / 2 - frameThick / 2, winH / 2, 0]}>
        <boxGeometry args={[frameThick, winH, frameDepth]} />
        <meshStandardMaterial color={frameCol} roughness={0.4} />
      </mesh>
      <mesh position={[0, winH - frameThick / 2, 0]}>
        <boxGeometry args={[winW, frameThick, frameDepth]} />
        <meshStandardMaterial color={frameCol} roughness={0.4} />
      </mesh>
      <mesh position={[0, frameThick / 2, 0]}>
        <boxGeometry args={[winW, frameThick, frameDepth]} />
        <meshStandardMaterial color={frameCol} roughness={0.4} />
      </mesh>
      <mesh position={[0, winH / 2, 0]}>
        <boxGeometry args={[frameThick * 0.7, winH - frameThick * 2, frameDepth * 0.8]} />
        <meshStandardMaterial color={frameCol} roughness={0.4} />
      </mesh>
      <mesh position={[0, winH / 2, 0]}>
        <boxGeometry args={[winW - frameThick * 2, frameThick * 0.7, frameDepth * 0.8]} />
        <meshStandardMaterial color={frameCol} roughness={0.4} />
      </mesh>
      <mesh position={[0, winH / 2, 0]}>
        <boxGeometry args={[glassW, glassH, glassDepth]} />
        <meshStandardMaterial color={glassCol} transparent opacity={0.35} roughness={0.1} metalness={0.1} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// FlatRoof3D — extruded flat slab over a closed wall loop
// ---------------------------------------------------------------------------
function FlatRoof3D({ loop, wallHeight = 3, roofColor, roofPreset }) {
  const { points } = loop;

  const roofTexture = useMemo(
    () => makeTexture(roofPreset, roofColor),
    [roofPreset, roofColor]
  );

  const shape = useMemo(() => {
    const s = new THREE.Shape();
    if (!points || points.length < 3) return s;
    s.moveTo(points[0].x, -points[0].y);
    for (let i = 1; i < points.length; i++) {
      s.lineTo(points[i].x, -points[i].y);
    }
    s.closePath();
    return s;
  }, [points]);

  const extrudeSettings = useMemo(
    () => ({ depth: 0.18, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.06, bevelThickness: 0.06 }),
    []
  );

  return (
    <mesh position={[0, wallHeight, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
      <extrudeGeometry args={[shape, extrudeSettings]} />
      <meshStandardMaterial
        color={roofColor}
        map={roofTexture || null}
        roughness={0.6}
        metalness={0.1}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// GableRoof3D — hip-style pitched roof
// ---------------------------------------------------------------------------
function GableRoof3D({ loop, wallHeight = 3, roofHeight = 1.5, roofColor, roofPreset }) {
  const { points } = loop;

  const roofTexture = useMemo(
    () => makeTexture(roofPreset, roofColor),
    [roofPreset, roofColor]
  );

  const roofGeometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    if (!points || points.length < 3) return geom;

    let cx = 0, cy = 0;
    points.forEach(p => { cx += p.x; cy += p.y; });
    cx /= points.length;
    cy /= points.length;

    const overhang = 0.25;
    const roofPositions = [];
    const peakY = wallHeight + roofHeight;
    const eaveY = wallHeight;

    for (let i = 0; i < points.length; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % points.length];

      const dx1 = p1.x - cx; const dz1 = p1.y - cy;
      const len1 = Math.hypot(dx1, dz1);
      const ex1 = len1 > 0 ? p1.x + (dx1 / len1) * overhang : p1.x;
      const ez1 = len1 > 0 ? p1.y + (dz1 / len1) * overhang : p1.y;

      const dx2 = p2.x - cx; const dz2 = p2.y - cy;
      const len2 = Math.hypot(dx2, dz2);
      const ex2 = len2 > 0 ? p2.x + (dx2 / len2) * overhang : p2.x;
      const ez2 = len2 > 0 ? p2.y + (dz2 / len2) * overhang : p2.y;

      roofPositions.push(cx, peakY, cy, ex2, eaveY, ez2, ex1, eaveY, ez1);
    }

    geom.setAttribute('position', new THREE.Float32BufferAttribute(roofPositions, 3));
    geom.computeVertexNormals();
    return geom;
  }, [points, wallHeight, roofHeight]);

  return (
    <group>
      <mesh geometry={roofGeometry} castShadow receiveShadow>
        <meshStandardMaterial
          color={roofColor}
          map={roofTexture || null}
          roughness={0.55}
          metalness={0.15}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Wall3D — renders one wall with cutouts for both doors AND windows.
// Resolves per-wall material (wall.material) with fallback to globals.
// ---------------------------------------------------------------------------
function Wall3D({
  wall, wallDoors, wallWindows, isSelected, selectedId,
  onWallClick, onDoorClick, onWindowClick,
  globalMaterials,
}) {
  const { start, end, height, thickness } = wall;

  // Resolve this wall's effective color and preset (per-wall overrides global)
  const wallColor  = wall.material?.color  ?? globalMaterials.wallColor;
  const wallPreset = wall.material?.preset ?? globalMaterials.wallPreset;

  const geom = useMemo(() => {
    const dx = end.x - start.x;
    const dz = end.y - start.y;
    const length = Math.hypot(dx, dz);
    const angle = Math.atan2(dz, dx);
    const ux = length > 0 ? dx / length : 0;
    const uz = length > 0 ? dz / length : 0;
    return { dx, dz, length, angle, ux, uz };
  }, [start, end]);

  const cuts = useMemo(() => {
    const allOpenings = [
      ...wallDoors.map((d) => ({
        position: d.position, width: d.width,
        yBottom: 0, yTop: d.height, source: d,
      })),
      ...wallWindows.map((w) => ({
        position: w.position, width: w.width,
        yBottom: w.sillHeight, yTop: w.sillHeight + w.height, source: w,
      })),
    ];

    return allOpenings
      .map((op) => {
        const centreMetre = op.position * geom.length;
        const halfWidth = op.width / 2;
        return {
          start: Math.max(0, centreMetre - halfWidth),
          end: Math.min(geom.length, centreMetre + halfWidth),
          yBottom: op.yBottom,
          yTop: Math.min(op.yTop, height),
          source: op.source,
        };
      })
      .sort((a, b) => a.start - b.start);
  }, [wallDoors, wallWindows, geom, height]);

  const segments = useMemo(() => {
    const result = [];
    let cursor = 0;
    for (const cut of cuts) {
      if (cursor < cut.start) {
        result.push({ from: cursor, to: cut.start, yBottom: 0, yTop: height });
      }
      if (cut.yBottom > 0) {
        result.push({ from: cut.start, to: cut.end, yBottom: 0, yTop: cut.yBottom });
      }
      if (cut.yTop < height) {
        result.push({ from: cut.start, to: cut.end, yBottom: cut.yTop, yTop: height });
      }
      cursor = cut.end;
    }
    if (cursor < geom.length) {
      result.push({ from: cursor, to: geom.length, yBottom: 0, yTop: height });
    }
    return result;
  }, [cuts, geom, height]);

  function segmentMidPosition(from, to, yBottom, yTop) {
    const midAlong = (from + to) / 2;
    const midY = yBottom + (yTop - yBottom) / 2;
    const x = start.x + geom.ux * midAlong;
    const z = start.y + geom.uz * midAlong;
    return [x, midY, z];
  }

  const segmentProps = {
    angle: geom.angle,
    thickness,
    isSelected,
    wallColor,
    wallPreset,
    onClick: (e) => { e.stopPropagation(); onWallClick && onWallClick(); },
  };

  if (cuts.length === 0) {
    const midX = start.x + (end.x - start.x) / 2;
    const midZ = start.y + (end.y - start.y) / 2;
    return (
      <>
        <WallSegment
          position={[midX, height / 2, midZ]}
          length={geom.length}
          height={height}
          {...segmentProps}
        />
        {wallDoors.map((door) => (
          <Door3D
            key={door.id}
            door={door}
            wallStart={start} wallAngle={geom.angle}
            wallUx={geom.ux} wallUz={geom.uz}
            wallLength={geom.length} wallThickness={thickness}
            isSelected={door.id === selectedId}
            frameColor={globalMaterials.doorFrameColor}
            panelColor={globalMaterials.doorPanelColor}
            onClick={() => onDoorClick && onDoorClick(door.id)}
          />
        ))}
        {wallWindows.map((win) => (
          <Window3D
            key={win.id}
            win={win}
            wallStart={start} wallAngle={geom.angle}
            wallUx={geom.ux} wallUz={geom.uz}
            wallLength={geom.length} wallThickness={thickness}
            isSelected={win.id === selectedId}
            frameColor={globalMaterials.windowFrameColor}
            glassColor={globalMaterials.windowGlassColor}
            onClick={() => onWindowClick && onWindowClick(win.id)}
          />
        ))}
      </>
    );
  }

  return (
    <>
      {segments.map((seg, i) => (
        <WallSegment
          key={`seg-${i}`}
          position={segmentMidPosition(seg.from, seg.to, seg.yBottom, seg.yTop)}
          length={seg.to - seg.from}
          height={seg.yTop - seg.yBottom}
          {...segmentProps}
        />
      ))}

      {wallDoors.map((door) => (
        <Door3D
          key={door.id}
          door={door}
          wallStart={start} wallAngle={geom.angle}
          wallUx={geom.ux} wallUz={geom.uz}
          wallLength={geom.length} wallThickness={thickness}
          isSelected={door.id === selectedId}
          frameColor={globalMaterials.doorFrameColor}
          panelColor={globalMaterials.doorPanelColor}
          onClick={() => onDoorClick && onDoorClick(door.id)}
        />
      ))}

      {wallWindows.map((win) => (
        <Window3D
          key={win.id}
          win={win}
          wallStart={start} wallAngle={geom.angle}
          wallUx={geom.ux} wallUz={geom.uz}
          wallLength={geom.length} wallThickness={thickness}
          isSelected={win.id === selectedId}
          frameColor={globalMaterials.windowFrameColor}
          glassColor={globalMaterials.windowGlassColor}
          onClick={() => onWindowClick && onWindowClick(win.id)}
        />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Furniture3D — renders one furniture item using basic box / cylinder geometry.
// ---------------------------------------------------------------------------
function Furniture3D({ item, isSelected, isOverlapping, snapRotation, onClick, onRotateStart, onRotate, onRotateCommit }) {
  const cat = FURNITURE_CATALOG[item.type] || FURNITURE_CATALOG.table;
  const s        = item.scale ?? 1.0;
  const mainColor  = isSelected ? '#86efac' : (item.color || cat.color);
  const darkColor  = darkenColor(mainColor);
  const lightColor = '#f0ece4';
  const metalColor = '#c8c8c8';
  const rotRad = ((item.rotation ?? 0) * Math.PI) / 180;

  // Refs for 3D rotate handle drag
  const isDraggingHandle  = useRef(false);
  const handleDragRef     = useRef({ startX: 0, startRot: 0, latestRot: 0 });

  const clickHandler = (e) => { e.stopPropagation(); onClick && onClick(); };
  const mp = { castShadow: true, receiveShadow: true, onClick: clickHandler };

  let content;
  switch (item.type) {
    case 'bed':
      content = (
        <>
          {/* Bed frame */}
          <mesh {...mp} position={[0, 0.12, 0]}>
            <boxGeometry args={[1.58, 0.22, 1.98]} />
            <meshStandardMaterial color={darkColor} roughness={0.9} />
          </mesh>
          {/* Mattress */}
          <mesh {...mp} position={[0, 0.28, 0.05]}>
            <boxGeometry args={[1.42, 0.14, 1.7]} />
            <meshStandardMaterial color={lightColor} roughness={0.95} />
          </mesh>
          {/* Headboard */}
          <mesh {...mp} position={[0, 0.62, -0.88]}>
            <boxGeometry args={[1.52, 0.82, 0.1]} />
            <meshStandardMaterial color={darkColor} roughness={0.8} />
          </mesh>
          {/* Pillow 1 */}
          <mesh position={[-0.3, 0.38, -0.38]}>
            <boxGeometry args={[0.48, 0.1, 0.38]} />
            <meshStandardMaterial color="#e8e0d0" roughness={0.98} />
          </mesh>
          {/* Pillow 2 */}
          <mesh position={[0.3, 0.38, -0.38]}>
            <boxGeometry args={[0.48, 0.1, 0.38]} />
            <meshStandardMaterial color="#e8e0d0" roughness={0.98} />
          </mesh>
        </>
      );
      break;

    case 'sofa':
      content = (
        <>
          {/* Seat cushion */}
          <mesh {...mp} position={[0, 0.22, 0.05]}>
            <boxGeometry args={[1.72, 0.32, 0.52]} />
            <meshStandardMaterial color={mainColor} roughness={0.88} />
          </mesh>
          {/* Seat cushion top */}
          <mesh {...mp} position={[0, 0.39, 0.05]}>
            <boxGeometry args={[1.65, 0.08, 0.48]} />
            <meshStandardMaterial color={mainColor} roughness={0.9} />
          </mesh>
          {/* Back rest */}
          <mesh {...mp} position={[0, 0.58, -0.27]}>
            <boxGeometry args={[1.72, 0.44, 0.16]} />
            <meshStandardMaterial color={darkColor} roughness={0.88} />
          </mesh>
          {/* Left arm */}
          <mesh {...mp} position={[-0.88, 0.38, 0]}>
            <boxGeometry args={[0.18, 0.45, 0.7]} />
            <meshStandardMaterial color={mainColor} roughness={0.88} />
          </mesh>
          {/* Right arm */}
          <mesh {...mp} position={[0.88, 0.38, 0]}>
            <boxGeometry args={[0.18, 0.45, 0.7]} />
            <meshStandardMaterial color={mainColor} roughness={0.88} />
          </mesh>
          {/* Feet */}
          {[[-0.8, -0.3], [0.8, -0.3], [-0.8, 0.3], [0.8, 0.3]].map(([lx, lz], i) => (
            <mesh key={i} position={[lx, 0.04, lz]}>
              <cylinderGeometry args={[0.04, 0.04, 0.08, 6]} />
              <meshStandardMaterial color="#222" roughness={0.4} metalness={0.5} />
            </mesh>
          ))}
        </>
      );
      break;

    case 'table':
      content = (
        <>
          {/* Tabletop */}
          <mesh {...mp} position={[0, 0.76, 0]}>
            <boxGeometry args={[1.18, 0.05, 0.78]} />
            <meshStandardMaterial color={mainColor} roughness={0.55} />
          </mesh>
          {/* Front apron */}
          <mesh position={[0, 0.7, 0.34]}>
            <boxGeometry args={[1.0, 0.07, 0.03]} />
            <meshStandardMaterial color={darkColor} roughness={0.7} />
          </mesh>
          {/* Back apron */}
          <mesh position={[0, 0.7, -0.34]}>
            <boxGeometry args={[1.0, 0.07, 0.03]} />
            <meshStandardMaterial color={darkColor} roughness={0.7} />
          </mesh>
          {/* Legs */}
          {[[-0.52, -0.32], [0.52, -0.32], [-0.52, 0.32], [0.52, 0.32]].map(([lx, lz], i) => (
            <mesh key={i} position={[lx, 0.365, lz]}>
              <cylinderGeometry args={[0.04, 0.04, 0.73, 8]} />
              <meshStandardMaterial color={darkColor} roughness={0.7} />
            </mesh>
          ))}
        </>
      );
      break;

    case 'chair':
      content = (
        <>
          {/* Seat */}
          <mesh {...mp} position={[0, 0.22, 0.02]}>
            <boxGeometry args={[0.48, 0.08, 0.46]} />
            <meshStandardMaterial color={mainColor} roughness={0.8} />
          </mesh>
          {/* Back panel */}
          <mesh {...mp} position={[0, 0.54, -0.2]}>
            <boxGeometry args={[0.48, 0.55, 0.07]} />
            <meshStandardMaterial color={darkColor} roughness={0.8} />
          </mesh>
          {/* Top rail */}
          <mesh position={[0, 0.8, -0.2]}>
            <boxGeometry args={[0.48, 0.07, 0.1]} />
            <meshStandardMaterial color={darkColor} roughness={0.75} />
          </mesh>
          {/* Legs */}
          {[[-0.2, 0.2], [0.2, 0.2], [-0.2, -0.2], [0.2, -0.2]].map(([lx, lz], i) => (
            <mesh key={i} position={[lx, 0.09, lz]}>
              <cylinderGeometry args={[0.025, 0.025, 0.18, 6]} />
              <meshStandardMaterial color={darkColor} roughness={0.7} />
            </mesh>
          ))}
        </>
      );
      break;

    case 'wardrobe':
      content = (
        <>
          {/* Main body */}
          <mesh {...mp} position={[0, 1.05, 0]}>
            <boxGeometry args={[1.17, 2.0, 0.57]} />
            <meshStandardMaterial color={mainColor} roughness={0.7} />
          </mesh>
          {/* Left door panel */}
          <mesh position={[-0.3, 1.05, 0.29]}>
            <boxGeometry args={[0.54, 1.86, 0.025]} />
            <meshStandardMaterial color={darkColor} roughness={0.65} />
          </mesh>
          {/* Right door panel */}
          <mesh position={[0.3, 1.05, 0.29]}>
            <boxGeometry args={[0.54, 1.86, 0.025]} />
            <meshStandardMaterial color={darkColor} roughness={0.65} />
          </mesh>
          {/* Left handle */}
          <mesh position={[-0.08, 1.05, 0.31]}>
            <boxGeometry args={[0.04, 0.14, 0.03]} />
            <meshStandardMaterial color={metalColor} metalness={0.7} roughness={0.3} />
          </mesh>
          {/* Right handle */}
          <mesh position={[0.08, 1.05, 0.31]}>
            <boxGeometry args={[0.04, 0.14, 0.03]} />
            <meshStandardMaterial color={metalColor} metalness={0.7} roughness={0.3} />
          </mesh>
          {/* Crown molding */}
          <mesh position={[0, 2.07, 0]}>
            <boxGeometry args={[1.22, 0.07, 0.62]} />
            <meshStandardMaterial color={darkColor} roughness={0.6} />
          </mesh>
        </>
      );
      break;

    case 'kitchen_counter':
    default:
      content = (
        <>
          {/* Cabinet body */}
          <mesh {...mp} position={[0, 0.43, 0]}>
            <boxGeometry args={[2.37, 0.85, 0.57]} />
            <meshStandardMaterial color={mainColor} roughness={0.7} />
          </mesh>
          {/* Countertop */}
          <mesh {...mp} position={[0, 0.875, 0.03]}>
            <boxGeometry args={[2.4, 0.04, 0.63]} />
            <meshStandardMaterial color={lightColor} roughness={0.25} metalness={0.05} />
          </mesh>
          {/* Cabinet door dividers */}
          {[-0.78, 0, 0.78].map((dx, i) => (
            <mesh key={i} position={[dx, 0.43, 0.295]}>
              <boxGeometry args={[0.02, 0.72, 0.02]} />
              <meshStandardMaterial color={darkColor} roughness={0.6} />
            </mesh>
          ))}
          {/* Drawer handles */}
          {[-0.78, 0, 0.78].map((dx, i) => (
            <mesh key={`h${i}`} position={[dx, 0.6, 0.31]}>
              <boxGeometry args={[0.22, 0.03, 0.03]} />
              <meshStandardMaterial color={metalColor} metalness={0.7} roughness={0.25} />
            </mesh>
          ))}
          {/* Backsplash */}
          <mesh position={[0, 1.2, -0.25]}>
            <boxGeometry args={[2.37, 0.65, 0.03]} />
            <meshStandardMaterial color={darkColor} roughness={0.4} metalness={0.05} />
          </mesh>
        </>
      );
      break;
  }

  return (
    <group position={[item.x, 0, item.y]} rotation={[0, rotRad, 0]} scale={[s, s, s]}>
      {content}

      {/* Overlap warning — semi-transparent red volume surrounding the item */}
      {isOverlapping && (
        <mesh position={[0, 1.0, 0]}>
          <boxGeometry args={[cat.footprintW * 1.06, 2.2, cat.footprintD * 1.06]} />
          <meshStandardMaterial color="#ef4444" transparent opacity={0.14} depthWrite={false} />
        </mesh>
      )}

      {/* Rotate handle — guide stick + sphere, visible when selected */}
      {isSelected && (
        <>
          {/* Guide stick */}
          <mesh position={[0, 1.8, -(cat.footprintD / 2) - 0.1]}>
            <boxGeometry args={[0.04, 0.04, 0.22]} />
            <meshStandardMaterial color="#a78bfa" transparent opacity={0.55} />
          </mesh>
          {/* Draggable handle sphere */}
          <mesh
            position={[0, 1.8, -(cat.footprintD / 2) - 0.25]}
            onPointerDown={(e) => {
              e.stopPropagation();
              isDraggingHandle.current = true;
              const startRot = item.rotation ?? 0;
              handleDragRef.current = { startX: e.clientX, startRot, latestRot: startRot };
              // Snapshot BEFORE rotate drag begins
              onRotateStart && onRotateStart();
            }}
            onPointerMove={(e) => {
              if (!isDraggingHandle.current) return;
              e.stopPropagation();
              const dx = e.clientX - handleDragRef.current.startX;
              let newRot = ((handleDragRef.current.startRot + dx * 0.5) % 360 + 360) % 360;
              if (snapRotation) newRot = (Math.round(newRot / 15) * 15) % 360;
              handleDragRef.current.latestRot = newRot;
              // Live update — no history entry
              onRotate && onRotate(item.id, newRot);
            }}
            onPointerUp={() => {
              if (!isDraggingHandle.current) return;
              isDraggingHandle.current = false;
              // Commit — single history entry
              onRotateCommit && onRotateCommit(item.id, handleDragRef.current.latestRot);
            }}
          >
            <sphereGeometry args={[0.13, 12, 8]} />
            <meshStandardMaterial color="#a78bfa" emissive="#7c3aed" emissiveIntensity={0.5} />
          </mesh>
        </>
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Floor3D — a clickable slab representing the floor of a closed loop/room
// ---------------------------------------------------------------------------
function Floor3D({ loop, isSelected, onClick, floorColor }) {
  const { points } = loop;

  const shape = useMemo(() => {
    const s = new THREE.Shape();
    if (!points || points.length < 3) return s;
    s.moveTo(points[0].x, -points[0].y);
    for (let i = 1; i < points.length; i++) {
      s.lineTo(points[i].x, -points[i].y);
    }
    s.closePath();
    return s;
  }, [points]);

  const extrudeSettings = useMemo(() => ({ depth: 0.05, bevelEnabled: false }), []);
  const baseColor = floorColor || '#94a3b8';

  return (
    <mesh
      position={[0, 0, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
      onClick={(e) => { e.stopPropagation(); onClick && onClick(); }}
    >
      <extrudeGeometry args={[shape, extrudeSettings]} />
      <meshStandardMaterial
        color={isSelected ? '#86efac' : baseColor}
        roughness={0.9}
        transparent
        opacity={isSelected ? 0.8 : 0.55}
      />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// FloorScene — renders one floor's walls, doors, windows, floors, roofs,
// and furniture at a given Y base offset.
//
// When `isActive` is false (showing background floors in "Show All Floors" mode)
// interactive handles are disabled and the scene is slightly dimmed.
// ---------------------------------------------------------------------------
function FloorScene({
  walls = [],
  doors = [],
  windows = [],
  rooms = [],
  closedLoops,          // pre-computed from this floor's walls
  materials = {},
  furniture = [],
  selectedId,
  mode,
  snapRotation,
  isActive,             // whether this is the currently-edited floor
  baseY = 0,            // world Y offset for this floor
  onWallClick,
  onDoorClick,
  onWindowClick,
  onRoomClick,
  onFurnClick,
  onFurnRotateStart,
  onSetFurnitureRotation,
  onCommitFurnitureRotation,
  overlappingFurnIds,
  globalMaterials,
}) {
  // Derived closed loops (computed externally and passed in)
  const loops = closedLoops || [];

  // Opacity modifier for background floors
  const dimOpacity = isActive ? 1 : 0.45;

  return (
    <group position={[0, baseY, 0]}>
      {/* Walls, Doors, Windows */}
      <group>
        {walls.map((wall) => {
          const wd = doors.filter((d) => d.wallId === wall.id);
          const ww = windows.filter((w) => w.wallId === wall.id);
          const isSel = isActive && wall.id === selectedId;
          return (
            <Wall3D
              key={wall.id}
              wall={wall}
              wallDoors={wd}
              wallWindows={ww}
              isSelected={isSel}
              selectedId={isActive ? selectedId : null}
              globalMaterials={globalMaterials}
              onWallClick={() => isActive && onWallClick && onWallClick(wall.id)}
              onDoorClick={(id) => isActive && onDoorClick && onDoorClick(id)}
              onWindowClick={(id) => isActive && onWindowClick && onWindowClick(id)}
            />
          );
        })}
      </group>

      {/* Floors & Roofs per closed loop */}
      {loops.map((loop) => {
        const room = rooms.find((r) => r.id === loop.id) || {};
        const roof = room.roof;
        const isSel = isActive && loop.id === selectedId;
        const roofColor  = roof?.color  ?? globalMaterials.roofColor;
        const roofPreset = roof?.preset ?? globalMaterials.roofPreset;

        return (
          <group key={`room-${loop.id}`}>
            <Floor3D
              loop={loop}
              isSelected={isSel}
              floorColor={room.floorColor}
              onClick={() => isActive && onRoomClick && onRoomClick(loop.id)}
            />
            {roof && roof.enabled && (
              roof.type === 'gable' ? (
                <GableRoof3D
                  loop={loop}
                  wallHeight={3}
                  roofHeight={roof.height || 1.5}
                  roofColor={roofColor}
                  roofPreset={roofPreset}
                />
              ) : (
                <FlatRoof3D
                  loop={loop}
                  wallHeight={3}
                  roofColor={roofColor}
                  roofPreset={roofPreset}
                />
              )
            )}
          </group>
        );
      })}

      {/* Furniture items */}
      {furniture.map((item) => (
        <Furniture3D
          key={item.id}
          item={item}
          isSelected={isActive && item.id === selectedId}
          isOverlapping={isActive && overlappingFurnIds && overlappingFurnIds.has(item.id)}
          snapRotation={snapRotation}
          onClick={() => { if (isActive && mode === 'select') onFurnClick && onFurnClick(item.id); }}
          onRotateStart={isActive ? onFurnRotateStart : null}
          onRotate={isActive ? onSetFurnitureRotation : null}
          onRotateCommit={isActive ? onCommitFurnitureRotation : null}
        />
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// View3D — top-level 3D scene
// ---------------------------------------------------------------------------

const GLOBAL_DEFAULTS = {
  wallColor: '#d6c2a1',
  wallPreset: 'plain',
  doorFrameColor: '#4b2e1e',
  doorPanelColor: '#8b5a2b',
  windowFrameColor: '#eeeeee',
  windowGlassColor: '#78c7e8',
  roofColor: '#555555',
  roofPreset: 'plain',
};

export default function View3D({
  // Active floor data (always provided)
  walls = [],
  doors = [],
  windows = [],
  rooms = [],
  closedLoops = [],
  materials: materialsProp = {},
  furniture = [],
  // Multi-floor props
  allFloors = [],
  activeFloorId,
  floorBaseYs = [],
  showAllFloors = false,
  // UI
  selectedId,
  mode,
  snapRotation = true,
  onSelect,
  onToggleDoor,
  // Furniture rotate handle — three-phase
  onFurnRotateStart,
  onSetFurnitureRotation,
  onCommitFurnitureRotation,
}) {
  // Merge with defaults for backward compatibility
  const globalMaterials = { ...GLOBAL_DEFAULTS, ...materialsProp };

  // Compute which furniture items overlap another item in the same room (active floor only)
  const overlappingFurnIds = useMemo(() => {
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

  // Pre-compute closed loops for all floors when showing all
  const allFloorLoops = useMemo(() => {
    if (!showAllFloors) return [];
    return allFloors.map((floor) => findClosedLoops(floor.walls || []));
  }, [showAllFloors, allFloors]);

  function handleRoomClick(roomId) {
    if (mode === 'select') onSelect && onSelect(roomId);
  }

  function handleWallClick(wallId) {
    if (mode === 'select') onSelect && onSelect(wallId);
  }

  function handleDoorClick(doorId) {
    if (mode === 'select') {
      onSelect && onSelect(doorId);
    } else {
      onToggleDoor && onToggleDoor(doorId);
    }
  }

  function handleWindowClick(windowId) {
    if (mode === 'select') onSelect && onSelect(windowId);
  }

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Canvas shadows camera={{ position: [0, 10, 15], fov: 50 }}>
        <color attach="background" args={['#0f172a']} />
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[10, 20, 10]} intensity={1} castShadow
          shadow-mapSize-width={2048} shadow-mapSize-height={2048}
          shadow-camera-far={50}
          shadow-camera-left={-20} shadow-camera-right={20}
          shadow-camera-top={20}  shadow-camera-bottom={-20}
        />
        <Grid infiniteGrid fadeDistance={50} sectionColor="#3b82f6" cellColor="#94a3b8" sectionSize={1} cellSize={0.5} />

        {showAllFloors && allFloors.length > 0 ? (
          // ---- Show All Floors: stack every floor at its computed base Y ----
          allFloors.map((floor, idx) => {
            const isActive = floor.id === activeFloorId;
            const baseY = floorBaseYs[idx] ?? 0;
            const floorLoops = allFloorLoops[idx] || [];
            const floorGlobals = { ...GLOBAL_DEFAULTS, ...(floor.materials || {}) };
            return (
              <FloorScene
                key={floor.id}
                walls={floor.walls || []}
                doors={floor.doors || []}
                windows={floor.windows || []}
                rooms={floor.rooms || []}
                closedLoops={floorLoops}
                materials={floor.materials || {}}
                furniture={floor.furniture || []}
                selectedId={isActive ? selectedId : null}
                mode={mode}
                snapRotation={snapRotation}
                isActive={isActive}
                baseY={baseY}
                onWallClick={handleWallClick}
                onDoorClick={handleDoorClick}
                onWindowClick={handleWindowClick}
                onRoomClick={handleRoomClick}
                onFurnClick={(id) => { if (mode === 'select') onSelect && onSelect(id); }}
                onFurnRotateStart={onFurnRotateStart}
                onSetFurnitureRotation={onSetFurnitureRotation}
                onCommitFurnitureRotation={onCommitFurnitureRotation}
                overlappingFurnIds={isActive ? overlappingFurnIds : new Set()}
                globalMaterials={floorGlobals}
              />
            );
          })
        ) : (
          // ---- Single floor: render only the active floor at Y=0 (same as before) ----
          <FloorScene
            walls={walls}
            doors={doors}
            windows={windows}
            rooms={rooms}
            closedLoops={closedLoops}
            materials={materialsProp}
            furniture={furniture}
            selectedId={selectedId}
            mode={mode}
            snapRotation={snapRotation}
            isActive={true}
            baseY={0}
            onWallClick={handleWallClick}
            onDoorClick={handleDoorClick}
            onWindowClick={handleWindowClick}
            onRoomClick={handleRoomClick}
            onFurnClick={(id) => { if (mode === 'select') onSelect && onSelect(id); }}
            onFurnRotateStart={onFurnRotateStart}
            onSetFurnitureRotation={onSetFurnitureRotation}
            onCommitFurnitureRotation={onCommitFurnitureRotation}
            overlappingFurnIds={overlappingFurnIds}
            globalMaterials={globalMaterials}
          />
        )}

        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
}

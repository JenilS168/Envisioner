import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';

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
  // Add noise
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
  // Horizontal grain lines
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
  // Horizontal corrugation lines
  for (let i = 0; i < 16; i++) {
    const y = (i / 16) * size;
    ctx.fillStyle = `rgba(255,255,255,0.07)`;
    ctx.fillRect(0, y, size, 6);
  }
  return new THREE.CanvasTexture(canvas);
}

// ---------------------------------------------------------------------------
// WallSegment — a single box slab (part of a wall)
// ---------------------------------------------------------------------------
function WallSegment({ position, angle, length, height, thickness, isSelected, onClick, wallColor, wallTexture }) {
  if (length <= 0 || height <= 0) return null;
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
      {/* Left jamb */}
      <mesh position={[-winW / 2 + frameThick / 2, winH / 2, 0]}>
        <boxGeometry args={[frameThick, winH, frameDepth]} />
        <meshStandardMaterial color={frameCol} roughness={0.4} />
      </mesh>
      {/* Right jamb */}
      <mesh position={[winW / 2 - frameThick / 2, winH / 2, 0]}>
        <boxGeometry args={[frameThick, winH, frameDepth]} />
        <meshStandardMaterial color={frameCol} roughness={0.4} />
      </mesh>
      {/* Top rail */}
      <mesh position={[0, winH - frameThick / 2, 0]}>
        <boxGeometry args={[winW, frameThick, frameDepth]} />
        <meshStandardMaterial color={frameCol} roughness={0.4} />
      </mesh>
      {/* Bottom sill */}
      <mesh position={[0, frameThick / 2, 0]}>
        <boxGeometry args={[winW, frameThick, frameDepth]} />
        <meshStandardMaterial color={frameCol} roughness={0.4} />
      </mesh>
      {/* Centre mullion (vertical divider) */}
      <mesh position={[0, winH / 2, 0]}>
        <boxGeometry args={[frameThick * 0.7, winH - frameThick * 2, frameDepth * 0.8]} />
        <meshStandardMaterial color={frameCol} roughness={0.4} />
      </mesh>
      {/* Centre rail (horizontal divider) */}
      <mesh position={[0, winH / 2, 0]}>
        <boxGeometry args={[winW - frameThick * 2, frameThick * 0.7, frameDepth * 0.8]} />
        <meshStandardMaterial color={frameCol} roughness={0.4} />
      </mesh>

      {/* Glass pane */}
      <mesh position={[0, winH / 2, 0]}>
        <boxGeometry args={[glassW, glassH, glassDepth]} />
        <meshStandardMaterial
          color={glassCol}
          transparent
          opacity={0.35}
          roughness={0.1}
          metalness={0.1}
        />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// FlatRoof3D — extruded flat slab over a closed wall loop
// ---------------------------------------------------------------------------
function FlatRoof3D({ loop, wallHeight = 3, roofColor, roofTexture }) {
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

  const extrudeSettings = useMemo(
    () => ({
      depth: 0.18,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.06,
      bevelThickness: 0.06,
    }),
    []
  );

  return (
    <mesh
      position={[0, wallHeight, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      castShadow
      receiveShadow
    >
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
// GableRoof3D — hip-style pitched roof that pitches inward from all edges
// ---------------------------------------------------------------------------
function GableRoof3D({ loop, wallHeight = 3, roofHeight = 1.5, roofColor, roofTexture }) {
  const { points } = loop;

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
// Wall3D — renders one wall with cutouts for both doors AND windows
// ---------------------------------------------------------------------------
function Wall3D({ wall, wallDoors, wallWindows, isSelected, selectedId, onWallClick, onDoorClick, onWindowClick, materials, wallTexture }) {
  const { start, end, height, thickness } = wall;

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

  if (cuts.length === 0) {
    const midX = start.x + (end.x - start.x) / 2;
    const midZ = start.y + (end.y - start.y) / 2;
    return (
      <WallSegment
        position={[midX, height / 2, midZ]}
        angle={geom.angle} length={geom.length} height={height} thickness={thickness}
        isSelected={isSelected}
        wallColor={materials.wallColor}
        wallTexture={wallTexture}
        onClick={(e) => { e.stopPropagation(); onWallClick && onWallClick(); }}
      />
    );
  }

  return (
    <>
      {segments.map((seg, i) => (
        <WallSegment
          key={`seg-${i}`}
          position={segmentMidPosition(seg.from, seg.to, seg.yBottom, seg.yTop)}
          angle={geom.angle}
          length={seg.to - seg.from}
          height={seg.yTop - seg.yBottom}
          thickness={thickness}
          isSelected={isSelected}
          wallColor={materials.wallColor}
          wallTexture={wallTexture}
          onClick={(e) => { e.stopPropagation(); onWallClick && onWallClick(); }}
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
          frameColor={materials.doorFrameColor}
          panelColor={materials.doorPanelColor}
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
          frameColor={materials.windowFrameColor}
          glassColor={materials.windowGlassColor}
          onClick={() => onWindowClick && onWindowClick(win.id)}
        />
      ))}
    </>
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

  const extrudeSettings = useMemo(
    () => ({
      depth: 0.05,
      bevelEnabled: false,
    }),
    []
  );

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
// View3D — top-level 3D scene
// ---------------------------------------------------------------------------

const DEFAULT_MATERIALS = {
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
  walls,
  doors,
  windows = [],
  rooms = [],
  closedLoops = [],
  materials: materialsProp = {},
  selectedId,
  mode,
  onSelect,
  onToggleDoor,
}) {
  // Merge with defaults for backward compatibility
  const materials = { ...DEFAULT_MATERIALS, ...materialsProp };

  // Build wall texture based on preset (memoized so it's not rebuilt on every render)
  const wallTexture = useMemo(() => {
    switch (materials.wallPreset) {
      case 'brick':     return makeBrickTexture();
      case 'concrete':  return makeConcreteTexture(materials.wallColor);
      case 'wood':      return makeWoodTexture(materials.wallColor);
      default:          return null;
    }
  }, [materials.wallPreset, materials.wallColor]);

  // Build roof texture based on preset
  const roofTexture = useMemo(() => {
    switch (materials.roofPreset) {
      case 'tiles':  return makeTilesTexture(materials.roofColor);
      case 'metal':  return makeMetalTexture(materials.roofColor);
      default:       return null;
    }
  }, [materials.roofPreset, materials.roofColor]);

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

        {/* Walls, Doors, Windows */}
        <group>
          {walls.map((wall) => {
            const wd = doors.filter((d) => d.wallId === wall.id);
            const ww = windows.filter((w) => w.wallId === wall.id);
            const isSel = wall.id === selectedId;
            return (
              <Wall3D
                key={wall.id}
                wall={wall}
                wallDoors={wd}
                wallWindows={ww}
                isSelected={isSel || wd.some((d) => d.id === selectedId) || ww.some((w) => w.id === selectedId)}
                selectedId={selectedId}
                materials={materials}
                wallTexture={wallTexture}
                onWallClick={() => handleWallClick(wall.id)}
                onDoorClick={(id) => handleDoorClick(id)}
                onWindowClick={(id) => handleWindowClick(id)}
              />
            );
          })}
        </group>

        {/* Floors & Roofs rendering over closed loops */}
        {closedLoops.map((loop) => {
          const room = rooms.find(r => r.id === loop.id) || {};
          const roof = room.roof;
          const isSel = loop.id === selectedId;

          return (
            <group key={`room-${loop.id}`}>
              <Floor3D
                loop={loop}
                isSelected={isSel}
                floorColor={room.floorColor}
                onClick={() => handleRoomClick(loop.id)}
              />
              {roof && roof.enabled && (
                roof.type === 'gable' ? (
                  <GableRoof3D
                    loop={loop}
                    wallHeight={3}
                    roofHeight={roof.height || 1.5}
                    roofColor={materials.roofColor}
                    roofTexture={roofTexture}
                  />
                ) : (
                  <FlatRoof3D
                    loop={loop}
                    wallHeight={3}
                    roofColor={materials.roofColor}
                    roofTexture={roofTexture}
                  />
                )
              )}
            </group>
          );
        })}

        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
}

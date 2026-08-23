import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Colour / material palette
// ---------------------------------------------------------------------------
const WALL_COLOR       = '#f1f5f9';
const WALL_SEL_COLOR   = '#86efac';
const FRAME_COLOR      = '#3d3225';   // dark brown-grey door frame
const PANEL_COLOR      = '#8B6914';   // warm wood-brown door panel
const PANEL_SEL_COLOR  = '#a3e635';
const WIN_FRAME_COLOR  = '#e2e8f0';   // light grey/white window frame
const WIN_FRAME_SEL    = '#86efac';
const GLASS_COLOR      = '#7dd3fc';   // light-blue glass
const GLASS_SEL        = '#bbf7d0';
const ROOF_COLOR       = '#334155';   // modern slate/charcoal roof

// ---------------------------------------------------------------------------
// WallSegment — a single box slab (part of a wall)
// ---------------------------------------------------------------------------
function WallSegment({ position, angle, length, height, thickness, isSelected, onClick }) {
  if (length <= 0 || height <= 0) return null;
  return (
    <mesh position={position} rotation={[0, -angle, 0]} castShadow receiveShadow onClick={onClick}>
      <boxGeometry args={[length, height, thickness]} />
      <meshStandardMaterial color={isSelected ? WALL_SEL_COLOR : WALL_COLOR} roughness={0.7} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Door3D — frame + openable panel
// ---------------------------------------------------------------------------
function Door3D({ door, wallStart, wallAngle, wallUx, wallUz, wallLength, wallThickness, isSelected, onClick }) {
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
  const color = isSelected ? PANEL_SEL_COLOR : PANEL_COLOR;
  const frameCol = isSelected ? '#6b9c45' : FRAME_COLOR;

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
function Window3D({ win, wallStart, wallAngle, wallUx, wallUz, wallLength, wallThickness, isSelected, onClick }) {
  const { position: tPos, width: winW, height: winH, sillHeight } = win;
  const centreMetre = tPos * wallLength;
  const worldX = wallStart.x + wallUx * centreMetre;
  const worldZ = wallStart.y + wallUz * centreMetre;

  const frameThick = 0.035;
  const frameDepth = wallThickness + 0.02;
  const glassW = winW - frameThick * 2;
  const glassH = winH - frameThick * 2;
  const glassDepth = 0.01;

  const frameCol = isSelected ? WIN_FRAME_SEL : WIN_FRAME_COLOR;
  const glassCol = isSelected ? GLASS_SEL : GLASS_COLOR;

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
function FlatRoof3D({ loop, wallHeight = 3 }) {
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
        color={ROOF_COLOR}
        roughness={0.6}
        metalness={0.1}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// GableRoof3D — hip-style pitched roof that pitches inward from all edges
// Works robustly for any irregular closed polygon.
// ---------------------------------------------------------------------------
function GableRoof3D({ loop, wallHeight = 3, roofHeight = 1.5 }) {
  const { points } = loop;

  const roofGeometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    if (!points || points.length < 3) return geom;

    // Calculate centroid for the peak
    let cx = 0, cy = 0;
    points.forEach(p => { cx += p.x; cy += p.y; });
    cx /= points.length;
    cy /= points.length;

    // Add a slight overhang
    const overhang = 0.25;

    const roofPositions = [];
    const peakY = wallHeight + roofHeight;
    const eaveY = wallHeight;

    for (let i = 0; i < points.length; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % points.length];

      // To create an overhang, we extend the vector from peak to p1, and peak to p2
      const dx1 = p1.x - cx;
      const dz1 = p1.y - cy;
      const len1 = Math.hypot(dx1, dz1);
      const ex1 = len1 > 0 ? p1.x + (dx1 / len1) * overhang : p1.x;
      const ez1 = len1 > 0 ? p1.y + (dz1 / len1) * overhang : p1.y;

      const dx2 = p2.x - cx;
      const dz2 = p2.y - cy;
      const len2 = Math.hypot(dx2, dz2);
      const ex2 = len2 > 0 ? p2.x + (dx2 / len2) * overhang : p2.x;
      const ez2 = len2 > 0 ? p2.y + (dz2 / len2) * overhang : p2.y;

      // Roof slope triangle (Peak, eave2, eave1) facing outwards/upwards
      roofPositions.push(
        cx, peakY, cy,
        ex2, eaveY, ez2,
        ex1, eaveY, ez1
      );
    }

    geom.setAttribute('position', new THREE.Float32BufferAttribute(roofPositions, 3));
    geom.computeVertexNormals();

    return geom;
  }, [points, wallHeight, roofHeight]);

  return (
    <group>
      {/* Pitched Roof Panels */}
      <mesh geometry={roofGeometry} castShadow receiveShadow>
        <meshStandardMaterial
          color={ROOF_COLOR}
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
function Wall3D({ wall, wallDoors, wallWindows, isSelected, selectedId, onWallClick, onDoorClick, onWindowClick }) {
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

  // Build ALL cuts from doors and windows combined, sorted along wall
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

  // Decompose wall into solid segments
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

  // No openings — single solid wall
  if (cuts.length === 0) {
    const midX = start.x + (end.x - start.x) / 2;
    const midZ = start.y + (end.y - start.y) / 2;
    return (
      <WallSegment
        position={[midX, height / 2, midZ]}
        angle={geom.angle} length={geom.length} height={height} thickness={thickness}
        isSelected={isSelected}
        onClick={(e) => { e.stopPropagation(); onWallClick && onWallClick(); }}
      />
    );
  }

  return (
    <>
      {/* Wall segments */}
      {segments.map((seg, i) => (
        <WallSegment
          key={`seg-${i}`}
          position={segmentMidPosition(seg.from, seg.to, seg.yBottom, seg.yTop)}
          angle={geom.angle}
          length={seg.to - seg.from}
          height={seg.yTop - seg.yBottom}
          thickness={thickness}
          isSelected={isSelected}
          onClick={(e) => { e.stopPropagation(); onWallClick && onWallClick(); }}
        />
      ))}

      {/* Door meshes */}
      {wallDoors.map((door) => (
        <Door3D
          key={door.id}
          door={door}
          wallStart={start} wallAngle={geom.angle}
          wallUx={geom.ux} wallUz={geom.uz}
          wallLength={geom.length} wallThickness={thickness}
          isSelected={door.id === selectedId}
          onClick={() => onDoorClick && onDoorClick(door.id)}
        />
      ))}

      {/* Window meshes */}
      {wallWindows.map((win) => (
        <Window3D
          key={win.id}
          win={win}
          wallStart={start} wallAngle={geom.angle}
          wallUx={geom.ux} wallUz={geom.uz}
          wallLength={geom.length} wallThickness={thickness}
          isSelected={win.id === selectedId}
          onClick={() => onWindowClick && onWindowClick(win.id)}
        />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Floor3D — a clickable slab representing the floor of a closed loop/room
// ---------------------------------------------------------------------------
function Floor3D({ loop, isSelected, onClick }) {
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

  return (
    <mesh
      position={[0, 0, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
      onClick={(e) => { e.stopPropagation(); onClick && onClick(); }}
    >
      <extrudeGeometry args={[shape, extrudeSettings]} />
      <meshStandardMaterial
        color={isSelected ? '#86efac' : '#94a3b8'}
        roughness={0.9}
        transparent
        opacity={isSelected ? 0.8 : 0.4}
      />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// View3D — top-level 3D scene
// ---------------------------------------------------------------------------
export default function View3D({
  walls,
  doors,
  windows = [],
  rooms = [],
  closedLoops = [],
  selectedId,
  mode,
  onSelect,
  onToggleDoor,
}) {
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
                onWallClick={() => handleWallClick(wall.id)}
                onDoorClick={(id) => handleDoorClick(id)}
                onWindowClick={(id) => handleWindowClick(id)}
              />
            );
          })}
        </group>

        {/* Floors & Roofs rendering over closed loops */}
        {closedLoops.map((loop, idx) => {
          const room = rooms.find(r => r.id === loop.id) || {};
          const roof = room.roof;
          const isSel = loop.id === selectedId;

          return (
            <group key={`room-${loop.id}`}>
              <Floor3D
                loop={loop}
                isSelected={isSel}
                onClick={() => handleRoomClick(loop.id)}
              />
              {roof && roof.enabled && (
                roof.type === 'gable' ? (
                  <GableRoof3D
                    loop={loop}
                    wallHeight={3}
                    roofHeight={roof.height || 1.5}
                  />
                ) : (
                  <FlatRoof3D
                    loop={loop}
                    wallHeight={3}
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

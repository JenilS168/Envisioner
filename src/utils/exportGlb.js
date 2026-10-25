/**
 * exportGlb.js — GLB export for Envisioner designs.
 *
 * Builds a pure THREE.Scene imperatively from the design JSON, completely
 * separate from the live R3F canvas. Reuses the same geometry math as View3D
 * but driven from design data rather than JSX props.
 *
 * Helpers reused from existing utils (imported as pure functions):
 *   • findClosedLoops()       — geometry.js — room detection
 *   • getStairOutline()       — stairs.js   — merged stair opening polygon
 *   • computePolygonOverhang() — geometry.js — cantilever overhang strips
 *   • computeSupportFraction() — geometry.js — extreme-overhang test
 *   • getFloorBaseY()         — floors.js   — floor elevation
 *   • pointInPolygon()        — geometry.js — hole containment check
 *
 * Geometry rebuilt from design data (mirrors View3D formula exactly):
 *   • Wall segments with door/window cutouts  (Wall3D / WallSegment math)
 *   • Door frame + panel boxes                (Door3D math)
 *   • Window frame + glass boxes              (Window3D math)
 *   • Floor slabs with stair holes            (Floor3D Shape math)
 *   • Flat roof slabs with stair holes        (FlatRoof3D Shape math)
 *   • Gable/hip pitched roof geometry         (GableRoof3D BufferGeometry math)
 *   • Cantilever extension strips             (CantileverSlab3D BufferGeometry math)
 *   • Furniture box/cylinder meshes           (Furniture3D switch-case math)
 *   • Stair step boxes (all 3 types)          (Stair3D renderSteps math)
 *
 * Roof visibility rule (mirrors FloorScene gablesHidden / roofsHidden):
 *   • Flat roofs:  exported for every floor that has one.
 *   • Gable roofs: NOT exported when a floor exists above (hasFloorAbove = true),
 *                  because the sloped geometry would penetrate the upper floor.
 *   • Flat/intermediate ceiling: always exported (matches live renderer).
 *
 * Editor-only objects never added to the export scene:
 *   Grid, lights, camera, OrbitControls, selection tinting, collision overlays
 *   (red emissive meshes), rotation handles, overlap warning boxes, arrival guides.
 *
 * Cantilever slabs:
 *   Exported when overhang strips exist. The isExtreme warning material (red
 *   emissive overlay) is intentionally excluded — only the structural geometry
 *   is exported.
 *
 * @module exportGlb
 */

import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { findClosedLoops, computePolygonOverhang, computeSupportFraction, pointInPolygon } from './geometry.js';
import { getStairOutline } from './stairs.js';
import { getFloorBaseY } from './floors.js';
import { FURNITURE_CATALOG } from './furniture.js';

// ---------------------------------------------------------------------------
// Constants — mirror View3D
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

const FLAT_ROOF_SLAB_DEPTH = 0.18; // metres — must match FlatRoof3D's SLAB_DEPTH
const FLOOR_SLAB_DEPTH     = 0.05; // metres — must match Floor3D's depth
const CANTILEVER_THICKNESS = 0.18; // metres — must match CantileverSlab3D's THICKNESS

// ---------------------------------------------------------------------------
// Material helpers
// ---------------------------------------------------------------------------

/**
 * Returns a plain MeshStandardMaterial for a given hex color and optional
 * roughness/metalness. Does NOT apply selection colors, collision-red, ghost,
 * or editor-only styles.
 */
function mat(color, { roughness = 0.7, metalness = 0, transparent = false, opacity = 1, side = THREE.FrontSide } = {}) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness,
    metalness,
    transparent: transparent || opacity < 1,
    opacity,
    side,
  });
}

/** Darken a hex color by factor (mirrors View3D darkenColor). */
function darkenColor(hex, factor = 0.62) {
  const num = parseInt((hex || '#888888').replace('#', ''), 16);
  const r = Math.max(0, Math.floor(((num >> 16) & 0xff) * factor));
  const g = Math.max(0, Math.floor(((num >> 8) & 0xff) * factor));
  const b = Math.max(0, Math.floor((num & 0xff) * factor));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Geometry helpers — pure Three.js, no React
// ---------------------------------------------------------------------------

/** Build a BoxGeometry mesh at a given world position, with rotation around Y. */
function boxMesh(w, h, d, worldX, worldY, worldZ, angleY = 0, material) {
  const geom = new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geom, material);
  mesh.position.set(worldX, worldY, worldZ);
  mesh.rotation.set(0, angleY, 0);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Build a CylinderGeometry mesh at a given world position. */
function cylMesh(rTop, rBot, h, segs, worldX, worldY, worldZ, material) {
  const geom = new THREE.CylinderGeometry(rTop, rBot, h, segs);
  const mesh = new THREE.Mesh(geom, material);
  mesh.position.set(worldX, worldY, worldZ);
  return mesh;
}

// ---------------------------------------------------------------------------
// Wall geometry — mirrors Wall3D / WallSegment
// ---------------------------------------------------------------------------

/**
 * Build THREE.Mesh objects for a single wall, with door and window cutouts.
 * All segment positions match WallSegment's `position` prop exactly.
 * Returns an array of meshes.
 */
function buildWallMeshes(wall, wallDoors, wallWindows, wallColor) {
  const { start, end, height = 3, thickness = 0.2 } = wall;
  const dx = end.x - start.x;
  const dz = end.y - start.y;
  const length = Math.hypot(dx, dz);
  if (length <= 0 || height <= 0) return [];

  const angle = Math.atan2(dz, dx);
  const ux = dx / length;
  const uz = dz / length;

  const wallMat = mat(wallColor, { roughness: 0.7 });

  // Compute cuts (same logic as Wall3D.cuts)
  const allOpenings = [
    ...wallDoors.map((d) => ({
      position: d.position, width: d.width,
      yBottom: 0, yTop: d.height,
    })),
    ...wallWindows.map((w) => ({
      position: w.position, width: w.width,
      yBottom: w.sillHeight, yTop: w.sillHeight + w.height,
    })),
  ];

  const cuts = allOpenings
    .map((op) => {
      const centreMetre = op.position * length;
      const halfWidth = op.width / 2;
      return {
        start: Math.max(0, centreMetre - halfWidth),
        end: Math.min(length, centreMetre + halfWidth),
        yBottom: op.yBottom,
        yTop: Math.min(op.yTop, height),
      };
    })
    .sort((a, b) => a.start - b.start);

  const segments = [];
  let cursor = 0;
  for (const cut of cuts) {
    if (cursor < cut.start) {
      segments.push({ from: cursor, to: cut.start, yBottom: 0, yTop: height });
    }
    if (cut.yBottom > 0) {
      segments.push({ from: cut.start, to: cut.end, yBottom: 0, yTop: cut.yBottom });
    }
    if (cut.yTop < height) {
      segments.push({ from: cut.start, to: cut.end, yBottom: cut.yTop, yTop: height });
    }
    cursor = cut.end;
  }
  if (cursor < length) {
    segments.push({ from: cursor, to: length, yBottom: 0, yTop: height });
  }

  const meshes = [];
  for (const seg of segments) {
    const segLen = seg.to - seg.from;
    const segH   = seg.yTop - seg.yBottom;
    if (segLen <= 0 || segH <= 0) continue;

    const midAlong = (seg.from + seg.to) / 2;
    const midY     = seg.yBottom + segH / 2;
    const wx = start.x + ux * midAlong;
    const wz = start.y + uz * midAlong;

    meshes.push(boxMesh(segLen, segH, thickness, wx, midY, wz, -angle, wallMat));
  }

  return meshes;
}

// ---------------------------------------------------------------------------
// Door geometry — mirrors Door3D
// ---------------------------------------------------------------------------

function buildDoorMeshes(door, wallStart, wallAngle, wallUx, wallUz, wallLength, wallThickness, frameColor, panelColor) {
  const { position: tPos, width: doorW, height: doorH, isOpen } = door;
  const centreMetre = tPos * wallLength;
  const worldX = wallStart.x + wallUx * centreMetre;
  const worldZ = wallStart.y + wallUz * centreMetre;

  const frameThick = 0.04;
  const frameDepth = wallThickness + 0.02;
  const panelW     = doorW - frameThick * 2;
  const panelH     = doorH - frameThick * 2;
  const panelDepth = 0.04;
  const hingeAngle = isOpen ? (85 * Math.PI) / 180 : 0;

  const fMat = mat(frameColor, { roughness: 0.8 });
  const pMat = mat(panelColor, { roughness: 0.5 });

  // Group at door world position, rotated by wall angle
  const group = new THREE.Group();
  group.position.set(worldX, 0, worldZ);
  group.rotation.y = -wallAngle;
  group.userData = { kind: 'door', entityId: door.id };

  // Left jamb
  const lj = boxMesh(frameThick, doorH, frameDepth, -doorW / 2 + frameThick / 2, doorH / 2, 0, 0, fMat);
  // Right jamb
  const rj = boxMesh(frameThick, doorH, frameDepth, doorW / 2 - frameThick / 2, doorH / 2, 0, 0, fMat);
  // Top lintel
  const tl = boxMesh(doorW, frameThick, frameDepth, 0, doorH - frameThick / 2, 0, 0, fMat);
  // Bottom sill
  const bs = boxMesh(doorW, frameThick, frameDepth, 0, frameThick / 2, 0, 0, fMat);

  group.add(lj, rj, tl, bs);

  // Panel (respects isOpen angle)
  const panelGroup = new THREE.Group();
  panelGroup.position.set(-panelW / 2, frameThick, 0);
  panelGroup.rotation.y = hingeAngle;

  const panel = boxMesh(panelW, panelH, panelDepth, panelW / 2, panelH / 2, 0, 0, pMat);
  panelGroup.add(panel);

  // Handle (small sphere)
  const hMat = mat('#c0c0c0', { metalness: 0.8, roughness: 0.2 });
  const hGeom = new THREE.SphereGeometry(0.03, 12, 12);
  const hMesh = new THREE.Mesh(hGeom, hMat);
  hMesh.position.set(panelW - 0.08, panelH / 2, panelDepth / 2 + 0.015);
  panelGroup.add(hMesh);

  group.add(panelGroup);
  return group;
}

// ---------------------------------------------------------------------------
// Window geometry — mirrors Window3D
// ---------------------------------------------------------------------------

function buildWindowMeshes(win, wallStart, wallAngle, wallUx, wallUz, wallLength, wallThickness, frameColor, glassColor) {
  const { position: tPos, width: winW, height: winH, sillHeight } = win;
  const centreMetre = tPos * wallLength;
  const worldX = wallStart.x + wallUx * centreMetre;
  const worldZ = wallStart.y + wallUz * centreMetre;

  const frameThick = 0.035;
  const frameDepth = wallThickness + 0.02;
  const glassW = winW - frameThick * 2;
  const glassH = winH - frameThick * 2;
  const glassDepth = 0.01;

  const fMat = mat(frameColor, { roughness: 0.4 });
  const gMat = mat(glassColor, { roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.35 });

  const group = new THREE.Group();
  group.position.set(worldX, sillHeight, worldZ);
  group.rotation.y = -wallAngle;
  group.userData = { kind: 'window', entityId: win.id };

  group.add(boxMesh(frameThick, winH, frameDepth, -winW / 2 + frameThick / 2, winH / 2, 0, 0, fMat));
  group.add(boxMesh(frameThick, winH, frameDepth,  winW / 2 - frameThick / 2, winH / 2, 0, 0, fMat));
  group.add(boxMesh(winW, frameThick, frameDepth,  0, winH - frameThick / 2, 0, 0, fMat));
  group.add(boxMesh(winW, frameThick, frameDepth,  0, frameThick / 2, 0, 0, fMat));
  // Centre mullions
  group.add(boxMesh(frameThick * 0.7, winH - frameThick * 2, frameDepth * 0.8, 0, winH / 2, 0, 0, fMat));
  group.add(boxMesh(winW - frameThick * 2, frameThick * 0.7, frameDepth * 0.8, 0, winH / 2, 0, 0, fMat));
  // Glass
  const glassGeom = new THREE.BoxGeometry(glassW, glassH, glassDepth);
  const glassMesh = new THREE.Mesh(glassGeom, gMat);
  glassMesh.position.set(0, winH / 2, 0);
  group.add(glassMesh);

  return group;
}

// ---------------------------------------------------------------------------
// Floor slab — mirrors Floor3D
// ---------------------------------------------------------------------------

/**
 * Build the extruded floor slab mesh with stair holes punched out.
 * stairHoles: array of [{x,y}] outline polygons (from getStairOutline)
 */
function buildFloorSlab(loop, stairHoles, floorColor) {
  const { points } = loop;
  if (!points || points.length < 3) return null;

  const shape = new THREE.Shape();
  shape.moveTo(points[0].x, -points[0].y);
  for (let i = 1; i < points.length; i++) {
    shape.lineTo(points[i].x, -points[i].y);
  }
  shape.closePath();

  // Punch stair holes using the merged outline polygon (getStairOutline already returns
  // a single merged polygon — not the multi-rect getStairPolygons which earcut rejects)
  if (stairHoles && stairHoles.length > 0) {
    for (const holePoly of stairHoles) {
      if (!holePoly || holePoly.length < 3) continue;
      if (!pointInPolygon(holePoly[0], points)) continue;
      const h = new THREE.Path();
      h.moveTo(holePoly[0].x, -holePoly[0].y);
      for (let i = 1; i < holePoly.length; i++) {
        h.lineTo(holePoly[i].x, -holePoly[i].y);
      }
      h.closePath();
      shape.holes.push(h);
    }
  }

  const geom = new THREE.ExtrudeGeometry(shape, { depth: FLOOR_SLAB_DEPTH, bevelEnabled: false });
  const m = mat(floorColor || '#94a3b8', { roughness: 0.9, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geom, m);
  // Floor3D: position=[0,0,0] rotation=[-PI/2,0,0]
  mesh.rotation.set(-Math.PI / 2, 0, 0);
  mesh.receiveShadow = true;
  mesh.userData = { kind: 'floor-slab', entityId: loop.id };
  return mesh;
}

// ---------------------------------------------------------------------------
// Flat roof — mirrors FlatRoof3D
// ---------------------------------------------------------------------------

function buildFlatRoof(loop, wallHeight, stairHoles, roofColor) {
  const { points } = loop;
  if (!points || points.length < 3) return null;

  const shape = new THREE.Shape();
  shape.moveTo(points[0].x, -points[0].y);
  for (let i = 1; i < points.length; i++) {
    shape.lineTo(points[i].x, -points[i].y);
  }
  shape.closePath();

  if (stairHoles && stairHoles.length > 0) {
    for (const holePoly of stairHoles) {
      if (!holePoly || holePoly.length < 3) continue;
      if (!pointInPolygon(holePoly[0], points)) continue;
      const h = new THREE.Path();
      h.moveTo(holePoly[0].x, -holePoly[0].y);
      for (let i = 1; i < holePoly.length; i++) {
        h.lineTo(holePoly[i].x, -holePoly[i].y);
      }
      h.closePath();
      shape.holes.push(h);
    }
  }

  const geom = new THREE.ExtrudeGeometry(shape, { depth: FLAT_ROOF_SLAB_DEPTH, bevelEnabled: false });
  const m = mat(roofColor, { roughness: 0.6, metalness: 0.1, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geom, m);
  // FlatRoof3D: position=[0, wallHeight-SLAB_DEPTH, 0], rotation=[-PI/2,0,0]
  mesh.position.set(0, wallHeight - FLAT_ROOF_SLAB_DEPTH, 0);
  mesh.rotation.set(-Math.PI / 2, 0, 0);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { kind: 'flat-roof', entityId: loop.id };
  return mesh;
}

// ---------------------------------------------------------------------------
// Gable/hip roof — mirrors GableRoof3D (only exported when !hasFloorAbove)
// ---------------------------------------------------------------------------

function buildGableRoof(loop, wallHeight, roofHeight, roofColor) {
  const { points } = loop;
  if (!points || points.length < 3) return null;

  let cx = 0, cy = 0;
  points.forEach((p) => { cx += p.x; cy += p.y; });
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

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(roofPositions, 3));
  geom.computeVertexNormals();

  const m = mat(roofColor, { roughness: 0.55, metalness: 0.15, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geom, m);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { kind: 'gable-roof', entityId: loop.id };
  return mesh;
}

// ---------------------------------------------------------------------------
// Cantilever slab — mirrors CantileverSlab3D (structural geometry only, no
// red emissive warning overlay — that is editor-only)
// ---------------------------------------------------------------------------

function buildCantileverSlab(strips, wallHeight, roofColor) {
  if (!strips || strips.length === 0) return null;

  const positions = [];
  const normals   = [];

  for (const s of strips) {
    const { x0, x1, y0, y1 } = s;

    // Top face
    positions.push(
      x0, CANTILEVER_THICKNESS, y0,  x1, CANTILEVER_THICKNESS, y1,  x1, CANTILEVER_THICKNESS, y0,
      x0, CANTILEVER_THICKNESS, y0,  x0, CANTILEVER_THICKNESS, y1,  x1, CANTILEVER_THICKNESS, y1,
    );
    normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);

    // Bottom face
    positions.push(
      x0, 0, y0,  x1, 0, y0,  x1, 0, y1,
      x0, 0, y0,  x1, 0, y1,  x0, 0, y1,
    );
    normals.push(0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0);
  }

  if (positions.length === 0) return null;

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('normal',   new THREE.Float32BufferAttribute(normals,   3));

  const m = mat(roofColor, { roughness: 0.6, metalness: 0.1 });
  const mesh = new THREE.Mesh(geom, m);
  // Positioned at the lower floor's ceiling height (same as CantileverSlab3D group position)
  mesh.position.set(0, wallHeight, 0);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { kind: 'cantilever-slab' };
  return mesh;
}

// ---------------------------------------------------------------------------
// Furniture geometry — mirrors Furniture3D switch-case
// No selection tinting, no overlap warning box, no rotate handle.
// ---------------------------------------------------------------------------

function buildFurnitureMeshes(item) {
  const cat = FURNITURE_CATALOG[item.type] || FURNITURE_CATALOG.table;
  const s = item.scale ?? 1.0;
  const mainColor  = item.color || cat.color;
  const darkColor  = darkenColor(mainColor);
  const lightColor = '#f0ece4';
  const metalColor = '#c8c8c8';

  const group = new THREE.Group();
  group.position.set(item.x, 0, item.y);
  group.rotation.y = (-(item.rotation ?? 0) * Math.PI) / 180;
  group.scale.set(s, s, s);
  group.userData = { kind: 'furniture', entityId: item.id, furnitureType: item.type };

  const mp = mat(mainColor, { roughness: 0.8 });
  const dp = mat(darkColor,  { roughness: 0.8 });
  const lp = mat(lightColor, { roughness: 0.95 });
  const metP = mat(metalColor, { metalness: 0.7, roughness: 0.3 });

  switch (item.type) {
    case 'bed':
      group.add(boxMesh(1.58, 0.22, 1.98, 0, 0.12, 0, 0, dp));   // frame
      group.add(boxMesh(1.42, 0.14, 1.70, 0, 0.28, 0.05, 0, lp)); // mattress
      group.add(boxMesh(1.52, 0.82, 0.10, 0, 0.62, -0.88, 0, dp)); // headboard
      group.add(boxMesh(0.48, 0.10, 0.38, -0.3, 0.38, -0.38, 0, mat('#e8e0d0', { roughness: 0.98 }))); // pillow 1
      group.add(boxMesh(0.48, 0.10, 0.38,  0.3, 0.38, -0.38, 0, mat('#e8e0d0', { roughness: 0.98 }))); // pillow 2
      break;

    case 'sofa':
      group.add(boxMesh(1.72, 0.32, 0.52, 0, 0.22, 0.05, 0, mp));   // seat
      group.add(boxMesh(1.65, 0.08, 0.48, 0, 0.39, 0.05, 0, mp));   // seat top
      group.add(boxMesh(1.72, 0.44, 0.16, 0, 0.58, -0.27, 0, dp));  // back
      group.add(boxMesh(0.18, 0.45, 0.70, -0.88, 0.38, 0, 0, mp));  // left arm
      group.add(boxMesh(0.18, 0.45, 0.70,  0.88, 0.38, 0, 0, mp));  // right arm
      for (const [lx, lz] of [[-0.8, -0.3], [0.8, -0.3], [-0.8, 0.3], [0.8, 0.3]]) {
        group.add(cylMesh(0.04, 0.04, 0.08, 6, lx, 0.04, lz, mat('#222222', { roughness: 0.4, metalness: 0.5 })));
      }
      break;

    case 'table':
      group.add(boxMesh(1.18, 0.05, 0.78, 0, 0.76, 0, 0, mp));       // top
      group.add(boxMesh(1.00, 0.07, 0.03, 0, 0.70,  0.34, 0, dp));   // front apron
      group.add(boxMesh(1.00, 0.07, 0.03, 0, 0.70, -0.34, 0, dp));   // back apron
      for (const [lx, lz] of [[-0.52, -0.32], [0.52, -0.32], [-0.52, 0.32], [0.52, 0.32]]) {
        group.add(cylMesh(0.04, 0.04, 0.73, 8, lx, 0.365, lz, dp));
      }
      break;

    case 'chair':
      // Matches View3D chair geometry exactly — see View3D.jsx case 'chair' comments.
      // Seat height 0.45 m (standard dining chair), legs 0.41 m, back panel 0.40 m.
      group.add(boxMesh(0.48, 0.08, 0.46,  0,     0.45,   0.02, 0, mp));  // seat
      group.add(boxMesh(0.48, 0.40, 0.07,  0,     0.69,  -0.20, 0, dp));  // back panel
      group.add(boxMesh(0.48, 0.05, 0.09,  0,     0.915, -0.20, 0, dp));  // top rail
      for (const [lx, lz] of [[-0.2, 0.2], [0.2, 0.2], [-0.2, -0.2], [0.2, -0.2]]) {
        group.add(cylMesh(0.025, 0.025, 0.41, 6, lx, 0.205, lz, dp));    // legs
      }
      break;


    case 'wardrobe':
      group.add(boxMesh(1.17, 2.00, 0.57, 0, 1.05, 0, 0, mp));       // body
      group.add(boxMesh(0.54, 1.86, 0.025, -0.30, 1.05, 0.29, 0, dp)); // left door
      group.add(boxMesh(0.54, 1.86, 0.025,  0.30, 1.05, 0.29, 0, dp)); // right door
      group.add(boxMesh(0.04, 0.14, 0.03, -0.08, 1.05, 0.31, 0, metP)); // left handle
      group.add(boxMesh(0.04, 0.14, 0.03,  0.08, 1.05, 0.31, 0, metP)); // right handle
      group.add(boxMesh(1.22, 0.07, 0.62, 0, 2.07, 0, 0, dp));       // crown
      break;

    case 'kitchen_counter':
    default:
      group.add(boxMesh(2.37, 0.85, 0.57, 0, 0.43, 0, 0, mp));           // cabinet
      group.add(boxMesh(2.40, 0.04, 0.63, 0, 0.875, 0.03, 0, lp));       // countertop
      for (const dx of [-0.78, 0, 0.78]) {
        group.add(boxMesh(0.02, 0.72, 0.02, dx, 0.43, 0.295, 0, dp));    // dividers
        group.add(boxMesh(0.22, 0.03, 0.03, dx, 0.60, 0.310, 0, metP)); // handles
      }
      group.add(boxMesh(2.37, 0.65, 0.03, 0, 1.20, -0.25, 0, dp));       // backsplash
      break;
  }

  return group;
}

// ---------------------------------------------------------------------------
// Stair geometry — mirrors Stair3D.renderSteps (all 3 types)
// No selection ring, no collision warning.
// ---------------------------------------------------------------------------

function buildStairMeshes(stair, floorHeight) {
  const { type, x, y, rotation, width, run, landingLength, turnDirection, stepCount, color } = stair;
  const w = width ?? 1.0;
  const d = run ?? 3.0;
  const l = landingLength ?? 1.0;
  const N = stepCount ?? 15;
  const riser = floorHeight / N;
  const rotRad = (-(rotation ?? 0) * Math.PI) / 180;

  const stairMat = mat(color || '#8b6b45', { roughness: 0.7 });

  const group = new THREE.Group();
  group.position.set(x, 0, y);
  group.rotation.y = rotRad;
  // Preserve existing staircase userData (mirrors View3D line 1162)
  group.userData = { kind: 'staircase', stairId: stair.id };

  if (type === 'straight') {
    const tread = d / N;
    for (let i = 0; i < N; i++) {
      const h = (i + 1) * riser;
      group.add(boxMesh(w, h, tread, 0, h / 2, -d / 2 + tread / 2 + i * tread, 0, stairMat));
    }
  } else if (type === 'l_shape') {
    const f1Run = d / 2;
    const f2Run = d / 2;
    const N1 = Math.floor((N - 1) / 2);
    const N2 = N - 1 - N1;
    const t1 = f1Run / N1;
    const t2 = f2Run / N2;

    for (let i = 0; i < N1; i++) {
      const h = (i + 1) * riser;
      group.add(boxMesh(w, h, t1, 0, h / 2, -f1Run / 2 + t1 / 2 + i * t1, 0, stairMat));
    }

    const hLand = (N1 + 1) * riser;
    const landingCenterZ = f1Run / 2 + l / 2;
    group.add(boxMesh(w, hLand, l, 0, hLand / 2, landingCenterZ, 0, stairMat));

    const dir = turnDirection === 'left' ? -1 : 1;
    for (let i = 0; i < N2; i++) {
      const h = (N1 + 1 + i + 1) * riser;
      const cx = (dir * w / 2) + (dir * t2 / 2) + (dir * i * t2);
      group.add(boxMesh(t2, h, w, cx, h / 2, landingCenterZ, 0, stairMat));
    }
  } else if (type === 'u_shape') {
    const gap = 0.2;
    const f1Run = d / 2;
    const f2Run = d / 2;
    const N1 = Math.floor((N - 1) / 2);
    const N2 = N - 1 - N1;
    const t1 = f1Run / N1;
    const t2 = f2Run / N2;
    const f1OffsetX = turnDirection === 'left' ? (w / 2 + gap / 2) : -(w / 2 + gap / 2);
    const f2OffsetX = turnDirection === 'left' ? -(w / 2 + gap / 2) : (w / 2 + gap / 2);
    const landingCenterZ = f1Run / 2 + l / 2;
    const totalLandingW = w * 2 + gap;

    for (let i = 0; i < N1; i++) {
      const h = (i + 1) * riser;
      group.add(boxMesh(w, h, t1, f1OffsetX, h / 2, -f1Run / 2 + t1 / 2 + i * t1, 0, stairMat));
    }

    const hLand = (N1 + 1) * riser;
    group.add(boxMesh(totalLandingW, hLand, l, 0, hLand / 2, landingCenterZ, 0, stairMat));

    for (let i = 0; i < N2; i++) {
      const h = (N1 + 1 + i + 1) * riser;
      group.add(boxMesh(w, h, t2, f2OffsetX, h / 2, landingCenterZ - l / 2 - t2 / 2 - i * t2, 0, stairMat));
    }
  }

  return group;
}

// ---------------------------------------------------------------------------
// buildExportScene — constructs the complete export-only THREE.Scene.
//
// Exported for unit testing. Do NOT pass this scene to R3F or mutate it
// after GLTFExporter.parse() has been called.
// ---------------------------------------------------------------------------

export function buildExportScene(design) {
  const scene = new THREE.Scene();
  const floors = design?.floors || [];

  // Precompute loops (same as View3D allFloorLoops)
  const loopsPerFloor = floors.map((f) => findClosedLoops(f.walls || []));

  // Precompute stair opening outlines per floor (merged outline = getStairOutline)
  // ceilingHoles[i]: outlines from stairs on floor i, punch into that floor's ceiling
  // floorHoles[i]:   outlines from stairs on floor i-1, punch into floor i's slab
  const ceilingHolesPerFloor = {};
  const floorHolesPerFloor   = {};

  for (let i = 0; i < floors.length; i++) {
    const floorStairs = floors[i].stairs || [];
    const outlines = [];
    for (const s of floorStairs) {
      const outline = getStairOutline(s);
      if (outline.length >= 3) outlines.push(outline);
    }
    if (outlines.length > 0) {
      ceilingHolesPerFloor[i] = outlines;
      if (i + 1 < floors.length) {
        floorHolesPerFloor[i + 1] = outlines;
      }
    }
  }

  // Precompute cantilever slab data per lower floor index (mirrors cantileverSlabsByFloor)
  const cantileverSlabsByFloor = {};
  for (let upperIdx = 1; upperIdx < floors.length; upperIdx++) {
    const lowerIdx   = upperIdx - 1;
    const upperLoops = loopsPerFloor[upperIdx] || [];
    const lowerLoops = loopsPerFloor[lowerIdx] || [];

    if (!upperLoops.length || !lowerLoops.length) continue;

    const slabs = [];
    for (const upperLoop of upperLoops) {
      const strips = computePolygonOverhang(upperLoop.points, lowerLoops);
      if (!strips.length) continue;

      const supportFraction = computeSupportFraction(upperLoop.points, lowerLoops);
      const isExtreme = supportFraction < 0.30; // retained for metadata, not for export style

      const lowerWalls = floors[lowerIdx].walls || [];
      const wallHeight = lowerWalls.length > 0
        ? Math.max(...lowerWalls.map((w) => w.height ?? 3))
        : 3;

      const lowerMats = { ...GLOBAL_DEFAULTS, ...(floors[lowerIdx].materials || {}) };

      slabs.push({ strips, isExtreme, wallHeight, roofColor: lowerMats.roofColor });
    }

    if (slabs.length) cantileverSlabsByFloor[lowerIdx] = slabs;
  }

  // Build per-floor groups
  for (let idx = 0; idx < floors.length; idx++) {
    const floor = floors[idx];
    const baseY = getFloorBaseY(floors, idx);
    const loops = loopsPerFloor[idx] || [];
    const isTopmost = idx === floors.length - 1;
    const hasFloorAbove = !isTopmost; // mirrors FloorScene prop

    // Wall height for this floor (used for roof + ceiling positioning)
    const floorWalls = floor.walls || [];
    const floorHeight = floorWalls.length > 0
      ? Math.max(...floorWalls.map((w) => w.height ?? 3))
      : 3;

    const globals = { ...GLOBAL_DEFAULTS, ...(floor.materials || {}) };

    const floorGroup = new THREE.Group();
    floorGroup.position.set(0, baseY, 0);
    floorGroup.userData = { kind: 'floor', floorId: floor.id, label: floor.label || '' };

    // ---- Walls (with door + window cutouts) ----
    const wallsGroup = new THREE.Group();
    wallsGroup.userData = { kind: 'walls', floorId: floor.id };

    const doors   = floor.doors   || [];
    const windows = floor.windows || [];

    for (const wall of floorWalls) {
      const wallColor  = wall.material?.color ?? globals.wallColor;
      const wallDoors  = doors.filter((d) => d.wallId === wall.id);
      const wallWins   = windows.filter((w) => w.wallId === wall.id);

      const dx = wall.end.x - wall.start.x;
      const dz = wall.end.y - wall.start.y;
      const length = Math.hypot(dx, dz);
      const angle = Math.atan2(dz, dx);
      const ux = length > 0 ? dx / length : 0;
      const uz = length > 0 ? dz / length : 0;

      // Wall segments
      const segs = buildWallMeshes(wall, wallDoors, wallWins, wallColor);
      for (const seg of segs) {
        seg.userData = { kind: 'wall', entityId: wall.id, floorId: floor.id };
        wallsGroup.add(seg);
      }

      // Doors
      for (const door of wallDoors) {
        const dg = buildDoorMeshes(
          door, wall.start, angle, ux, uz, length, wall.thickness ?? 0.2,
          globals.doorFrameColor, globals.doorPanelColor
        );
        dg.userData.floorId = floor.id;
        wallsGroup.add(dg);
      }

      // Windows
      for (const win of wallWins) {
        const wg = buildWindowMeshes(
          win, wall.start, angle, ux, uz, length, wall.thickness ?? 0.2,
          globals.windowFrameColor, globals.windowGlassColor
        );
        wg.userData.floorId = floor.id;
        wallsGroup.add(wg);
      }
    }
    floorGroup.add(wallsGroup);

    // ---- Rooms: floor slabs + roofs ----
    const roomsGroup = new THREE.Group();
    roomsGroup.userData = { kind: 'rooms', floorId: floor.id };

    const stairHolesFloor   = floorHolesPerFloor[idx]   || [];
    const stairHolesCeiling = ceilingHolesPerFloor[idx] || [];

    const rooms = floor.rooms || [];

    for (const loop of loops) {
      // Robust room resolution — mirrors FloorScene in View3D.jsx.
      // loop.id = sorted wall IDs joined by comma (from findClosedLoops).
      let room = rooms.find((r) => r.id === loop.id);

      if (!room) {
        const loopWallSet = new Set(loop.id.split(','));
        room = rooms.find((r) => {
          let rWalls;
          if (r.wallIds && r.wallIds.length) {
            rWalls = r.wallIds;
          } else {
            const stripped = r.id.replace(/^room-/, '');
            rWalls = stripped.includes(',') ? stripped.split(',') : [];
          }
          if (!rWalls.length) return false;
          const rWallSet = new Set(rWalls);
          return (
            [...loopWallSet].every((w) => rWallSet.has(w)) ||
            [...rWallSet].every((w) => loopWallSet.has(w))
          );
        });
      }

      room = room || {};
      const explicitRoof = room.roof;

      // Determine effective roof — guaranteed ceiling when hasFloorAbove
      let effectiveRoof;
      if (explicitRoof && explicitRoof.enabled) {
        effectiveRoof = explicitRoof;
      } else if (hasFloorAbove) {
        effectiveRoof = {
          enabled: true,
          type: 'flat',
          height: 0.18,
          color: globals.roofColor ?? '#2A2E37',
        };
      } else {
        effectiveRoof = null;
      }

      const roofColor = effectiveRoof?.color ?? globals.roofColor;

      // Floor slab
      const slab = buildFloorSlab(loop, stairHolesFloor, room.floorColor);
      if (slab) {
        slab.userData.floorId = floor.id;
        roomsGroup.add(slab);
      }

      // Roof
      if (effectiveRoof && effectiveRoof.enabled) {
        if (effectiveRoof.type === 'gable') {
          // Gable: skip when hasFloorAbove (matches gablesHidden = roofsHidden || hasFloorAbove)
          if (!hasFloorAbove) {
            const gm = buildGableRoof(loop, floorHeight, effectiveRoof.height || 1.5, roofColor);
            if (gm) {
              gm.userData.floorId = floor.id;
              roomsGroup.add(gm);
            }
          }
        } else {
          // Flat ceiling: always export
          const fm = buildFlatRoof(loop, floorHeight, stairHolesCeiling, roofColor);
          if (fm) {
            fm.userData.floorId = floor.id;
            roomsGroup.add(fm);
          }
        }
      }
    }

    floorGroup.add(roomsGroup);

    // ---- Furniture ----
    const furnGroup = new THREE.Group();
    furnGroup.userData = { kind: 'furniture-group', floorId: floor.id };
    for (const item of (floor.furniture || [])) {
      const fg = buildFurnitureMeshes(item);
      fg.userData.floorId = floor.id;
      furnGroup.add(fg);
    }
    floorGroup.add(furnGroup);

    // ---- Stairs ----
    const stairsGroup = new THREE.Group();
    stairsGroup.userData = { kind: 'stairs-group', floorId: floor.id };
    for (const stair of (floor.stairs || [])) {
      const sg = buildStairMeshes(stair, floorHeight);
      sg.userData.floorId = floor.id;
      stairsGroup.add(sg);
    }
    floorGroup.add(stairsGroup);

    // ---- Cantilever slabs (this lower floor's overhangs) ----
    const cantSlabs = cantileverSlabsByFloor[idx] || [];
    if (cantSlabs.length > 0) {
      const cantGroup = new THREE.Group();
      cantGroup.userData = { kind: 'cantilever-slabs', floorId: floor.id };
      for (const slab of cantSlabs) {
        const cm = buildCantileverSlab(slab.strips, slab.wallHeight, slab.roofColor);
        if (cm) {
          // Note: CantileverSlab3D mesh already positions itself at wallHeight via group Y;
          // in export we set the mesh position directly (no outer group offset), matching
          // the live renderer where the group is at Y=baseY and the slab group is at Y=wallHeight.
          // Since floorGroup is already at baseY, the slab's own position.y = wallHeight is correct.
          cantGroup.add(cm);
        }
      }
      floorGroup.add(cantGroup);
    }

    scene.add(floorGroup);
  }

  return scene;
}

// ---------------------------------------------------------------------------
// sanitizeFilename — makes a safe filename component from a project name.
// Mirrors the logic in saveProjectToFile() in project.js.
// ---------------------------------------------------------------------------

export function sanitizeFilename(name) {
  return (name || 'Untitled Project')
    .replace(/[^a-zA-Z0-9_\- ]/g, '')
    .trim() || 'Untitled Project';
}

// ---------------------------------------------------------------------------
// exportGlb — main entry point.
//
// Builds an export scene from design + projectMeta, serializes with
// GLTFExporter (binary GLB), and triggers a browser download.
//
// Guarantees:
//   • Does NOT call pushState, setStateOnly, or reset.
//   • Does NOT modify design or any React state.
//   • Does NOT create undo history entries.
//   • Shows a native alert on failure (temporary — to be replaced by toast).
// ---------------------------------------------------------------------------

export function exportGlb(design, projectMeta) {
  const projectName = projectMeta?.projectName || design?._projectMeta?.projectName || 'Untitled Project';
  const safeName = sanitizeFilename(projectName);

  let scene;
  try {
    scene = buildExportScene(design);
  } catch (err) {
    throw new Error(`Failed to build export scene: ${err.message}`);
  }

  const exporter = new GLTFExporter();

  return new Promise((resolve, reject) => {
    exporter.parse(
      scene,
      (result) => {
        try {
          // result is an ArrayBuffer for binary=true
          const blob = new Blob([result], { type: 'model/gltf-binary' });
          const url  = URL.createObjectURL(blob);

          const a = document.createElement('a');
          a.href     = url;
          a.download = `${safeName}.glb`;
          document.body.appendChild(a);
          a.click();

          setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }, 100);

          resolve();
        } catch (err) {
          reject(new Error(`Failed to download GLB: ${err.message}`));
        }
      },
      (err) => {
        reject(new Error(`GLTFExporter error: ${err?.message || String(err)}`));
      },
      { binary: true }
    );
  });
}

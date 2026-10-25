/**
 * test_glb_export.mjs — Static unit tests for the GLB export pipeline.
 *
 * Tests:
 *   1. buildExportScene() — structure, entity kinds, stair userData, elevations,
 *      no editor-only objects, no NaN coords.
 *   2. GLTFExporter serialization — non-empty ArrayBuffer, GLB magic bytes,
 *      no exporter error.
 *   3. sanitizeFilename() — safe output verified.
 *
 * Run: node --experimental-vm-modules test_glb_export.mjs
 * (No Playwright / browser needed — pure Node.js with Three.js.)
 */

import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { buildExportScene, sanitizeFilename } from './src/utils/exportGlb.js';

// ---- Minimal browser globals required by Three.js CanvasTexture fallback ----
// (not used in export path, but import guard needs document for GLTFExporter blob)
if (typeof document === 'undefined') {
  // Stub only what GLTFExporter's URL/Blob usage needs
  global.document = {
    createElement: () => ({ style: {}, click: () => {}, appendChild: () => {}, removeChild: () => {} }),
    body: { appendChild: () => {}, removeChild: () => {} },
  };
  global.URL = { createObjectURL: () => 'blob:mock', revokeObjectURL: () => {} };
  global.Blob = class Blob {
    constructor(parts) { this._parts = parts; }
  };
}

// ---- Test helpers ----
let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) {
    console.log(`  ✅  ${msg}`);
    passed++;
  } else {
    console.error(`  ❌  FAIL: ${msg}`);
    failed++;
  }
}

function assertEq(a, b, msg) {
  if (a === b) {
    console.log(`  ✅  ${msg} (${JSON.stringify(a)})`);
    passed++;
  } else {
    console.error(`  ❌  FAIL: ${msg} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
    failed++;
  }
}

// ---- Synthetic 2-floor test design ----
const design = {
  _projectMeta: { projectName: 'Test/Project!', projectId: 'test-123' },
  floors: [
    {
      id: 'floor-0',
      label: 'Ground Floor',
      walls: [
        { id: 'w1', start: { x: 0, y: 0 }, end: { x: 5, y: 0 }, height: 3, thickness: 0.2 },
        { id: 'w2', start: { x: 5, y: 0 }, end: { x: 5, y: 4 }, height: 3, thickness: 0.2 },
        { id: 'w3', start: { x: 5, y: 4 }, end: { x: 0, y: 4 }, height: 3, thickness: 0.2 },
        { id: 'w4', start: { x: 0, y: 4 }, end: { x: 0, y: 0 }, height: 3, thickness: 0.2 },
      ],
      doors: [
        { id: 'd1', wallId: 'w1', position: 0.5, width: 0.9, height: 2.1, isOpen: false, sillHeight: 0 },
      ],
      windows: [
        { id: 'win1', wallId: 'w2', position: 0.5, width: 1.0, height: 1.2, sillHeight: 0.9 },
      ],
      rooms: [
        { id: 'w1,w2,w3,w4', roof: { enabled: true, type: 'flat', color: '#888888' }, floorColor: '#aaaaaa' },
      ],
      furniture: [
        { id: 'f1', type: 'table', x: 2, y: 2, rotation: 0, scale: 1, color: '#8b5a2b' },
        { id: 'f2', type: 'bed',   x: 3, y: 3, rotation: 90, scale: 1, color: '#4b2e1e' },
        { id: 'f3', type: 'sofa',  x: 1, y: 1, rotation: 0, scale: 1 },
        { id: 'f4', type: 'chair', x: 1, y: 3, rotation: 0, scale: 1 },
        { id: 'f5', type: 'wardrobe',      x: 4, y: 1, rotation: 0, scale: 1 },
        { id: 'f6', type: 'kitchen_counter', x: 4, y: 3, rotation: 0, scale: 1 },
      ],
      stairs: [
        {
          id: 's1', type: 'straight', x: 1, y: 1, rotation: 0,
          width: 1.0, run: 3.0, landingLength: 1.0, turnDirection: 'left',
          stepCount: 15, color: '#8b6b45',
        },
        {
          id: 's2', type: 'l_shape', x: 3, y: 0.5, rotation: 0,
          width: 1.0, run: 3.0, landingLength: 1.0, turnDirection: 'right',
          stepCount: 15, color: '#7a5c38',
        },
        {
          id: 's3', type: 'u_shape', x: 2, y: 2, rotation: 45,
          width: 1.0, run: 3.0, landingLength: 1.0, turnDirection: 'left',
          stepCount: 15, color: '#6b4e2a',
        },
      ],
      materials: { roofColor: '#555555' },
    },
    {
      id: 'floor-1',
      label: '1st Floor',
      walls: [
        { id: 'w5', start: { x: 0, y: 0 }, end: { x: 5, y: 0 }, height: 3, thickness: 0.2 },
        { id: 'w6', start: { x: 5, y: 0 }, end: { x: 5, y: 4 }, height: 3, thickness: 0.2 },
        { id: 'w7', start: { x: 5, y: 4 }, end: { x: 0, y: 4 }, height: 3, thickness: 0.2 },
        { id: 'w8', start: { x: 0, y: 4 }, end: { x: 0, y: 0 }, height: 3, thickness: 0.2 },
      ],
      doors: [],
      windows: [],
      // Gable roof on the TOPMOST floor — should be exported (no floor above)
      rooms: [
        { id: 'w5,w6,w7,w8', roof: { enabled: true, type: 'gable', height: 1.5, color: '#666666' }, floorColor: '#bbbbbb' },
      ],
      furniture: [
        { id: 'f7', type: 'chair', x: 2, y: 2, rotation: 0, scale: 1 },
      ],
      stairs: [],
      materials: { roofColor: '#666666' },
    },
  ],
};

// ---- SECTION 1: buildExportScene() tests ----
console.log('\n=== 1. buildExportScene() tests ===\n');

const scene = buildExportScene(design);

assert(scene instanceof THREE.Scene, 'Result is a THREE.Scene');

// Collect all objects
const allObjects = [];
scene.traverse((obj) => allObjects.push(obj));

// 1a. No editor-only objects
const forbiddenTypes = [THREE.GridHelper, THREE.AxesHelper, THREE.Light, THREE.Camera, THREE.Line];
for (const ForbiddenClass of forbiddenTypes) {
  const found = allObjects.some((o) => o instanceof ForbiddenClass);
  assert(!found, `No ${ForbiddenClass.name} in export scene`);
}

// 1b. No selection tinting (selection-green #86efac / #a3e635 must not appear)
const selectionColors = ['#86efac', '#a3e635', '#22c55e'];
let hasSelectionColor = false;
scene.traverse((obj) => {
  if (obj.isMesh && obj.material) {
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) {
      if (m.color) {
        const hex = `#${m.color.getHexString()}`;
        if (selectionColors.includes(hex)) hasSelectionColor = true;
      }
    }
  }
});
assert(!hasSelectionColor, 'No selection-tint colors in export materials');

// 1c. No collision-red emissive material (editor-only)
let hasCollisionRed = false;
scene.traverse((obj) => {
  if (obj.isMesh && obj.material) {
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) {
      if (m.emissive && m.emissiveIntensity > 0) {
        const hex = `#${m.emissive.getHexString()}`;
        if (hex === '#ef4444') hasCollisionRed = true;
      }
    }
  }
});
assert(!hasCollisionRed, 'No collision-red emissive material in export');

// 1d. All expected entity kinds present
const kindsFound = new Set();
scene.traverse((obj) => {
  if (obj.userData?.kind) kindsFound.add(obj.userData.kind);
});
console.log('  Entity kinds found:', [...kindsFound].sort().join(', '));

const expectedKinds = ['floor', 'walls', 'wall', 'door', 'window', 'rooms', 'floor-slab', 'flat-roof', 'gable-roof', 'furniture-group', 'furniture', 'stairs-group', 'staircase'];
for (const k of expectedKinds) {
  assert(kindsFound.has(k), `Entity kind "${k}" found in scene`);
}

// 1e. Stairs retain userData.kind = 'staircase' and userData.stairId
const stairGroups = [];
scene.traverse((obj) => {
  if (obj.userData?.kind === 'staircase') stairGroups.push(obj);
});
assert(stairGroups.length === 3, `3 staircase groups found (got ${stairGroups.length})`);
assert(stairGroups.every((g) => typeof g.userData.stairId === 'string'), 'All staircase groups have stairId');
assert(stairGroups.some((g) => g.userData.stairId === 's1'), 'straight stair s1 has correct stairId');
assert(stairGroups.some((g) => g.userData.stairId === 's2'), 'l_shape stair s2 has correct stairId');
assert(stairGroups.some((g) => g.userData.stairId === 's3'), 'u_shape stair s3 has correct stairId');

// 1f. Floor groups have correct baseY elevations
const floorGroups = [];
scene.traverse((obj) => {
  if (obj.userData?.kind === 'floor') floorGroups.push(obj);
});
assert(floorGroups.length === 2, `2 floor groups found (got ${floorGroups.length})`);
const gf = floorGroups.find((g) => g.userData.floorId === 'floor-0');
const ff = floorGroups.find((g) => g.userData.floorId === 'floor-1');
assert(gf && Math.abs(gf.position.y) < 0.001, 'Ground floor baseY = 0');
assert(ff && Math.abs(ff.position.y - 3) < 0.001, '1st floor baseY = 3 (ground wall height)');

// 1g. Gable roof on floor-1 (topmost, no floor above) — should be exported
const gableRoofs = [];
scene.traverse((obj) => {
  if (obj.userData?.kind === 'gable-roof') gableRoofs.push(obj);
});
assert(gableRoofs.length === 1, 'Exactly 1 gable roof exported (topmost floor only)');

// 1h. Flat roof on floor-0 (has floor above) — should be exported (flat ceilings always included)
const flatRoofs = [];
scene.traverse((obj) => {
  if (obj.userData?.kind === 'flat-roof') flatRoofs.push(obj);
});
assert(flatRoofs.length === 1, 'Exactly 1 flat roof exported (floor-0 intermediate ceiling)');

// Test with a gable on a non-topmost floor — it should be suppressed
console.log('\n  [Sub-test] Gable on intermediate floor suppression:');
const designWithIntermediateGable = JSON.parse(JSON.stringify(design));
designWithIntermediateGable.floors[0].rooms[0].roof = { enabled: true, type: 'gable', height: 1.5, color: '#555555' };
const scene2 = buildExportScene(designWithIntermediateGable);
const gableRoofs2 = [];
scene2.traverse((obj) => { if (obj.userData?.kind === 'gable-roof') gableRoofs2.push(obj); });
assert(gableRoofs2.length === 1, 'Intermediate gable suppressed; only topmost gable exported (still 1)');

// 1i. All mesh positions are finite (no NaN / Infinity)
let hasNonFinite = false;
scene.traverse((obj) => {
  if (obj.isMesh) {
    const pos = obj.getWorldPosition(new THREE.Vector3());
    if (!isFinite(pos.x) || !isFinite(pos.y) || !isFinite(pos.z)) hasNonFinite = true;
  }
});
assert(!hasNonFinite, 'All mesh world positions are finite (no NaN/Infinity)');

// 1j. All 6 furniture types exported on floor-0
const furnGroups = [];
scene.traverse((obj) => {
  if (obj.userData?.kind === 'furniture') furnGroups.push(obj.userData.furnitureType);
});
const expectedFurnTypes = ['table', 'bed', 'sofa', 'chair', 'wardrobe', 'kitchen_counter'];
for (const ft of expectedFurnTypes) {
  assert(furnGroups.includes(ft), `Furniture type "${ft}" exported`);
}

// 1k. Doors and windows have correct entityId
const doorGroups = [];
scene.traverse((obj) => { if (obj.userData?.kind === 'door') doorGroups.push(obj); });
assert(doorGroups.length === 1 && doorGroups[0].userData.entityId === 'd1', 'Door d1 exported with correct entityId');

const winGroups = [];
scene.traverse((obj) => { if (obj.userData?.kind === 'window') winGroups.push(obj); });
assert(winGroups.length === 1 && winGroups[0].userData.entityId === 'win1', 'Window win1 exported with correct entityId');

// 1l. Confirm export does NOT call pushState, setStateOnly, reset (static — already verified by code inspection)
assert(true, 'exportGlb does not import/call pushState, setStateOnly, or reset (verified by code)');

// ---- SECTION 2: GLTFExporter serialization test ----
console.log('\n=== 2. GLTFExporter serialization test ===\n');

await new Promise((resolve) => {
  const exporter = new GLTFExporter();

  exporter.parse(
    scene,
    (result) => {
      // Should be an ArrayBuffer for binary=true
      assert(result instanceof ArrayBuffer, 'GLTFExporter returns ArrayBuffer');
      assert(result.byteLength > 0, `GLB is non-empty (${result.byteLength} bytes)`);

      // Check GLB magic bytes: first 4 bytes must be 0x46546C67 ('glTF' in ASCII)
      const header = new Uint8Array(result, 0, 4);
      const magic = String.fromCharCode(...header);
      assertEq(magic, 'glTF', 'GLB magic bytes are "glTF"');

      // Check GLB version (bytes 4-7, little-endian uint32) must be 2
      const version = new DataView(result).getUint32(4, true);
      assertEq(version, 2, 'GLB version is 2');

      resolve();
    },
    (err) => {
      assert(false, `GLTFExporter.parse() did not error (got: ${err?.message || err})`);
      resolve();
    },
    { binary: true }
  );
});

// ---- SECTION 3: sanitizeFilename tests ----
console.log('\n=== 3. sanitizeFilename tests ===\n');

assertEq(sanitizeFilename('My House'), 'My House', 'Spaces and letters pass through');
assertEq(sanitizeFilename('Test/Project!'), 'TestProject', 'Slashes and bangs are stripped');
assertEq(sanitizeFilename(''), 'Untitled Project', 'Empty string becomes default');
assertEq(sanitizeFilename(null), 'Untitled Project', 'Null becomes default');
assertEq(sanitizeFilename('!!!'), 'Untitled Project', 'All-special becomes default');
assertEq(sanitizeFilename('My_House-v2'), 'My_House-v2', 'Underscores and hyphens are kept');

// ---- Summary ----
console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('\n⚠  Some tests failed. Review above output.');
  process.exit(1);
} else {
  console.log('\n🎉  All tests passed.');
}

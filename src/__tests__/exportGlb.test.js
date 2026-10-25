/**
 * src/__tests__/exportGlb.test.js — Vitest unit tests for the GLB export pipeline.
 *
 * Runs via: npm test  (or npx vitest run)
 * Uses Vite's module resolver — extensionless local imports resolve identically
 * to the production build. No browser / Playwright needed.
 *
 * Tests:
 *   1. buildExportScene() — structure, entity kinds, stair userData, floor elevations,
 *      no editor-only objects (Grid, Light, Camera), no selection colours,
 *      no collision-red emissive materials, no NaN/Infinity positions.
 *   2. Roof visibility rules — gable suppressed on intermediate floor, flat roof kept.
 *   3. GLTFExporter serialization — non-empty ArrayBuffer, GLB magic bytes, version 2.
 *      (Uses jsdom environment via inline annotation to satisfy FileReader dependency.)
 *   4. sanitizeFilename() — safe output for edge cases.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { buildExportScene, sanitizeFilename } from '../utils/exportGlb';
import { findClosedLoops } from '../utils/geometry';

// ---------------------------------------------------------------------------
// Room IDs are the sorted wall-id set joined by commas, e.g. "w1,w2,w3,w4".
// This is exactly what findClosedLoops() returns (confirmed via CLI check).
// The design's rooms array must use these same IDs for the room lookup in
// buildExportScene to match.
// ---------------------------------------------------------------------------
const FLOOR0_ROOM_ID = 'w1,w2,w3,w4';
const FLOOR1_ROOM_ID = 'w5,w6,w7,w8';

// ---------------------------------------------------------------------------
// Synthetic 2-floor test design.
// Floor 0: flat roof (intermediate ceiling), door, window, all 6 furniture
//          types, all 3 stair types.
// Floor 1: gable roof (topmost → should export), one chair.
// ---------------------------------------------------------------------------
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
      // Room ID must match the loop ID that findClosedLoops() produces from these 4 walls.
      rooms: [
        { id: FLOOR0_ROOM_ID, roof: { enabled: true, type: 'flat', color: '#888888' }, floorColor: '#aaaaaa' },
      ],
      furniture: [
        { id: 'f1', type: 'table',           x: 2, y: 2, rotation: 0,  scale: 1, color: '#8b5a2b' },
        { id: 'f2', type: 'bed',             x: 3, y: 3, rotation: 90, scale: 1, color: '#4b2e1e' },
        { id: 'f3', type: 'sofa',            x: 1, y: 1, rotation: 0,  scale: 1 },
        { id: 'f4', type: 'chair',           x: 1, y: 3, rotation: 0,  scale: 1 },
        { id: 'f5', type: 'wardrobe',        x: 4, y: 1, rotation: 0,  scale: 1 },
        { id: 'f6', type: 'kitchen_counter', x: 4, y: 3, rotation: 0,  scale: 1 },
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
      rooms: [
        { id: FLOOR1_ROOM_ID, roof: { enabled: true, type: 'gable', height: 1.5, color: '#666666' }, floorColor: '#bbbbbb' },
      ],
      furniture: [
        { id: 'f7', type: 'chair', x: 2, y: 2, rotation: 0, scale: 1 },
      ],
      stairs: [],
      materials: { roofColor: '#666666' },
    },
  ],
};

// ---------------------------------------------------------------------------
// Sanity check: verify findClosedLoops produces the expected IDs for our walls
// (so if someone changes the ID format, this fails loudly here rather than
// causing silent mismatches in the export tests below).
// ---------------------------------------------------------------------------
describe('Loop ID sanity (findClosedLoops)', () => {
  it('generates the expected room ID for floor-0 walls', () => {
    const loops = findClosedLoops(design.floors[0].walls);
    expect(loops).toHaveLength(1);
    expect(loops[0].id).toBe(FLOOR0_ROOM_ID);
  });

  it('generates the expected room ID for floor-1 walls', () => {
    const loops = findClosedLoops(design.floors[1].walls);
    expect(loops).toHaveLength(1);
    expect(loops[0].id).toBe(FLOOR1_ROOM_ID);
  });
});

// ---------------------------------------------------------------------------
// Helper: collect all objects from the scene into a flat array
// ---------------------------------------------------------------------------
function collectAll(scene) {
  const all = [];
  scene.traverse((obj) => all.push(obj));
  return all;
}

// ---------------------------------------------------------------------------
// 1. buildExportScene() — structural tests
// ---------------------------------------------------------------------------
describe('buildExportScene()', () => {
  let scene, allObjects;

  beforeAll(() => {
    scene = buildExportScene(design);
    allObjects = collectAll(scene);
  });

  it('returns a THREE.Scene', () => {
    expect(scene).toBeInstanceOf(THREE.Scene);
  });

  it('contains no editor-only helpers (GridHelper, AxesHelper, Light, Camera)', () => {
    const forbidden = [THREE.GridHelper, THREE.AxesHelper, THREE.Light, THREE.Camera, THREE.CameraHelper];
    for (const Cls of forbidden) {
      const found = allObjects.some((o) => o instanceof Cls);
      expect(found, `${Cls.name} must not appear in export scene`).toBe(false);
    }
  });

  it('contains no selection-tint colours (#86efac, #a3e635, #22c55e)', () => {
    const selectionHexes = new Set(['86efac', 'a3e635', '22c55e']);
    let hasSelColor = false;
    scene.traverse((obj) => {
      if (obj.isMesh && obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) {
          if (m.color && selectionHexes.has(m.color.getHexString())) hasSelColor = true;
        }
      }
    });
    expect(hasSelColor, 'No selection-tint colour in export materials').toBe(false);
  });

  it('contains no collision-red emissive material (#ef4444)', () => {
    let hasRedEmissive = false;
    scene.traverse((obj) => {
      if (obj.isMesh && obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) {
          if (m.emissive && m.emissiveIntensity > 0 && m.emissive.getHexString() === 'ef4444') {
            hasRedEmissive = true;
          }
        }
      }
    });
    expect(hasRedEmissive, 'No collision-red emissive overlay in export').toBe(false);
  });

  it('has all expected entity kinds', () => {
    const kindsFound = new Set();
    scene.traverse((obj) => { if (obj.userData?.kind) kindsFound.add(obj.userData.kind); });

    const expected = [
      'floor', 'walls', 'wall', 'door', 'window',
      'rooms', 'floor-slab', 'flat-roof', 'gable-roof',
      'furniture-group', 'furniture',
      'stairs-group', 'staircase',
    ];
    for (const k of expected) {
      expect(kindsFound.has(k), `entity kind "${k}" must be present (found: ${[...kindsFound].join(', ')})`).toBe(true);
    }
  });

  it('has 2 floor groups at correct baseY elevations', () => {
    const floorGroups = allObjects.filter((o) => o.userData?.kind === 'floor');
    expect(floorGroups).toHaveLength(2);

    const gf = floorGroups.find((g) => g.userData.floorId === 'floor-0');
    const ff = floorGroups.find((g) => g.userData.floorId === 'floor-1');
    expect(gf).toBeDefined();
    expect(ff).toBeDefined();
    expect(gf.position.y).toBeCloseTo(0, 3);  // ground floor at Y=0
    expect(ff.position.y).toBeCloseTo(3, 3);  // 1st floor at Y=3
  });

  it('exports all 3 stair groups with correct stairId userData', () => {
    const stairGroups = allObjects.filter((o) => o.userData?.kind === 'staircase');
    expect(stairGroups).toHaveLength(3);
    expect(stairGroups.every((g) => typeof g.userData.stairId === 'string')).toBe(true);
    expect(stairGroups.some((g) => g.userData.stairId === 's1')).toBe(true); // straight
    expect(stairGroups.some((g) => g.userData.stairId === 's2')).toBe(true); // l_shape
    expect(stairGroups.some((g) => g.userData.stairId === 's3')).toBe(true); // u_shape
  });

  it('exports exactly 1 gable roof (topmost floor only)', () => {
    const gableRoofs = allObjects.filter((o) => o.userData?.kind === 'gable-roof');
    expect(gableRoofs).toHaveLength(1);
  });

  it('exports exactly 1 flat roof (intermediate floor ceiling preserved)', () => {
    const flatRoofs = allObjects.filter((o) => o.userData?.kind === 'flat-roof');
    expect(flatRoofs).toHaveLength(1);
  });

  it('exports door d1 with correct entityId', () => {
    const doors = allObjects.filter((o) => o.userData?.kind === 'door');
    expect(doors).toHaveLength(1);
    expect(doors[0].userData.entityId).toBe('d1');
  });

  it('exports window win1 with correct entityId', () => {
    const wins = allObjects.filter((o) => o.userData?.kind === 'window');
    expect(wins).toHaveLength(1);
    expect(wins[0].userData.entityId).toBe('win1');
  });

  it('exports all 6 furniture types', () => {
    const types = allObjects
      .filter((o) => o.userData?.kind === 'furniture')
      .map((o) => o.userData.furnitureType);
    for (const ft of ['table', 'bed', 'sofa', 'chair', 'wardrobe', 'kitchen_counter']) {
      expect(types, `furniture type "${ft}" must be exported`).toContain(ft);
    }
  });

  it('has no NaN or Infinity in mesh world positions', () => {
    const v = new THREE.Vector3();
    let bad = null;
    scene.traverse((obj) => {
      if (obj.isMesh && !bad) {
        obj.getWorldPosition(v);
        if (!isFinite(v.x) || !isFinite(v.y) || !isFinite(v.z)) {
          bad = `${obj.userData?.kind ?? 'mesh'} at (${v.x}, ${v.y}, ${v.z})`;
        }
      }
    });
    expect(bad, 'Non-finite world position found').toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 1b. Chair vertical placement — focused regression test
// ---------------------------------------------------------------------------
describe('Chair vertical placement', () => {
  it('chair group bottom is at or above Y=0 relative to its floor group', () => {
    // Build a single-floor scene with one chair.
    const singleChairDesign = {
      floors: [{
        id: 'f0',
        walls: [
          { id: 'w1', start: { x: 0, y: 0 }, end: { x: 5, y: 0 }, height: 3, thickness: 0.2 },
          { id: 'w2', start: { x: 5, y: 0 }, end: { x: 5, y: 5 }, height: 3, thickness: 0.2 },
          { id: 'w3', start: { x: 5, y: 5 }, end: { x: 0, y: 5 }, height: 3, thickness: 0.2 },
          { id: 'w4', start: { x: 0, y: 5 }, end: { x: 0, y: 0 }, height: 3, thickness: 0.2 },
        ],
        rooms: [{ id: 'w1,w2,w3,w4', roof: { enabled: false } }],
        furniture: [{ id: 'chair-test', type: 'chair', x: 2.5, y: 2.5, rotation: 0, scale: 1.0 }],
        doors: [], windows: [], stairs: [],
      }],
    };
    const scene = buildExportScene(singleChairDesign);

    // Collect world-Y of every mesh vertex that belongs to the chair group
    const v = new THREE.Vector3();
    let minWorldY = Infinity;
    let maxSeatY = -Infinity;

    scene.traverse((obj) => {
      if (obj.isMesh && obj.userData?.entityId === 'chair-test') {
        // Check the group parent's world position
        obj.getWorldPosition(v);
        if (v.y < minWorldY) minWorldY = v.y;
      }
    });

    // The chair furniture group is found via its userData
    let chairGroup = null;
    scene.traverse((o) => { if (o.userData?.entityId === 'chair-test') chairGroup = o; });
    expect(chairGroup, 'Chair group must exist in export scene').toBeDefined();

    // The chair group position.y must be 0 (sits on floor, not sunken)
    expect(chairGroup.position.y).toBeCloseTo(0, 3);

    // All child meshes of the chair group must have local Y ≥ 0
    // (no mesh center should be below the floor when combined with the group Y=0)
    chairGroup.children.forEach((child) => {
      // A cylinder at center Y=0.205 is fine; center Y would be negative if sunk.
      expect(child.position.y).toBeGreaterThanOrEqual(0);
    });
  });

  it('chair seat center Y matches spec (0.45 m = standard dining height)', () => {
    const singleChairDesign = {
      floors: [{
        id: 'f0',
        walls: [
          { id: 'w1', start: { x: 0, y: 0 }, end: { x: 5, y: 0 }, height: 3, thickness: 0.2 },
          { id: 'w2', start: { x: 5, y: 0 }, end: { x: 5, y: 5 }, height: 3, thickness: 0.2 },
          { id: 'w3', start: { x: 5, y: 5 }, end: { x: 0, y: 5 }, height: 3, thickness: 0.2 },
          { id: 'w4', start: { x: 0, y: 5 }, end: { x: 0, y: 0 }, height: 3, thickness: 0.2 },
        ],
        rooms: [{ id: 'w1,w2,w3,w4', roof: { enabled: false } }],
        furniture: [{ id: 'chair-spec', type: 'chair', x: 2, y: 2, rotation: 0, scale: 1.0 }],
        doors: [], windows: [], stairs: [],
      }],
    };
    const scene = buildExportScene(singleChairDesign);

    let chairGroup = null;
    scene.traverse((o) => { if (o.userData?.entityId === 'chair-spec') chairGroup = o; });
    expect(chairGroup).toBeDefined();

    // Find the seat mesh — it's a BoxGeometry child, Z≈0.02, width≈0.48, height≈0.08
    // Its center Y should be 0.45m (new spec) not 0.22m (old broken spec).
    const seatMesh = chairGroup.children.find(
      (c) => Math.abs(c.position.z - 0.02) < 0.01 && Math.abs(c.position.y - 0.45) < 0.01
    );
    expect(seatMesh, 'Chair seat mesh at Y=0.45 m not found — check geometry update').toBeDefined();

    // Leg meshes: 4 cylinders, each at Y=0.205 (half of 0.41 m height)
    const legMeshes = chairGroup.children.filter(
      (c) => Math.abs(c.position.y - 0.205) < 0.01
    );
    expect(legMeshes).toHaveLength(4);
  });
});



// ---------------------------------------------------------------------------
// 2. Roof visibility rules
// ---------------------------------------------------------------------------
describe('Roof visibility rules', () => {
  it('suppresses a gable roof on a non-topmost floor', () => {
    // Give floor-0 (non-topmost) a gable roof; floor-1 also has gable (topmost).
    // Only floor-1's gable should appear.
    const d2 = JSON.parse(JSON.stringify(design));
    d2.floors[0].rooms[0].roof = { enabled: true, type: 'gable', height: 1.5, color: '#555555' };
    const scene2 = buildExportScene(d2);
    const gables = [];
    scene2.traverse((o) => { if (o.userData?.kind === 'gable-roof') gables.push(o); });
    expect(gables).toHaveLength(1); // only topmost
  });

  it('keeps a flat roof on a non-topmost floor (intermediate ceiling)', () => {
    const scene2 = buildExportScene(design); // floor-0 flat (non-topmost), floor-1 gable (topmost)
    const flats = [];
    scene2.traverse((o) => { if (o.userData?.kind === 'flat-roof') flats.push(o); });
    expect(flats).toHaveLength(1);
  });

  it('exports gable roof when it IS the topmost (and only) floor', () => {
    const singleFloor = {
      floors: [{
        id: 'f0',
        walls: [
          { id: 'w1', start: { x: 0, y: 0 }, end: { x: 4, y: 0 }, height: 3, thickness: 0.2 },
          { id: 'w2', start: { x: 4, y: 0 }, end: { x: 4, y: 4 }, height: 3, thickness: 0.2 },
          { id: 'w3', start: { x: 4, y: 4 }, end: { x: 0, y: 4 }, height: 3, thickness: 0.2 },
          { id: 'w4', start: { x: 0, y: 4 }, end: { x: 0, y: 0 }, height: 3, thickness: 0.2 },
        ],
        rooms: [{ id: 'w1,w2,w3,w4', roof: { enabled: true, type: 'gable', height: 1.5, color: '#888' } }],
        doors: [], windows: [], furniture: [], stairs: [],
      }],
    };
    const s = buildExportScene(singleFloor);
    const gables = [];
    s.traverse((o) => { if (o.userData?.kind === 'gable-roof') gables.push(o); });
    expect(gables).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 3. GLTFExporter serialization
// @vitest-environment jsdom
//
// GLTFExporter v0.185 uses FileReader internally when binary=true, which is a
// browser API. We annotate these tests with jsdom so Vitest provides it.
// The tests are defined in a separate describe so the node-environment tests
// above are unaffected (Vitest applies environment annotations per-file, but
// we work around this by structuring tests so the FileReader-dependent ones
// are isolated and can be moved to a separate file if needed).
// ---------------------------------------------------------------------------
describe('GLTFExporter serialization', () => {
  // Note: this describe block runs in the same node environment as the rest of
  // this file. To get FileReader we stub it directly, which is more reliable
  // than environment annotations that need per-file scope.
  beforeAll(() => {
    // Minimal FileReader stub — GLTFExporter uses it only to convert a Blob
    // to an ArrayBuffer. We intercept readAsArrayBuffer and fire the onload
    // callback synchronously with the Blob's internal buffer.
    if (typeof globalThis.FileReader === 'undefined') {
      globalThis.FileReader = class {
        readAsArrayBuffer(blob) {
          // blob._data is set by our Blob stub below
          const buf = blob._data instanceof ArrayBuffer
            ? blob._data
            : new Uint8Array(blob._data || []).buffer;
          // Fire asynchronously (as real FileReader does)
          setTimeout(() => {
            this.result = buf;
            this.onload && this.onload({ target: this });
          }, 0);
        }
      };
    }
    if (typeof globalThis.Blob === 'undefined') {
      globalThis.Blob = class {
        constructor(parts, opts) {
          this.type = opts?.type || '';
          // Merge all parts into one Uint8Array and store as ArrayBuffer
          let total = 0;
          const arrays = parts.map((p) => {
            if (p instanceof ArrayBuffer) return new Uint8Array(p);
            if (p instanceof Uint8Array) return p;
            return new TextEncoder().encode(String(p));
          });
          arrays.forEach((a) => { total += a.byteLength; });
          const merged = new Uint8Array(total);
          let offset = 0;
          arrays.forEach((a) => { merged.set(a, offset); offset += a.byteLength; });
          this._data = merged.buffer;
        }
      };
    }
  });

  it('produces a non-empty ArrayBuffer with valid GLB header', async () => {
    const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
    const scene = buildExportScene(design);
    const exporter = new GLTFExporter();

    const result = await new Promise((resolve, reject) => {
      exporter.parse(
        scene,
        (buf) => resolve(buf),
        (err) => reject(new Error(String(err))),
        { binary: true }
      );
    });

    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(result.byteLength).toBeGreaterThan(0);

    // GLB magic: first 4 bytes = 'glTF'
    const magic = String.fromCharCode(...new Uint8Array(result, 0, 4));
    expect(magic).toBe('glTF');

    // GLB version: bytes 4-7 little-endian uint32 = 2
    const version = new DataView(result).getUint32(4, true);
    expect(version).toBe(2);
  });

  it('does not error on an empty design (no floors)', async () => {
    const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
    const emptyScene = buildExportScene({ floors: [] });
    const exporter = new GLTFExporter();
    const result = await new Promise((resolve, reject) => {
      exporter.parse(
        emptyScene,
        (buf) => resolve(buf),
        (err) => reject(new Error(String(err))),
        { binary: true }
      );
    });
    expect(result).toBeInstanceOf(ArrayBuffer);
  });
});

// ---------------------------------------------------------------------------
// 4. sanitizeFilename()
// ---------------------------------------------------------------------------
describe('sanitizeFilename()', () => {
  it('passes through letters, numbers, spaces, underscores, hyphens', () => {
    expect(sanitizeFilename('My House')).toBe('My House');
    expect(sanitizeFilename('My_House-v2')).toBe('My_House-v2');
  });

  it('strips slashes, bangs, and other special characters', () => {
    expect(sanitizeFilename('Test/Project!')).toBe('TestProject');
  });

  it('returns default for empty string', () => {
    expect(sanitizeFilename('')).toBe('Untitled Project');
  });

  it('returns default for null', () => {
    expect(sanitizeFilename(null)).toBe('Untitled Project');
  });

  it('returns default when all characters are stripped', () => {
    expect(sanitizeFilename('!!!')).toBe('Untitled Project');
  });
});

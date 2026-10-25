/**
 * Validation script for normaliseProject, designToProject, projectToDesign.
 * Run with: node --experimental-vm-modules src/utils/project.test.mjs
 * Or simply: node test_project.mjs from repo root.
 */

// We can't directly import ESM from .js in all envs, so we inline the core
// functions here for testing (since the module uses simple imports).
// This is a scratch test — not production code.

import { normaliseFloor, DEFAULT_MATERIALS } from './src/utils/floors.js';

// ---- Inline the key functions from project.js (to avoid ESM import issues) ----

const SUPPORTED_SCHEMA_VERSIONS = new Set([1]);
const CURRENT_SCHEMA_VERSION = 1;

function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `proj-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normaliseProject(raw) {
  const warnings = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Project file is not a valid JSON object.');
  }
  if (raw.schemaVersion === undefined) {
    warnings.push('Missing schemaVersion — treating as version 1.');
  } else if (!SUPPORTED_SCHEMA_VERSIONS.has(raw.schemaVersion)) {
    throw new Error(
      `Unsupported schema version: ${raw.schemaVersion}. This app supports versions: ${[...SUPPORTED_SCHEMA_VERSIONS].join(', ')}.`
    );
  }
  if (!raw.floors) {
    if (raw.walls && Array.isArray(raw.walls)) {
      warnings.push('No floors array found — migrating flat design into a single Ground Floor.');
      raw = {
        ...raw,
        floors: [{
          id: 'floor-0', label: 'Ground Floor',
          walls: raw.walls || [], doors: raw.doors || [], windows: raw.windows || [],
          rooms: raw.rooms || [],
          materials: raw.materials ? { ...DEFAULT_MATERIALS, ...raw.materials } : { ...DEFAULT_MATERIALS },
          furniture: raw.furniture || [], stairs: raw.stairs || [],
        }],
      };
    } else {
      throw new Error('Project file has no "floors" array and does not look like a legacy flat design.');
    }
  }
  if (!Array.isArray(raw.floors)) throw new Error('"floors" must be an array.');
  if (raw.floors.length === 0) throw new Error('Project must contain at least one floor.');

  const floors = raw.floors.map((floor, i) => {
    if (!floor || typeof floor !== 'object') {
      warnings.push(`Floor at index ${i} is not an object — wrapping as empty floor.`);
      return normaliseFloor({ id: `floor-recovered-${i}`, label: `Recovered Floor ${i}` });
    }
    if (!floor.id) {
      floor = { ...floor, id: `floor-${i}` };
      warnings.push(`Floor at index ${i} had no id — assigned "${floor.id}".`);
    }
    const missingArrays = [];
    if (!floor.walls) missingArrays.push('walls');
    if (!floor.doors) missingArrays.push('doors');
    if (!floor.windows) missingArrays.push('windows');
    if (!floor.rooms) missingArrays.push('rooms');
    if (!floor.furniture) missingArrays.push('furniture');
    if (!floor.stairs) missingArrays.push('stairs');
    if (missingArrays.length > 0) {
      warnings.push(`Floor "${floor.label || floor.id}": added missing arrays: ${missingArrays.join(', ')}.`);
    }
    return normaliseFloor(floor);
  });

  const now = new Date().toISOString();
  const project = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    projectId: raw.projectId || generateId(),
    projectName: raw.projectName || 'Untitled Project',
    units: raw.units || 'meters',
    floors,
    settings: raw.settings || {},
    metadata: {
      createdAt: raw.metadata?.createdAt || now,
      updatedAt: raw.metadata?.updatedAt || now,
    },
  };
  if (!raw.projectId) warnings.push('No projectId found — generated a new one.');
  return { project, warnings };
}

function designToProject(design, projectMeta) {
  const meta = projectMeta || design?._projectMeta || {};
  const now = new Date().toISOString();
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    projectId: meta.projectId || generateId(),
    projectName: meta.projectName || 'Untitled Project',
    units: meta.units || 'meters',
    floors: (design?.floors || []).map(f => ({ ...f })),
    settings: meta.settings || {},
    metadata: { createdAt: meta.createdAt || now, updatedAt: now },
  };
}

function projectToDesign(project) {
  return {
    floors: project.floors,
    _projectMeta: {
      projectId: project.projectId, projectName: project.projectName,
      units: project.units, settings: project.settings,
      createdAt: project.metadata?.createdAt, updatedAt: project.metadata?.updatedAt,
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) { passed++; console.log(`  ✅ ${msg}`); }
  else { failed++; console.error(`  ❌ FAIL: ${msg}`); }
}

function assertThrows(fn, substr, msg) {
  try { fn(); failed++; console.error(`  ❌ FAIL (no throw): ${msg}`); }
  catch (e) {
    if (e.message.includes(substr)) { passed++; console.log(`  ✅ ${msg}`); }
    else { failed++; console.error(`  ❌ FAIL (wrong error "${e.message}"): ${msg}`); }
  }
}

// ---- Test 1: Valid complete project round-trips ----
console.log('\n=== Test 1: Valid project round-trip ===');
{
  const original = {
    schemaVersion: 1,
    projectId: 'test-id-123',
    projectName: 'My House',
    units: 'meters',
    floors: [
      {
        id: 'floor-0', label: 'Ground Floor',
        walls: [{ id: 'wall-1', start: { x: 0, y: 0 }, end: { x: 5, y: 0 }, height: 3, thickness: 0.2, material: { color: '#aaa', preset: 'brick' } }],
        doors: [{ id: 'door-1', wallId: 'wall-1', position: 0.5, width: 0.9, isOpen: false }],
        windows: [{ id: 'win-1', wallId: 'wall-1', position: 0.3, width: 1.2 }],
        rooms: [{ id: 'room-1', roof: { enabled: true, type: 'flat', height: 1.5, color: '#555', preset: 'plain' }, floorColor: '#ccc' }],
        materials: { ...DEFAULT_MATERIALS, wallColor: '#fff' },
        furniture: [{ id: 'furn-1', type: 'bed', x: 2, y: 3, rotation: 45, scale: 1.1, color: '#a0522d', roomId: 'room-1' }],
        stairs: [{ id: 'stair-1', type: 'l_shape', fromFloorId: 'floor-0', toFloorId: 'floor-1', x: 1, y: 2, rotation: 90, width: 1.2, run: 3.5, landingLength: 1.0, turnDirection: 'left', stepCount: 16, color: '#888' }],
      },
      {
        id: 'floor-1', label: '1st Floor',
        walls: [], doors: [], windows: [], rooms: [],
        materials: { ...DEFAULT_MATERIALS }, furniture: [], stairs: [],
      },
    ],
    settings: { someOption: true },
    metadata: { createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-06-01T00:00:00Z' },
  };

  const { project, warnings } = normaliseProject(JSON.parse(JSON.stringify(original)));
  assert(project.schemaVersion === 1, 'schemaVersion preserved');
  assert(project.projectId === 'test-id-123', 'projectId preserved');
  assert(project.projectName === 'My House', 'projectName preserved');
  assert(project.floors.length === 2, '2 floors preserved');
  assert(project.floors[0].walls[0].id === 'wall-1', 'wall ID preserved');
  assert(project.floors[0].doors[0].wallId === 'wall-1', 'door wallId preserved');
  assert(project.floors[0].stairs[0].type === 'l_shape', 'stair type preserved');
  assert(project.floors[0].stairs[0].fromFloorId === 'floor-0', 'stair fromFloorId preserved');
  assert(project.floors[0].stairs[0].toFloorId === 'floor-1', 'stair toFloorId preserved');
  assert(project.floors[0].stairs[0].turnDirection === 'left', 'stair turnDirection preserved');
  assert(project.floors[0].stairs[0].width === 1.2, 'stair width preserved');
  assert(project.floors[0].furniture[0].rotation === 45, 'furniture rotation preserved');
  assert(project.floors[0].furniture[0].scale === 1.1, 'furniture scale preserved');
  assert(project.floors[0].rooms[0].roof.enabled === true, 'room roof preserved');
  assert(project.floors[0].rooms[0].floorColor === '#ccc', 'room floorColor preserved');
  assert(project.metadata.createdAt === '2025-01-01T00:00:00Z', 'createdAt preserved');
  assert(warnings.length === 0, 'no warnings for complete project');

  // Round-trip: designToProject → normaliseProject → projectToDesign
  const design = projectToDesign(project);
  const reProject = designToProject(design);
  const { project: reNorm } = normaliseProject(reProject);
  assert(reNorm.floors[0].stairs[0].id === 'stair-1', 'round-trip stair ID survives');
  assert(reNorm.floors[0].walls[0].material.preset === 'brick', 'round-trip wall material survives');
}

// ---- Test 2: Missing stairs array (pre-stair project) ----
console.log('\n=== Test 2: Missing stairs array ===');
{
  const old = {
    schemaVersion: 1, projectId: 'old-1', projectName: 'Old House',
    floors: [{ id: 'floor-0', label: 'Ground', walls: [], doors: [], windows: [], rooms: [], materials: { ...DEFAULT_MATERIALS }, furniture: [] }],
    settings: {}, metadata: {},
  };
  const { project, warnings } = normaliseProject(old);
  assert(Array.isArray(project.floors[0].stairs), 'stairs array added');
  assert(project.floors[0].stairs.length === 0, 'stairs array is empty');
  assert(warnings.some(w => w.includes('stairs')), 'warning about missing stairs');
}

// ---- Test 3: Missing multiple optional arrays ----
console.log('\n=== Test 3: Missing multiple optional arrays ===');
{
  const sparse = {
    schemaVersion: 1, projectId: 'sparse-1',
    floors: [{ id: 'floor-0', label: 'Sparse' }],
    settings: {}, metadata: {},
  };
  const { project, warnings } = normaliseProject(sparse);
  assert(Array.isArray(project.floors[0].walls), 'walls added');
  assert(Array.isArray(project.floors[0].doors), 'doors added');
  assert(Array.isArray(project.floors[0].windows), 'windows added');
  assert(Array.isArray(project.floors[0].rooms), 'rooms added');
  assert(Array.isArray(project.floors[0].furniture), 'furniture added');
  assert(Array.isArray(project.floors[0].stairs), 'stairs added');
  assert(project.floors[0].materials.wallColor === DEFAULT_MATERIALS.wallColor, 'default materials applied');
  assert(warnings.length > 0, 'warnings emitted for missing arrays');
}

// ---- Test 4: Malformed input — not an object ----
console.log('\n=== Test 4: Malformed input ===');
assertThrows(() => normaliseProject(null), 'not a valid JSON object', 'rejects null');
assertThrows(() => normaliseProject('string'), 'not a valid JSON object', 'rejects string');
assertThrows(() => normaliseProject([1,2,3]), 'not a valid JSON object', 'rejects array');
assertThrows(() => normaliseProject({ schemaVersion: 99 }), 'Unsupported schema version', 'rejects unknown version');
assertThrows(() => normaliseProject({ schemaVersion: 1 }), 'no "floors" array', 'rejects missing floors');
assertThrows(() => normaliseProject({ schemaVersion: 1, floors: 'not-array' }), '"floors" must be an array', 'rejects non-array floors');
assertThrows(() => normaliseProject({ schemaVersion: 1, floors: [] }), 'at least one floor', 'rejects empty floors');

// ---- Test 5: Missing schemaVersion (legacy) ----
console.log('\n=== Test 5: Missing schemaVersion ===');
{
  const legacy = { floors: [{ id: 'f0', label: 'Floor' }] };
  const { project, warnings } = normaliseProject(legacy);
  assert(project.schemaVersion === 1, 'defaulted to v1');
  assert(warnings.some(w => w.includes('schemaVersion')), 'warning about missing version');
}

// ---- Test 6: Preserves unknown/extra fields ----
console.log('\n=== Test 6: Preserves extra fields ===');
{
  const extra = {
    schemaVersion: 1, projectId: 'ex-1',
    floors: [{ id: 'f0', label: 'Extra', walls: [], doors: [], windows: [], rooms: [], materials: { ...DEFAULT_MATERIALS }, furniture: [], stairs: [], customField: 'hello' }],
    settings: {}, metadata: {},
  };
  const { project } = normaliseProject(extra);
  assert(project.floors[0].customField === 'hello', 'unknown field preserved on floor');
}

// ---- Test 7: All 3 stair types preserved ----
console.log('\n=== Test 7: All stair types ===');
{
  const proj = {
    schemaVersion: 1, projectId: 'st-1',
    floors: [{
      id: 'f0', label: 'F0',
      walls: [], doors: [], windows: [], rooms: [], materials: { ...DEFAULT_MATERIALS }, furniture: [],
      stairs: [
        { id: 's1', type: 'straight', fromFloorId: 'f0', toFloorId: 'f1', x: 1, y: 2, rotation: 0, width: 1, run: 3, stepCount: 17, color: '#aaa' },
        { id: 's2', type: 'l_shape', fromFloorId: 'f0', toFloorId: 'f1', x: 5, y: 2, rotation: 90, width: 1.2, run: 3.5, landingLength: 1.0, turnDirection: 'left', stepCount: 18, color: '#bbb' },
        { id: 's3', type: 'u_shape', fromFloorId: 'f0', toFloorId: 'f1', x: 9, y: 2, rotation: 180, width: 1.0, run: 3.0, landingLength: 1.2, turnDirection: 'right', stepCount: 20, color: '#ccc' },
      ],
    }, { id: 'f1', label: 'F1', walls: [], doors: [], windows: [], rooms: [], materials: { ...DEFAULT_MATERIALS }, furniture: [], stairs: [] }],
    settings: {}, metadata: {},
  };
  const { project } = normaliseProject(proj);
  const stairs = project.floors[0].stairs;
  assert(stairs.length === 3, '3 stairs preserved');
  assert(stairs[0].type === 'straight', 'straight preserved');
  assert(stairs[1].type === 'l_shape', 'l_shape preserved');
  assert(stairs[1].turnDirection === 'left', 'turnDirection preserved');
  assert(stairs[2].type === 'u_shape', 'u_shape preserved');
  assert(stairs[2].landingLength === 1.2, 'landingLength preserved');
  assert(stairs[0].color === '#aaa', 'stair color preserved');
}

// ---- Test 8: Floor missing ID gets assigned ----
console.log('\n=== Test 8: Floor missing ID ===');
{
  const noId = { schemaVersion: 1, floors: [{ label: 'No ID Floor', walls: [] }] };
  const { project, warnings } = normaliseProject(noId);
  assert(typeof project.floors[0].id === 'string' && project.floors[0].id.length > 0, 'ID assigned to floor');
  assert(warnings.some(w => w.includes('no id')), 'warning about missing id');
}

// ---- Summary ----
console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed} assertions.`);
if (failed > 0) process.exit(1);

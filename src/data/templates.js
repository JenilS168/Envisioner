/**
 * src/data/templates.js — Verified starter project definitions for Envisioner.
 *
 * These are FULL schemaVersion:1 project objects (same shape as saved .json files).
 * They must be loaded through normaliseProject() + projectToDesign() in App.jsx.
 *
 * Coordinate system:
 *   All wall coordinates are in METRES (world space).
 *   Canvas2D renders them as (x * SCALE, y * SCALE) where SCALE = 40 px/m.
 *   A 10m × 8m building spans x: -5..5, y: -4..4 in world space.
 *
 * Door / window openings:
 *   `position` (0–1): fraction along the wall from start to end.
 *   `width`: metres.
 *
 * Furniture:
 *   x, y: world-space metres (centre of item).
 *   rotation: degrees clockwise from up.
 *   scale: 0.8–1.5 multiplier on catalogue footprint.
 *
 * Room IDs MUST match the format produced by findClosedLoops:
 *   sorted wall IDs joined by commas, e.g. "w-s1,w-s2,w-s3,w-s4".
 *   (findClosedLoops: const loopId = [...cycleWalls].sort().join(','))
 */

// ---------------------------------------------------------------------------
// Template 1: Minimalist Studio (1BHK)
// ---------------------------------------------------------------------------
export const PROJECT_STUDIO = {
  schemaVersion: 1,
  projectId: 'tpl-studio-1bhk',
  projectName: 'Minimalist Studio (1BHK)',
  units: 'meters',
  floors: [
    {
      id: 'floor-0',
      label: 'Ground Floor',
      // 8m × 6m outer rectangle, metres world-space
      walls: [
        { id: 'w-s1', start: { x: -4, y: -3 }, end: { x:  4, y: -3 }, thickness: 0.2, height: 3.0, material: { color: '#E2E8F0', preset: 'plain' } },
        { id: 'w-s2', start: { x:  4, y: -3 }, end: { x:  4, y:  3 }, thickness: 0.2, height: 3.0, material: { color: '#E2E8F0', preset: 'plain' } },
        { id: 'w-s3', start: { x:  4, y:  3 }, end: { x: -4, y:  3 }, thickness: 0.2, height: 3.0, material: { color: '#E2E8F0', preset: 'plain' } },
        { id: 'w-s4', start: { x: -4, y:  3 }, end: { x: -4, y: -3 }, thickness: 0.2, height: 3.0, material: { color: '#E2E8F0', preset: 'plain' } },
        // Bathroom divider — 2.5m wide corner at top-right (y=3 to y=0.8, x=1.5)
        { id: 'w-s5', start: { x:  1.5, y:  3 }, end: { x:  1.5, y:  0.8 }, thickness: 0.15, height: 3.0, material: { color: '#CBD5E1', preset: 'plain' } },
        { id: 'w-s6', start: { x:  1.5, y:  0.8 }, end: { x:  4, y:  0.8 }, thickness: 0.15, height: 3.0, material: { color: '#CBD5E1', preset: 'plain' } },
      ],
      doors: [
        // Main entry on west wall (w-s4): fraction 0.75 along y: 3 → -3 → y = 3 - 0.75*6 = -1.5
        { id: 'd-s1', wallId: 'w-s4', position: 0.75, width: 0.9, height: 2.1, isOpen: false },
        // Bathroom door on interior wall (w-s5): fraction 0.5
        { id: 'd-s2', wallId: 'w-s5', position: 0.5, width: 0.8, height: 2.1, isOpen: false },
      ],
      windows: [
        { id: 'win-s1', wallId: 'w-s1', position: 0.25, width: 1.4, height: 1.0, sillHeight: 0.9 },
        { id: 'win-s2', wallId: 'w-s1', position: 0.70, width: 1.4, height: 1.0, sillHeight: 0.9 },
        { id: 'win-s3', wallId: 'w-s3', position: 0.30, width: 1.2, height: 1.0, sillHeight: 0.9 },
      ],
      // Room IDs = sorted wall IDs joined by comma (matches findClosedLoops output).
      // Single-floor studio: no ceiling slab needed (open sky). Flat roof disabled.
      rooms: [
        {
          id: 'w-s1,w-s2,w-s3,w-s4',
          roof: { enabled: false, type: 'flat', height: 0.18, color: '#334155', preset: 'plain' },
          floorColor: '#F1F5F9',
        },
        {
          // Bathroom sub-room (formed by w-s2, w-s3, w-s5, w-s6)
          id: 'w-s2,w-s3,w-s5,w-s6',
          roof: { enabled: false, type: 'flat', height: 0.18, color: '#334155', preset: 'plain' },
          floorColor: '#E2E8F0',
        },
      ],
      materials: {
        wallColor: '#E2E8F0',
        wallPreset: 'plain',
        doorFrameColor: '#475569',
        doorPanelColor: '#94A3B8',
        windowFrameColor: '#E2E8F0',
        windowGlassColor: '#BAE6FD',
        roofColor: '#334155',
        roofPreset: 'plain',
      },
      furniture: [
        // Bedroom zone (west side)
        { id: 'f-s1', type: 'bed',            x: -2.6, y: -1.7, rotation: 0,   scale: 1.0, color: '#3B82F6' },
        { id: 'f-s2', type: 'wardrobe',       x: -3.3, y:  0.8, rotation: 90,  scale: 1.0, color: '#475569' },
        // Living zone (centre)
        { id: 'f-s3', type: 'sofa',           x:  0.0, y: -2.3, rotation: 0,   scale: 1.0, color: '#64748B' },
        { id: 'f-s4', type: 'table',          x:  0.0, y: -1.1, rotation: 0,   scale: 0.8, color: '#D97706' },
        // Kitchen zone (top-left)
        { id: 'f-s5', type: 'kitchen_counter', x: -2.4, y:  2.3, rotation: 180, scale: 1.0, color: '#334155' },
        // Dining zone
        { id: 'f-s6', type: 'table',          x: -0.5, y:  1.8, rotation: 90,  scale: 1.0, color: '#B45309' },
        { id: 'f-s7', type: 'chair',          x: -0.5, y:  1.1, rotation: 0,   scale: 1.0, color: '#D97706' },
        { id: 'f-s8', type: 'chair',          x: -0.5, y:  2.5, rotation: 180, scale: 1.0, color: '#D97706' },
      ],
      stairs: [],
    },
  ],
  settings: {},
  metadata: { createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
};

// ---------------------------------------------------------------------------
// Template 2: Modernist 2-Story Villa
// ---------------------------------------------------------------------------
export const PROJECT_VILLA = {
  schemaVersion: 1,
  projectId: 'tpl-villa-2story',
  projectName: 'Modernist 2-Story Villa',
  units: 'meters',
  floors: [
    {
      id: 'floor-0',
      label: 'Ground Floor',
      // 10m × 8m perimeter
      walls: [
        { id: 'w-v1', start: { x: -5, y: -4 }, end: { x:  5, y: -4 }, thickness: 0.2, height: 3.0, material: { color: '#E8DCC8', preset: 'plain' } },
        { id: 'w-v2', start: { x:  5, y: -4 }, end: { x:  5, y:  4 }, thickness: 0.2, height: 3.0, material: { color: '#E8DCC8', preset: 'plain' } },
        { id: 'w-v3', start: { x:  5, y:  4 }, end: { x: -5, y:  4 }, thickness: 0.2, height: 3.0, material: { color: '#E8DCC8', preset: 'plain' } },
        { id: 'w-v4', start: { x: -5, y:  4 }, end: { x: -5, y: -4 }, thickness: 0.2, height: 3.0, material: { color: '#E8DCC8', preset: 'plain' } },
        // Kitchen / living partition at x=0
        { id: 'w-v5', start: { x:  0, y: -4 }, end: { x:  0, y: -0.5 }, thickness: 0.15, height: 3.0, material: { color: '#D6CAB2', preset: 'plain' } },
      ],
      doors: [
        // Front entry on west wall (w-v4): fraction 0.5 along y: 4 → -4
        { id: 'd-v1', wallId: 'w-v4', position: 0.5, width: 1.0, height: 2.1, isOpen: true  },
        // Patio glass slider on south wall (w-v3): fraction 0.3
        { id: 'd-v2', wallId: 'w-v3', position: 0.3, width: 1.2, height: 2.1, isOpen: false },
      ],
      windows: [
        { id: 'win-v1', wallId: 'w-v1', position: 0.25, width: 1.4, height: 1.1, sillHeight: 0.9 },
        { id: 'win-v2', wallId: 'w-v1', position: 0.75, width: 1.4, height: 1.1, sillHeight: 0.9 },
        { id: 'win-v3', wallId: 'w-v2', position: 0.5,  width: 1.2, height: 1.1, sillHeight: 0.9 },
      ],
      // Floor 0 has a floor above → guaranteed flat ceiling from the hasFloorAbove rule.
      // Explicitly enabled here for clarity and to set the correct color.
      rooms: [
        {
          id: 'w-v1,w-v2,w-v3,w-v4',
          roof: { enabled: true, type: 'flat', height: 0.18, color: '#8B7355', preset: 'plain' },
          floorColor: '#C8A97E',
        },
        {
          // Left sub-room (living) formed by w-v1, w-v4, w-v5 + south portion of w-v2/w-v3
          id: 'w-v1,w-v4,w-v5',
          roof: { enabled: true, type: 'flat', height: 0.18, color: '#8B7355', preset: 'plain' },
          floorColor: '#C8A97E',
        },
        {
          // Right sub-room (kitchen) formed by w-v1, w-v2, w-v5
          id: 'w-v1,w-v2,w-v5',
          roof: { enabled: true, type: 'flat', height: 0.18, color: '#8B7355', preset: 'plain' },
          floorColor: '#D4B896',
        },
      ],
      materials: {
        wallColor: '#E8DCC8',
        wallPreset: 'plain',
        doorFrameColor: '#4B2E1E',
        doorPanelColor: '#8B5A2B',
        windowFrameColor: '#EEEEEE',
        windowGlassColor: '#78C7E8',
        roofColor: '#8B7355',
        roofPreset: 'plain',
      },
      furniture: [
        // Living zone (left side)
        { id: 'f-v1', type: 'sofa',            x: -3.0, y: -2.0, rotation: 0,   scale: 1.1, color: '#475569' },
        { id: 'f-v2', type: 'table',           x: -3.0, y: -0.6, rotation: 0,   scale: 0.9, color: '#CA8A04' },
        // Kitchen (right, lower quadrant)
        { id: 'f-v3', type: 'kitchen_counter', x:  3.5, y: -3.3, rotation: 0,   scale: 1.0, color: '#9CA3AF' },
        { id: 'f-v4', type: 'kitchen_counter', x:  4.3, y: -2.3, rotation: 90,  scale: 1.0, color: '#9CA3AF' },
        // Dining table with 4 chairs
        { id: 'f-v5', type: 'table',           x:  2.2, y: -1.2, rotation: 0,   scale: 1.1, color: '#D97706' },
        { id: 'f-v6', type: 'chair',           x:  2.2, y: -1.9, rotation: 0,   scale: 1.0, color: '#B45309' },
        { id: 'f-v7', type: 'chair',           x:  2.2, y: -0.5, rotation: 180, scale: 1.0, color: '#B45309' },
        { id: 'f-v8', type: 'chair',           x:  1.3, y: -1.2, rotation: 90,  scale: 1.0, color: '#B45309' },
        { id: 'f-v9', type: 'chair',           x:  3.1, y: -1.2, rotation: 270, scale: 1.0, color: '#B45309' },
      ],
      stairs: [
        {
          id: 'stair-v1',
          type: 'l_shape',
          fromFloorId: 'floor-0',
          toFloorId: 'floor-1',
          x: 3.2,
          y: 2.2,
          rotation: 180,
          width: 1.0,
          run: 2.8,
          landingLength: 1.0,
          turnDirection: 'left',
          stepCount: 16,
          color: '#78350F',
        },
      ],
    },
    {
      id: 'floor-1',
      label: '1st Floor',
      // Upper suite: slightly inset west wall, angled NE corner
      walls: [
        { id: 'w-v21', start: { x: -5, y: -4 }, end: { x:  3, y: -4 }, thickness: 0.2, height: 3.0, material: { color: '#E8DCC8', preset: 'plain' } },
        { id: 'w-v22', start: { x:  3, y: -4 }, end: { x:  5, y: -2 }, thickness: 0.2, height: 3.0, material: { color: '#E8DCC8', preset: 'plain' } },
        { id: 'w-v23', start: { x:  5, y: -2 }, end: { x:  5, y:  4 }, thickness: 0.2, height: 3.0, material: { color: '#E8DCC8', preset: 'plain' } },
        { id: 'w-v24', start: { x:  5, y:  4 }, end: { x: -5, y:  4 }, thickness: 0.2, height: 3.0, material: { color: '#E8DCC8', preset: 'plain' } },
        { id: 'w-v25', start: { x: -5, y:  4 }, end: { x: -5, y: -4 }, thickness: 0.2, height: 3.0, material: { color: '#E8DCC8', preset: 'plain' } },
        // Master bedroom divider
        { id: 'w-v26', start: { x:  0, y: -4 }, end: { x:  0, y:  1.5 }, thickness: 0.15, height: 3.0, material: { color: '#D6CAB2', preset: 'plain' } },
      ],
      doors: [
        { id: 'd-v21', wallId: 'w-v26', position: 0.6, width: 0.9, height: 2.1, isOpen: false },
        { id: 'd-v22', wallId: 'w-v25', position: 0.5, width: 0.9, height: 2.1, isOpen: false },
      ],
      windows: [
        { id: 'win-v21', wallId: 'w-v21', position: 0.35, width: 1.4, height: 1.1, sillHeight: 0.9 },
        { id: 'win-v22', wallId: 'w-v23', position: 0.5,  width: 1.2, height: 1.1, sillHeight: 0.9 },
        { id: 'win-v23', wallId: 'w-v24', position: 0.5,  width: 1.4, height: 1.1, sillHeight: 0.9 },
      ],
      // Top floor → gable roof on outer envelope.
      rooms: [
        {
          id: 'w-v21,w-v22,w-v23,w-v24,w-v25',
          roof: { enabled: true, type: 'gable', height: 2.5, color: '#1E293B', preset: 'plain' },
          floorColor: '#C8A97E',
        },
        {
          // Left bedroom sub-room
          id: 'w-v21,w-v25,w-v26',
          roof: { enabled: true, type: 'flat', height: 0.18, color: '#1E293B', preset: 'plain' },
          floorColor: '#C8A97E',
        },
        {
          // Right bedroom/study sub-room
          id: 'w-v21,w-v22,w-v23,w-v26',
          roof: { enabled: true, type: 'flat', height: 0.18, color: '#1E293B', preset: 'plain' },
          floorColor: '#C8A97E',
        },
      ],
      materials: {
        wallColor: '#E8DCC8',
        wallPreset: 'plain',
        doorFrameColor: '#4B2E1E',
        doorPanelColor: '#8B5A2B',
        windowFrameColor: '#EEEEEE',
        windowGlassColor: '#78C7E8',
        roofColor: '#1E293B',
        roofPreset: 'plain',
      },
      furniture: [
        { id: 'f-v21', type: 'bed',      x: -3.0, y: -1.5, rotation: 0,   scale: 1.1, color: '#1E293B' },
        { id: 'f-v22', type: 'wardrobe', x: -4.3, y:  1.8, rotation: 90,  scale: 1.0, color: '#334155' },
        { id: 'f-v23', type: 'bed',      x:  2.6, y: -2.0, rotation: 0,   scale: 1.0, color: '#78350F' },
        { id: 'f-v24', type: 'table',    x: -2.8, y:  2.5, rotation: 0,   scale: 0.8, color: '#CA8A04' },
        { id: 'f-v25', type: 'chair',    x: -2.8, y:  1.8, rotation: 0,   scale: 1.0, color: '#92400E' },
      ],
      stairs: [],
    },
  ],
  settings: {},
  metadata: { createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
};

// ---------------------------------------------------------------------------
// Template 3: Multi-level Penthouse with Stairs
// ---------------------------------------------------------------------------
export const PROJECT_PENTHOUSE = {
  schemaVersion: 1,
  projectId: 'tpl-penthouse-3lvl',
  projectName: 'Multi-level Penthouse with Stairs',
  units: 'meters',
  floors: [
    {
      id: 'floor-0',
      label: 'Ground Floor · Lobby',
      // 9m × 7m
      walls: [
        { id: 'pw-1', start: { x: -4.5, y: -3.5 }, end: { x:  4.5, y: -3.5 }, thickness: 0.2, height: 3.0, material: { color: '#E2E8F0', preset: 'plain' } },
        { id: 'pw-2', start: { x:  4.5, y: -3.5 }, end: { x:  4.5, y:  3.5 }, thickness: 0.2, height: 3.0, material: { color: '#E2E8F0', preset: 'plain' } },
        { id: 'pw-3', start: { x:  4.5, y:  3.5 }, end: { x: -4.5, y:  3.5 }, thickness: 0.2, height: 3.0, material: { color: '#E2E8F0', preset: 'plain' } },
        { id: 'pw-4', start: { x: -4.5, y:  3.5 }, end: { x: -4.5, y: -3.5 }, thickness: 0.2, height: 3.0, material: { color: '#E2E8F0', preset: 'plain' } },
      ],
      doors: [
        { id: 'pd-1', wallId: 'pw-4', position: 0.5, width: 1.0, height: 2.1, isOpen: false },
      ],
      windows: [
        { id: 'pwin-1', wallId: 'pw-1', position: 0.3,  width: 1.5, height: 1.2, sillHeight: 0.9 },
        { id: 'pwin-2', wallId: 'pw-1', position: 0.75, width: 1.5, height: 1.2, sillHeight: 0.9 },
        { id: 'pwin-3', wallId: 'pw-3', position: 0.5,  width: 1.8, height: 1.2, sillHeight: 0.9 },
      ],
      // Floor 0 has a floor above → enabled flat ceiling
      rooms: [
        {
          id: 'pw-1,pw-2,pw-3,pw-4',
          roof: { enabled: true, type: 'flat', height: 0.18, color: '#334155', preset: 'plain' },
          floorColor: '#CBD5E1',
        },
      ],
      materials: {
        wallColor: '#E2E8F0',
        wallPreset: 'plain',
        doorFrameColor: '#1E293B',
        doorPanelColor: '#334155',
        windowFrameColor: '#0F172A',
        windowGlassColor: '#38BDF8',
        roofColor: '#334155',
        roofPreset: 'plain',
      },
      furniture: [
        { id: 'pf-1', type: 'sofa',  x:  0.0, y: -2.0, rotation: 0,   scale: 1.0, color: '#475569' },
        { id: 'pf-2', type: 'table', x:  0.0, y: -0.8, rotation: 0,   scale: 0.9, color: '#1E293B' },
        { id: 'pf-3', type: 'chair', x: -0.8, y: -0.8, rotation: 90,  scale: 1.0, color: '#14B8A6' },
        { id: 'pf-4', type: 'chair', x:  0.8, y: -0.8, rotation: 270, scale: 1.0, color: '#14B8A6' },
      ],
      stairs: [
        {
          id: 'pstair-1',
          type: 'u_shape',
          fromFloorId: 'floor-0',
          toFloorId: 'floor-1',
          x: 3.0,
          y: 1.8,
          rotation: 0,
          width: 1.0,
          run: 2.6,
          landingLength: 1.0,
          turnDirection: 'left',
          stepCount: 16,
          color: '#334155',
        },
      ],
    },
    {
      id: 'floor-1',
      label: '1st Floor · Executive Suite',
      walls: [
        { id: 'pw-m1', start: { x: -4.5, y: -3.5 }, end: { x:  4.5, y: -3.5 }, thickness: 0.2, height: 3.0, material: { color: '#E2E8F0', preset: 'plain' } },
        { id: 'pw-m2', start: { x:  4.5, y: -3.5 }, end: { x:  4.5, y:  3.5 }, thickness: 0.2, height: 3.0, material: { color: '#E2E8F0', preset: 'plain' } },
        { id: 'pw-m3', start: { x:  4.5, y:  3.5 }, end: { x: -4.5, y:  3.5 }, thickness: 0.2, height: 3.0, material: { color: '#E2E8F0', preset: 'plain' } },
        { id: 'pw-m4', start: { x: -4.5, y:  3.5 }, end: { x: -4.5, y: -3.5 }, thickness: 0.2, height: 3.0, material: { color: '#E2E8F0', preset: 'plain' } },
        // En-suite bathroom
        { id: 'pw-m5', start: { x:  1.5, y:  3.5 }, end: { x:  1.5, y:  1.5 }, thickness: 0.15, height: 3.0, material: { color: '#CBD5E1', preset: 'plain' } },
        { id: 'pw-m6', start: { x:  1.5, y:  1.5 }, end: { x:  4.5, y:  1.5 }, thickness: 0.15, height: 3.0, material: { color: '#CBD5E1', preset: 'plain' } },
      ],
      doors: [
        { id: 'pd-m1', wallId: 'pw-m4', position: 0.35, width: 0.9, height: 2.1, isOpen: false },
        { id: 'pd-m2', wallId: 'pw-m5', position: 0.5,  width: 0.8, height: 2.1, isOpen: false },
      ],
      windows: [
        { id: 'pwin-m1', wallId: 'pw-m1', position: 0.5,  width: 1.6, height: 1.2, sillHeight: 0.9 },
        { id: 'pwin-m2', wallId: 'pw-m2', position: 0.35, width: 1.4, height: 1.2, sillHeight: 0.9 },
      ],
      // Floor 1 also has a floor above → enabled flat ceiling
      rooms: [
        {
          id: 'pw-m1,pw-m2,pw-m3,pw-m4',
          roof: { enabled: true, type: 'flat', height: 0.18, color: '#334155', preset: 'plain' },
          floorColor: '#CBD5E1',
        },
        {
          // Bathroom sub-room
          id: 'pw-m2,pw-m3,pw-m5,pw-m6',
          roof: { enabled: true, type: 'flat', height: 0.18, color: '#334155', preset: 'plain' },
          floorColor: '#E2E8F0',
        },
      ],
      materials: {
        wallColor: '#E2E8F0',
        wallPreset: 'plain',
        doorFrameColor: '#1E293B',
        doorPanelColor: '#334155',
        windowFrameColor: '#0F172A',
        windowGlassColor: '#38BDF8',
        roofColor: '#334155',
        roofPreset: 'plain',
      },
      furniture: [
        { id: 'pf-m1', type: 'bed',      x: -2.5, y: -1.8, rotation: 0,   scale: 1.1, color: '#334155' },
        { id: 'pf-m2', type: 'wardrobe', x: -4.0, y:  1.0, rotation: 90,  scale: 1.0, color: '#1E293B' },
        { id: 'pf-m3', type: 'table',    x: -2.5, y:  1.5, rotation: 0,   scale: 0.8, color: '#CA8A04' },
        { id: 'pf-m4', type: 'chair',    x: -2.5, y:  0.8, rotation: 0,   scale: 1.0, color: '#14B8A6' },
      ],
      stairs: [
        {
          id: 'pstair-2',
          type: 'u_shape',
          fromFloorId: 'floor-1',
          toFloorId: 'floor-2',
          x: 3.0,
          y: 1.8,
          rotation: 0,
          width: 1.0,
          run: 2.6,
          landingLength: 1.0,
          turnDirection: 'left',
          stepCount: 16,
          color: '#14B8A6',
        },
      ],
    },
    {
      id: 'floor-2',
      label: 'Rooftop Terrace',
      // 6m × 5m open terrace with low parapets (no ceiling — open sky)
      walls: [
        { id: 'pw-t1', start: { x: -3, y: -2.5 }, end: { x:  3, y: -2.5 }, thickness: 0.2, height: 1.1, material: { color: '#E2E8F0', preset: 'plain' } },
        { id: 'pw-t2', start: { x:  3, y: -2.5 }, end: { x:  3, y:  2.5 }, thickness: 0.2, height: 1.1, material: { color: '#E2E8F0', preset: 'plain' } },
        { id: 'pw-t3', start: { x:  3, y:  2.5 }, end: { x: -3, y:  2.5 }, thickness: 0.2, height: 1.1, material: { color: '#E2E8F0', preset: 'plain' } },
        { id: 'pw-t4', start: { x: -3, y:  2.5 }, end: { x: -3, y: -2.5 }, thickness: 0.2, height: 1.1, material: { color: '#E2E8F0', preset: 'plain' } },
      ],
      doors: [],
      windows: [],
      // Top-most floor: open terrace, no ceiling slab
      rooms: [
        {
          id: 'pw-t1,pw-t2,pw-t3,pw-t4',
          roof: { enabled: false, type: 'flat', height: 0.18, color: '#14B8A6', preset: 'plain' },
          floorColor: '#94A3B8',
        },
      ],
      materials: {
        wallColor: '#E2E8F0',
        wallPreset: 'plain',
        doorFrameColor: '#1E293B',
        doorPanelColor: '#334155',
        windowFrameColor: '#0F172A',
        windowGlassColor: '#38BDF8',
        roofColor: '#14B8A6',
        roofPreset: 'plain',
      },
      furniture: [
        // Outdoor seating cluster
        { id: 'pf-t1', type: 'table', x:  0.0, y:  0.0, rotation: 0,   scale: 1.0, color: '#0F172A' },
        { id: 'pf-t2', type: 'chair', x:  0.0, y: -0.8, rotation: 180, scale: 1.0, color: '#14B8A6' },
        { id: 'pf-t3', type: 'chair', x:  0.0, y:  0.8, rotation: 0,   scale: 1.0, color: '#14B8A6' },
        { id: 'pf-t4', type: 'chair', x: -0.8, y:  0.0, rotation: 90,  scale: 1.0, color: '#14B8A6' },
        { id: 'pf-t5', type: 'chair', x:  0.8, y:  0.0, rotation: 270, scale: 1.0, color: '#14B8A6' },
        { id: 'pf-t6', type: 'sofa',  x: -1.8, y:  1.8, rotation: 45,  scale: 1.0, color: '#475569' },
      ],
      stairs: [],
    },
  ],
  settings: {},
  metadata: { createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
};

// ---------------------------------------------------------------------------
// Catalog: UI metadata + design reference used by LandingPage and App
// ---------------------------------------------------------------------------
export const TEMPLATE_CATALOG = [
  {
    id: 'minimalist-studio',
    title: 'Minimalist Studio (1BHK)',
    description: 'Single-story open-concept living with integrated bedroom, kitchen, dining, and bathroom.',
    icon: '🏠',
    floors: 1,
    stairType: null,
    roofType: 'Flat',
    areaSqm: 48,
    project: PROJECT_STUDIO,
    activeFloorId: 'floor-0',
  },
  {
    id: 'modernist-villa',
    title: 'Modernist 2-Story Villa',
    description: 'Two-story villa with L-shaped staircase, open-plan living, upper terrace, and pitched gable roof.',
    icon: '🏡',
    floors: 2,
    stairType: 'L-Shape',
    roofType: 'Gable',
    areaSqm: 160,
    project: PROJECT_VILLA,
    activeFloorId: 'floor-0',
  },
  {
    id: 'multi-level-penthouse',
    title: 'Multi-level Penthouse with Stairs',
    description: 'Three-story luxury penthouse with stacked U-shaped stairs, dual suites, and open rooftop terrace.',
    icon: '🏢',
    floors: 3,
    stairType: 'U-Shape',
    roofType: 'Open Terrace',
    areaSqm: 220,
    project: PROJECT_PENTHOUSE,
    activeFloorId: 'floor-0',
  },
];

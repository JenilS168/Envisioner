/**
 * templates.js — Pre-built starter designs for the landing page.
 * Each entry is a valid `design` object (same shape as App state) that can
 * be passed directly to `reset()` in useHistory.
 */

// ---------------------------------------------------------------------------
// Empty Canvas — single ground floor, no content
// ---------------------------------------------------------------------------
export const TEMPLATE_EMPTY = {
  floors: [
    {
      id: 'floor-0',
      label: 'Ground Floor',
      walls: [],
      doors: [],
      windows: [],
      rooms: [],
      materials: {
        wallColor: '#d6c2a1',
        wallPreset: 'plain',
        doorFrameColor: '#4b2e1e',
        doorPanelColor: '#8b5a2b',
        windowFrameColor: '#eeeeee',
        windowGlassColor: '#78c7e8',
        roofColor: '#555555',
        roofPreset: 'plain',
      },
      furniture: [],
      stairs: [],
    },
  ],
};

// ---------------------------------------------------------------------------
// Studio Apartment — single floor, one room with doors/windows/furniture
// ---------------------------------------------------------------------------
export const TEMPLATE_STUDIO = {
  floors: [
    {
      id: 'studio-floor-0',
      label: 'Ground Floor',
      walls: [
        { id: 'sw-1', start: { x: 50, y: 50  }, end: { x: 350, y: 50  }, thickness: 0.25, height: 3, material: { color: '#d6c2a1', preset: 'plain' } },
        { id: 'sw-2', start: { x: 350, y: 50  }, end: { x: 350, y: 280 }, thickness: 0.25, height: 3, material: { color: '#d6c2a1', preset: 'plain' } },
        { id: 'sw-3', start: { x: 350, y: 280 }, end: { x: 50,  y: 280 }, thickness: 0.25, height: 3, material: { color: '#d6c2a1', preset: 'plain' } },
        { id: 'sw-4', start: { x: 50,  y: 280 }, end: { x: 50,  y: 50  }, thickness: 0.25, height: 3, material: { color: '#d6c2a1', preset: 'plain' } },
      ],
      doors: [
        { id: 'sd-1', wallId: 'sw-4', offset: 0.35, width: 0.9, height: 2.1, isOpen: false },
      ],
      windows: [
        { id: 'swin-1', wallId: 'sw-1', offset: 0.3, width: 1.2, height: 1.0 },
        { id: 'swin-2', wallId: 'sw-2', offset: 0.4, width: 1.0, height: 1.0 },
      ],
      rooms: [
        {
          id: 'room-sw-1-sw-2-sw-3-sw-4',
          roof: { enabled: false, type: 'flat', height: 1.5, color: '#555555', preset: 'plain' },
          floorColor: '#c8a97e',
        },
      ],
      materials: {
        wallColor: '#d6c2a1',
        wallPreset: 'plain',
        doorFrameColor: '#4b2e1e',
        doorPanelColor: '#8b5a2b',
        windowFrameColor: '#eeeeee',
        windowGlassColor: '#78c7e8',
        roofColor: '#555555',
        roofPreset: 'plain',
      },
      furniture: [
        { id: 'sf-1', type: 'bed',     roomId: 'room-sw-1-sw-2-sw-3-sw-4', x: 280, y: 90,  rotation: 0,   scale: 1.0, color: '#a0522d' },
        { id: 'sf-2', type: 'sofa',    roomId: 'room-sw-1-sw-2-sw-3-sw-4', x: 150, y: 200, rotation: 180, scale: 1.0, color: '#6b7280' },
        { id: 'sf-3', type: 'table',   roomId: 'room-sw-1-sw-2-sw-3-sw-4', x: 150, y: 150, rotation: 0,   scale: 1.0, color: '#d97706' },
        { id: 'sf-4', type: 'wardrobe',roomId: 'room-sw-1-sw-2-sw-3-sw-4', x: 90,  y: 90,  rotation: 90,  scale: 1.0, color: '#374151' },
      ],
      stairs: [],
    },
  ],
};

// ---------------------------------------------------------------------------
// Modern 2-Story Villa — two floors, walls, stairs, gable roof on top floor
// ---------------------------------------------------------------------------
const VILLA_ROOM_ID = 'room-vw-1-vw-2-vw-3-vw-4';
const VILLA_UPPER_ROOM_ID = 'room-vw-u1-vw-u2-vw-u3-vw-u4';

export const TEMPLATE_VILLA = {
  floors: [
    {
      id: 'villa-floor-0',
      label: 'Ground Floor',
      walls: [
        { id: 'vw-1', start: { x: 50, y: 50  }, end: { x: 400, y: 50  }, thickness: 0.25, height: 3, material: { color: '#e8dcc8', preset: 'plain' } },
        { id: 'vw-2', start: { x: 400, y: 50  }, end: { x: 400, y: 320 }, thickness: 0.25, height: 3, material: { color: '#e8dcc8', preset: 'plain' } },
        { id: 'vw-3', start: { x: 400, y: 320 }, end: { x: 50,  y: 320 }, thickness: 0.25, height: 3, material: { color: '#e8dcc8', preset: 'plain' } },
        { id: 'vw-4', start: { x: 50,  y: 320 }, end: { x: 50,  y: 50  }, thickness: 0.25, height: 3, material: { color: '#e8dcc8', preset: 'plain' } },
        // Interior divider — kitchen / living
        { id: 'vw-5', start: { x: 200, y: 50  }, end: { x: 200, y: 200 }, thickness: 0.15, height: 3, material: { color: '#e8dcc8', preset: 'plain' } },
      ],
      doors: [
        { id: 'vd-1', wallId: 'vw-4', offset: 0.4,  width: 1.0, height: 2.1, isOpen: true  },
        { id: 'vd-2', wallId: 'vw-5', offset: 0.55, width: 0.9, height: 2.1, isOpen: false },
      ],
      windows: [
        { id: 'vwin-1', wallId: 'vw-1', offset: 0.25, width: 1.4, height: 1.1 },
        { id: 'vwin-2', wallId: 'vw-1', offset: 0.65, width: 1.4, height: 1.1 },
        { id: 'vwin-3', wallId: 'vw-2', offset: 0.5,  width: 1.2, height: 1.1 },
        { id: 'vwin-4', wallId: 'vw-3', offset: 0.5,  width: 1.6, height: 1.1 },
      ],
      rooms: [
        { id: VILLA_ROOM_ID, roof: { enabled: false, type: 'flat', height: 1.5, color: '#8b7355', preset: 'plain' }, floorColor: '#c8a97e' },
      ],
      materials: {
        wallColor: '#e8dcc8',
        wallPreset: 'plain',
        doorFrameColor: '#4b2e1e',
        doorPanelColor: '#8b5a2b',
        windowFrameColor: '#eeeeee',
        windowGlassColor: '#78c7e8',
        roofColor: '#8b7355',
        roofPreset: 'plain',
      },
      furniture: [
        { id: 'vf-1', type: 'sofa',           roomId: VILLA_ROOM_ID, x: 310, y: 130, rotation: 270, scale: 1.0, color: '#6b7280' },
        { id: 'vf-2', type: 'table',           roomId: VILLA_ROOM_ID, x: 310, y: 220, rotation: 0,   scale: 1.0, color: '#d97706' },
        { id: 'vf-3', type: 'chair',           roomId: VILLA_ROOM_ID, x: 355, y: 220, rotation: 270, scale: 1.0, color: '#b45309' },
        { id: 'vf-4', type: 'kitchen_counter', roomId: VILLA_ROOM_ID, x: 110, y: 80,  rotation: 0,   scale: 1.0, color: '#9ca3af' },
      ],
      stairs: [
        {
          id: 'vstair-1',
          type: 'straight',
          x: 330, y: 270,
          rotation: 0,
          width: 1.2,
          run: 3.0,
          landingLength: 1.0,
          fromFloorId: 'villa-floor-0',
          toFloorId: 'villa-floor-1',
          color: '#a08060',
          turn: 'left',
        },
      ],
    },
    {
      id: 'villa-floor-1',
      label: '1st Floor',
      walls: [
        { id: 'vw-u1', start: { x: 80, y: 80  }, end: { x: 370, y: 80  }, thickness: 0.25, height: 3, material: { color: '#e8dcc8', preset: 'plain' } },
        { id: 'vw-u2', start: { x: 370, y: 80  }, end: { x: 370, y: 290 }, thickness: 0.25, height: 3, material: { color: '#e8dcc8', preset: 'plain' } },
        { id: 'vw-u3', start: { x: 370, y: 290 }, end: { x: 80,  y: 290 }, thickness: 0.25, height: 3, material: { color: '#e8dcc8', preset: 'plain' } },
        { id: 'vw-u4', start: { x: 80,  y: 290 }, end: { x: 80,  y: 80  }, thickness: 0.25, height: 3, material: { color: '#e8dcc8', preset: 'plain' } },
        // Master bedroom divider
        { id: 'vw-u5', start: { x: 80,  y: 185 }, end: { x: 240, y: 185 }, thickness: 0.15, height: 3, material: { color: '#e8dcc8', preset: 'plain' } },
      ],
      doors: [
        { id: 'vd-u1', wallId: 'vw-u5', offset: 0.55, width: 0.9, height: 2.1, isOpen: false },
        { id: 'vd-u2', wallId: 'vw-u4', offset: 0.5,  width: 0.9, height: 2.1, isOpen: false },
      ],
      windows: [
        { id: 'vwin-u1', wallId: 'vw-u1', offset: 0.5,  width: 1.4, height: 1.1 },
        { id: 'vwin-u2', wallId: 'vw-u2', offset: 0.5,  width: 1.2, height: 1.1 },
        { id: 'vwin-u3', wallId: 'vw-u3', offset: 0.5,  width: 1.4, height: 1.1 },
      ],
      rooms: [
        { id: VILLA_UPPER_ROOM_ID, roof: { enabled: true, type: 'gable', height: 2.5, color: '#8b7355', preset: 'plain' }, floorColor: '#c8a97e' },
      ],
      materials: {
        wallColor: '#e8dcc8',
        wallPreset: 'plain',
        doorFrameColor: '#4b2e1e',
        doorPanelColor: '#8b5a2b',
        windowFrameColor: '#eeeeee',
        windowGlassColor: '#78c7e8',
        roofColor: '#8b7355',
        roofPreset: 'plain',
      },
      furniture: [
        { id: 'vf-u1', type: 'bed',      roomId: VILLA_UPPER_ROOM_ID, x: 300, y: 120, rotation: 90, scale: 1.0, color: '#a0522d' },
        { id: 'vf-u2', type: 'wardrobe', roomId: VILLA_UPPER_ROOM_ID, x: 140, y: 110, rotation: 90, scale: 1.0, color: '#374151' },
      ],
      stairs: [],
    },
  ],
};

// ---------------------------------------------------------------------------
// Multi-level Penthouse with Stairs — 3 floors with connecting stairs
// ---------------------------------------------------------------------------
const PENT_ROOM_0 = 'room-pw-1-pw-2-pw-3-pw-4';
const PENT_ROOM_1 = 'room-pw-m1-pw-m2-pw-m3-pw-m4';
const PENT_ROOM_2 = 'room-pw-t1-pw-t2-pw-t3-pw-t4';

export const TEMPLATE_PENTHOUSE = {
  floors: [
    {
      id: 'pent-floor-0',
      label: 'Level 1 · Lounge',
      walls: [
        { id: 'pw-1', start: { x: 60, y: 60  }, end: { x: 380, y: 60  }, thickness: 0.25, height: 3, material: { color: '#E2E8F0', preset: 'plain' } },
        { id: 'pw-2', start: { x: 380, y: 60  }, end: { x: 380, y: 300 }, thickness: 0.25, height: 3, material: { color: '#E2E8F0', preset: 'plain' } },
        { id: 'pw-3', start: { x: 380, y: 300 }, end: { x: 60,  y: 300 }, thickness: 0.25, height: 3, material: { color: '#E2E8F0', preset: 'plain' } },
        { id: 'pw-4', start: { x: 60,  y: 300 }, end: { x: 60,  y: 60  }, thickness: 0.25, height: 3, material: { color: '#E2E8F0', preset: 'plain' } },
      ],
      doors: [
        { id: 'pd-1', wallId: 'pw-4', offset: 0.5, width: 1.0, height: 2.1, isOpen: false },
      ],
      windows: [
        { id: 'pwin-1', wallId: 'pw-1', offset: 0.35, width: 1.5, height: 1.2 },
        { id: 'pwin-2', wallId: 'pw-1', offset: 0.75, width: 1.5, height: 1.2 },
        { id: 'pwin-3', wallId: 'pw-3', offset: 0.5,  width: 1.8, height: 1.2 },
      ],
      rooms: [
        { id: PENT_ROOM_0, roof: { enabled: false, type: 'flat', height: 1.5, color: '#334155', preset: 'plain' }, floorColor: '#CBD5E1' },
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
        { id: 'pf-1', type: 'sofa',  roomId: PENT_ROOM_0, x: 260, y: 150, rotation: 180, scale: 1.0, color: '#475569' },
        { id: 'pf-2', type: 'table', roomId: PENT_ROOM_0, x: 260, y: 220, rotation: 0,   scale: 1.0, color: '#1E293B' },
      ],
      stairs: [
        {
          id: 'pstair-1',
          type: 'straight',
          x: 120, y: 250,
          rotation: 0,
          width: 1.1,
          run: 3.0,
          landingLength: 1.0,
          color: '#334155',
          turnDirection: 'right',
        },
      ],
    },
    {
      id: 'pent-floor-1',
      label: 'Level 2 · Suite',
      walls: [
        { id: 'pw-m1', start: { x: 60, y: 60  }, end: { x: 380, y: 60  }, thickness: 0.25, height: 3, material: { color: '#E2E8F0', preset: 'plain' } },
        { id: 'pw-m2', start: { x: 380, y: 60  }, end: { x: 380, y: 300 }, thickness: 0.25, height: 3, material: { color: '#E2E8F0', preset: 'plain' } },
        { id: 'pw-m3', start: { x: 380, y: 300 }, end: { x: 60,  y: 300 }, thickness: 0.25, height: 3, material: { color: '#E2E8F0', preset: 'plain' } },
        { id: 'pw-m4', start: { x: 60,  y: 300 }, end: { x: 60,  y: 60  }, thickness: 0.25, height: 3, material: { color: '#E2E8F0', preset: 'plain' } },
      ],
      doors: [
        { id: 'pd-m1', wallId: 'pw-m4', offset: 0.35, width: 0.9, height: 2.1, isOpen: false },
      ],
      windows: [
        { id: 'pwin-m1', wallId: 'pw-m1', offset: 0.5, width: 1.6, height: 1.2 },
        { id: 'pwin-m2', wallId: 'pw-m2', offset: 0.5, width: 1.4, height: 1.2 },
      ],
      rooms: [
        { id: PENT_ROOM_1, roof: { enabled: false, type: 'flat', height: 1.5, color: '#334155', preset: 'plain' }, floorColor: '#CBD5E1' },
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
        { id: 'pf-m1', type: 'bed',      roomId: PENT_ROOM_1, x: 270, y: 130, rotation: 90, scale: 1.0, color: '#334155' },
        { id: 'pf-m2', type: 'wardrobe', roomId: PENT_ROOM_1, x: 330, y: 240, rotation: 180, scale: 1.0, color: '#1E293B' },
      ],
      stairs: [
        {
          id: 'pstair-2',
          type: 'straight',
          x: 120, y: 110,
          rotation: 180,
          width: 1.1,
          run: 3.0,
          landingLength: 1.0,
          color: '#334155',
          turnDirection: 'left',
        },
      ],
    },
    {
      id: 'pent-floor-2',
      label: 'Level 3 · Sky Terrace',
      walls: [
        { id: 'pw-t1', start: { x: 60, y: 60  }, end: { x: 380, y: 60  }, thickness: 0.25, height: 3, material: { color: '#E2E8F0', preset: 'plain' } },
        { id: 'pw-t2', start: { x: 380, y: 60  }, end: { x: 380, y: 300 }, thickness: 0.25, height: 3, material: { color: '#E2E8F0', preset: 'plain' } },
        { id: 'pw-t3', start: { x: 380, y: 300 }, end: { x: 60,  y: 300 }, thickness: 0.25, height: 3, material: { color: '#E2E8F0', preset: 'plain' } },
        { id: 'pw-t4', start: { x: 60,  y: 300 }, end: { x: 60,  y: 60  }, thickness: 0.25, height: 3, material: { color: '#E2E8F0', preset: 'plain' } },
      ],
      doors: [
        { id: 'pd-t1', wallId: 'pw-t4', offset: 0.5, width: 1.0, height: 2.1, isOpen: false },
      ],
      windows: [
        { id: 'pwin-t1', wallId: 'pw-t1', offset: 0.5, width: 2.0, height: 1.4 },
        { id: 'pwin-t2', wallId: 'pw-t3', offset: 0.5, width: 2.0, height: 1.4 },
      ],
      rooms: [
        { id: PENT_ROOM_2, roof: { enabled: true, type: 'gable', height: 2.2, color: '#14B8A6', preset: 'plain' }, floorColor: '#94A3B8' },
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
        { id: 'pf-t1', type: 'table', roomId: PENT_ROOM_2, x: 240, y: 170, rotation: 0, scale: 1.1, color: '#0F172A' },
        { id: 'pf-t2', type: 'chair', roomId: PENT_ROOM_2, x: 240, y: 120, rotation: 180, scale: 1.0, color: '#14B8A6' },
        { id: 'pf-t3', type: 'chair', roomId: PENT_ROOM_2, x: 240, y: 220, rotation: 0, scale: 1.0, color: '#14B8A6' },
      ],
      stairs: [],
    },
  ],
};

// ---------------------------------------------------------------------------
// Catalog entry for UI rendering
// ---------------------------------------------------------------------------
export const STARTER_TEMPLATES = [
  {
    id: 'studio',
    title: 'Minimalist Studio (1BHK)',
    description: 'Crisp open-concept architectural layout with integrated furniture and natural lighting.',
    icon: '🏠',
    floors: 1,
    design: TEMPLATE_STUDIO,
    activeFloorId: 'studio-floor-0',
  },
  {
    id: 'villa',
    title: 'Modernist 2-Story Villa',
    description: 'Multi-level home with architectural stairs, pitched roof, and spacious living zones.',
    icon: '🏡',
    floors: 2,
    design: TEMPLATE_VILLA,
    activeFloorId: 'villa-floor-0',
  },
  {
    id: 'penthouse',
    title: 'Multi-level Penthouse with Stairs',
    description: 'Three-story luxury penthouse with stacked stairs, executive suite, and rooftop terrace.',
    icon: '🏢',
    floors: 3,
    design: TEMPLATE_PENTHOUSE,
    activeFloorId: 'pent-floor-0',
  },
  {
    id: 'empty',
    title: 'Empty Canvas',
    description: 'A clean slate ready for custom architectural drafting from ground up.',
    icon: '⬜',
    floors: 1,
    design: TEMPLATE_EMPTY,
    activeFloorId: 'floor-0',
  },
];

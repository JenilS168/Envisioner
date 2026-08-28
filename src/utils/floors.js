/**
 * floors.js — utilities for the multi-floor data model.
 *
 * Design shape:
 *   {
 *     floors: [
 *       {
 *         id: string,
 *         label: string,
 *         walls: Wall[],
 *         doors: Door[],
 *         windows: Window[],
 *         rooms: Room[],       // { id, roof: {...}, floorColor }
 *         materials: Materials,
 *         furniture: Furniture[],
 *       },
 *       ...
 *     ]
 *   }
 *
 * `activeFloorId` and `showAllFloors` are plain UI state in App.jsx (useState),
 * NOT stored inside the history-managed design object.
 */

export const DEFAULT_MATERIALS = {
  wallColor: '#d6c2a1',
  wallPreset: 'plain',
  doorFrameColor: '#4b2e1e',
  doorPanelColor: '#8b5a2b',
  windowFrameColor: '#eeeeee',
  windowGlassColor: '#78c7e8',
  roofColor: '#555555',
  roofPreset: 'plain',
};

/**
 * Creates a new, empty floor object.
 * @param {string} label  — display name, e.g. "Ground Floor"
 * @param {string} [id]   — optional explicit id; auto-generated if omitted
 */
export function makeEmptyFloor(label, id) {
  return {
    id: id || `floor-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    label: label || 'New Floor',
    walls: [],
    doors: [],
    windows: [],
    rooms: [],
    materials: { ...DEFAULT_MATERIALS },
    furniture: [],
  };
}

/**
 * Wraps a legacy flat design object (no `floors` key) into the new multi-floor
 * structure, placing all content into "Ground Floor".
 *
 * If the design already has a `floors` array, returns it unchanged.
 *
 * @param {object} oldDesign
 * @returns {object} design with a `floors` array
 */
export function migrateToFloors(oldDesign) {
  if (oldDesign && Array.isArray(oldDesign.floors)) {
    // Already in the multi-floor format — normalise each floor's arrays.
    return {
      ...oldDesign,
      floors: oldDesign.floors.map(normaliseFloor),
    };
  }

  const groundFloor = {
    id: 'floor-0',
    label: 'Ground Floor',
    walls:     oldDesign?.walls     || [],
    doors:     oldDesign?.doors     || [],
    windows:   oldDesign?.windows   || [],
    rooms:     oldDesign?.rooms     || [],
    materials: oldDesign?.materials ? { ...DEFAULT_MATERIALS, ...oldDesign.materials } : { ...DEFAULT_MATERIALS },
    furniture: oldDesign?.furniture || [],
  };

  return { floors: [groundFloor] };
}

/**
 * Ensures a floor object has all required array/material keys.
 * Defensive: old saves of a partially-defined floor won't crash.
 */
function normaliseFloor(floor) {
  return {
    ...floor,
    walls:     floor.walls     || [],
    doors:     floor.doors     || [],
    windows:   floor.windows   || [],
    rooms:     floor.rooms     || [],
    materials: floor.materials ? { ...DEFAULT_MATERIALS, ...floor.materials } : { ...DEFAULT_MATERIALS },
    furniture: floor.furniture || [],
  };
}

/**
 * Returns a new design object with the specified floor replaced by a patched version.
 *
 * @param {object} design   — current design (with `floors` array)
 * @param {string} floorId  — id of the floor to update
 * @param {object} patch    — partial floor properties to merge
 * @returns {object} new design
 */
export function updateFloorInDesign(design, floorId, patch) {
  return {
    ...design,
    floors: design.floors.map((f) =>
      f.id === floorId ? { ...f, ...patch } : f
    ),
  };
}

/**
 * Computes the 3D base Y (world height) for a given floor index.
 * Each floor starts at the cumulative sum of wall heights of the floors below it.
 * The representative height of a floor = max wall height on that floor (default 3 m).
 *
 * @param {Array}  floors      — all floor objects
 * @param {number} floorIndex  — zero-based index of the target floor
 * @returns {number} Y position in metres
 */
export function getFloorBaseY(floors, floorIndex) {
  let y = 0;
  for (let i = 0; i < floorIndex; i++) {
    const walls = floors[i]?.walls || [];
    const floorHeight =
      walls.length > 0
        ? Math.max(...walls.map((w) => w.height ?? 3))
        : 3;
    y += floorHeight;
  }
  return y;
}

/**
 * Returns the floor label for a given index.
 * "Ground Floor" for index 0, "1st Floor" for 1, "2nd Floor" for 2, etc.
 */
export function defaultFloorLabel(index) {
  if (index === 0) return 'Ground Floor';
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const suffix = index <= 3 ? suffixes[index] : 'th';
  return `${index}${suffix} Floor`;
}

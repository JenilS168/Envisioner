/**
 * Furniture catalog and geometry utilities for Envisioner.
 *
 * Rotation: stored as continuous degrees (0–359.9).
 *   Old 90°-step saves (0 / 90 / 180 / 270) load correctly — they are
 *   already valid continuous values and need no migration.
 *
 * Scale: stored as a multiplier per item (default 1.0, range 0.8–1.5).
 *   Old files without a scale field fall back to 1.0 everywhere via
 *   the defensive (item.scale ?? 1.0) pattern.
 */

// ---------------------------------------------------------------------------
// Catalog — one entry per furniture type
// ---------------------------------------------------------------------------
export const FURNITURE_CATALOG = {
  bed: {
    label: 'Bed',
    color: '#a0522d',
    footprintW: 1.6,   // metres along X at rotation = 0
    footprintD: 2.0,   // metres along Z at rotation = 0
  },
  sofa: {
    label: 'Sofa',
    color: '#6b7280',
    footprintW: 2.0,
    footprintD: 0.8,
  },
  table: {
    label: 'Table',
    color: '#d97706',
    footprintW: 1.2,
    footprintD: 0.8,
  },
  chair: {
    label: 'Chair',
    color: '#b45309',
    footprintW: 0.55,
    footprintD: 0.55,
  },
  wardrobe: {
    label: 'Wardrobe',
    color: '#374151',
    footprintW: 1.2,
    footprintD: 0.6,
  },
  kitchen_counter: {
    label: 'Counter',
    color: '#9ca3af',
    footprintW: 2.4,
    footprintD: 0.6,
  },
};

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Returns the axis-aligned footprint { w, d } in metres after applying scale.
 * Used for visual size references (2D rendering, ghost preview).
 * Does NOT apply rotation — use furnitureCorners() for boundary checks.
 *
 * @param {object} item – { type, scale? }
 * @returns {{ w: number, d: number }}
 */
export function furnitureFootprint(item) {
  const cat = FURNITURE_CATALOG[item.type] || FURNITURE_CATALOG.table;
  const s = item.scale ?? 1.0;
  return { w: cat.footprintW * s, d: cat.footprintD * s };
}

/**
 * Returns the 4 true rotated corners of a furniture item in world metres.
 * Uses the full 2D rotation matrix — accurate at any angle, not just 90° steps.
 *
 * Backward compatible:
 *   - items missing `rotation` default to 0°
 *   - items missing `scale` default to 1.0
 *   - old 90°-step values (0/90/180/270) work as-is
 *
 * @param {object} item – { x, y, rotation?, scale?, type }
 * @returns {Array<{x:number, y:number}>} four corners in world metres
 */
export function furnitureCorners(item) {
  return furnitureCornersAt(
    item.x,
    item.y,
    item.rotation ?? 0,
    item.scale ?? 1.0,
    item.type,
  );
}

/**
 * Computes 4 rotated corners for any proposed (cx, cy, rotation, scale)
 * without mutating the item.  Used for boundary validation during drags.
 *
 * @param {number} cx       – proposed centre x in metres
 * @param {number} cy       – proposed centre y in metres
 * @param {number} rotation – rotation in degrees (any angle)
 * @param {number} scale    – size multiplier
 * @param {string} type     – furniture type key
 * @returns {Array<{x:number, y:number}>}
 */
export function furnitureCornersAt(cx, cy, rotation, scale, type) {
  const cat = FURNITURE_CATALOG[type] || FURNITURE_CATALOG.table;
  const s = scale ?? 1.0;
  const hw = (cat.footprintW * s) / 2;
  const hd = (cat.footprintD * s) / 2;
  const theta = ((rotation ?? 0) * Math.PI) / 180;
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);

  // Four local-space corners (±hw, ±hd) rotated by theta.
  // Rotation matrix: x' = lx*cos – ly*sin,  y' = lx*sin + ly*cos
  return [
    [-hw, -hd],
    [ hw, -hd],
    [ hw,  hd],
    [-hw,  hd],
  ].map(([lx, ly]) => ({
    x: cx + lx * cosT - ly * sinT,
    y: cy + lx * sinT + ly * cosT,
  }));
}

// ---------------------------------------------------------------------------
// Generic SAT (Separating Axis Theorem) on convex polygons
// ---------------------------------------------------------------------------

/** Returns the 4 edge-normal axes of a convex polygon (for SAT). */
function getEdgeAxes(corners) {
  return corners.map((a, i) => {
    const b = corners[(i + 1) % corners.length];
    // Perpendicular to edge (bx-ax, by-ay) → normal (-dy, dx)
    return { x: -(b.y - a.y), y: b.x - a.x };
  });
}

/** Scalar projection interval of a polygon onto an axis. */
function projectPolygon(corners, axis) {
  let min = Infinity, max = -Infinity;
  for (const c of corners) {
    const proj = c.x * axis.x + c.y * axis.y;
    if (proj < min) min = proj;
    if (proj > max) max = proj;
  }
  return { min, max };
}

/**
 * Generic SAT overlap test between two convex polygons.
 * @param {Array<{x:number, y:number}>} cornersA
 * @param {Array<{x:number, y:number}>} cornersB
 * @returns {boolean} true if overlapping
 */
export function checkPolygonOverlap(cornersA, cornersB) {
  for (const axis of [...getEdgeAxes(cornersA), ...getEdgeAxes(cornersB)]) {
    const pA = projectPolygon(cornersA, axis);
    const pB = projectPolygon(cornersB, axis);
    if (pA.max < pB.min || pB.max < pA.min) return false; // gap found
  }
  return true; // no separating axis → shapes overlap
}

// ---------------------------------------------------------------------------
// Furniture-to-furniture collision
// ---------------------------------------------------------------------------

/**
 * Returns true if two furniture items' oriented bounding boxes overlap.
 * Delegates to the generic SAT check.
 *
 * @param {object} item1
 * @param {object} item2
 * @returns {boolean}
 */
export function checkFurnitureOverlap(item1, item2) {
  return checkPolygonOverlap(furnitureCorners(item1), furnitureCorners(item2));
}

// ---------------------------------------------------------------------------
// Wall footprint geometry — 4 corners of a wall's rectangular slab
// ---------------------------------------------------------------------------

/**
 * Returns the 4 corners of a wall's footprint rectangle in world metres.
 * The rectangle is the wall's centreline (start→end) expanded by ±thickness/2
 * perpendicular to the wall direction.
 *
 * @param {object} wall — { start: {x,y}, end: {x,y}, thickness? }
 * @returns {Array<{x:number, y:number}>} four corners
 */
export function wallCorners(wall) {
  const t = (wall.thickness ?? 0.2) / 2;
  const dx = wall.end.x - wall.start.x;
  const dy = wall.end.y - wall.start.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return [wall.start, wall.start, wall.start, wall.start];
  // Unit perpendicular vector
  const px = -dy / len * t;
  const py =  dx / len * t;
  return [
    { x: wall.start.x + px, y: wall.start.y + py },
    { x: wall.end.x   + px, y: wall.end.y   + py },
    { x: wall.end.x   - px, y: wall.end.y   - py },
    { x: wall.start.x - px, y: wall.start.y - py },
  ];
}

// ---------------------------------------------------------------------------
// Furniture-to-wall collision
// ---------------------------------------------------------------------------

/**
 * Returns true if a furniture item's OBB overlaps a wall's footprint rectangle.
 *
 * @param {object} item — furniture item
 * @param {object} wall — wall object
 * @returns {boolean}
 */
export function checkFurnitureWallOverlap(item, wall) {
  return checkPolygonOverlap(furnitureCorners(item), wallCorners(wall));
}

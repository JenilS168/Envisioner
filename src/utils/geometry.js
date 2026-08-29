/**
 * Geometry utilities for 2D floor plans and 3D room/roof generation.
 */

/**
 * Finds unique vertex index within a given tolerance.
 */
function getOrCreateVertex(vertices, point, tolerance = 0.1) {
  for (let i = 0; i < vertices.length; i++) {
    const v = vertices[i];
    if (Math.hypot(v.x - point.x, v.y - point.y) <= tolerance) {
      return i;
    }
  }
  vertices.push({ x: point.x, y: point.y });
  return vertices.length - 1;
}

/**
 * Computes signed area of a 2D polygon using the Shoelace formula.
 * Positive = Counter-Clockwise (CCW), Negative = Clockwise (CW).
 */
export function computeSignedArea(points) {
  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return area / 2;
}

/**
 * Computes bounding box for a 2D polygon.
 */
export function computePolygonBounds(points) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    depth: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}

/**
 * Detects closed loops from wall segments.
 *
 * @param {Array} walls - Array of wall objects with start: {x,y} and end: {x,y}
 * @param {number} tolerance - Snapping distance in meters (default 0.15m)
 * @returns {Array} Array of closed loop objects: [{ points: [{x,y},...], area: number, bounds: object }]
 */
export function findClosedLoops(walls, tolerance = 0.15) {
  if (!walls || walls.length < 3) return [];

  // 1. Build unique vertices
  const vertices = [];
  const edges = []; // { u, v, wallId }

  for (const wall of walls) {
    if (!wall.start || !wall.end) continue;
    const u = getOrCreateVertex(vertices, wall.start, tolerance);
    const v = getOrCreateVertex(vertices, wall.end, tolerance);
    if (u !== v) {
      edges.push({ u, v, wallId: wall.id });
    }
  }

  if (vertices.length < 3 || edges.length < 3) return [];

  // 2. Build adjacency list
  const adj = Array.from({ length: vertices.length }, () => []);
  for (let i = 0; i < edges.length; i++) {
    const { u, v, wallId } = edges[i];
    adj[u].push({ to: v, edgeIdx: i, wallId });
    adj[v].push({ to: u, edgeIdx: i, wallId });
  }

  // 3. Find simple cycles using DFS
  const foundCycles = [];

  function dfs(startNode, currNode, visitedEdges, path, wallPath) {
    for (const { to, edgeIdx, wallId } of adj[currNode]) {
      if (visitedEdges.has(edgeIdx)) continue;

      if (to === startNode && path.length >= 3) {
        // Closed cycle found!
        const cycle = [...path];
        const cycleWalls = [...wallPath, wallId];
        foundCycles.push({ cycle, cycleWalls });
        continue;
      }

      if (!path.includes(to) && path.length < 20) {
        visitedEdges.add(edgeIdx);
        path.push(to);
        wallPath.push(wallId);
        dfs(startNode, to, visitedEdges, path, wallPath);
        wallPath.pop();
        path.pop();
        visitedEdges.delete(edgeIdx);
      }
    }
  }

  for (let i = 0; i < vertices.length; i++) {
    if (adj[i].length >= 2) {
      dfs(i, i, new Set(), [i], []);
    }
  }

  // 4. Deduplicate and normalize cycles
  const uniqueLoops = [];
  const seenCanonical = new Set();

  for (const { cycle, cycleWalls } of foundCycles) {
    if (cycle.length < 3) continue;

    // Convert to canonical representation (rotate so minimum vertex is first)
    const minVertex = Math.min(...cycle);
    const minIdx = cycle.indexOf(minVertex);
    const rotated = [...cycle.slice(minIdx), ...cycle.slice(0, minIdx)];

    // Check both forward and backward canonical keys to avoid duplicates
    const forwardKey = rotated.join(',');
    const reversed = [rotated[0], ...rotated.slice(1).reverse()];
    const reverseKey = reversed.join(',');

    if (seenCanonical.has(forwardKey) || seenCanonical.has(reverseKey)) {
      continue;
    }
    seenCanonical.add(forwardKey);
    seenCanonical.add(reverseKey);

    // Extract points
    const points = rotated.map((idx) => ({ x: vertices[idx].x, y: vertices[idx].y }));
    const signedArea = computeSignedArea(points);
    const area = Math.abs(signedArea);

    // Filter out degenerate polygons
    if (area < 0.2) continue;

    // Ensure CCW orientation
    if (signedArea < 0) {
      points.reverse();
    }

    const bounds = computePolygonBounds(points);
    const loopId = [...cycleWalls].sort().join(',');

    uniqueLoops.push({
      id: loopId,
      points,
      area: Math.round(area * 100) / 100,
      bounds,
    });
  }

  return uniqueLoops;
}

/**
 * Checks if a 2D point is inside a polygon using ray-casting.
 * @param {object} point {x, y}
 * @param {Array} vs Array of points [{x,y}, ...]
 * @returns {boolean} True if inside
 */
export function pointInPolygon(point, vs) {
  let x = point.x, y = point.y;
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    let xi = vs[i].x, yi = vs[i].y;
    let xj = vs[j].x, yj = vs[j].y;
    let intersect = ((yi > y) !== (yj > y))
        && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// ---------------------------------------------------------------------------
// CANTILEVER SUPPORT UTILITIES
// Used by View3D to compute automatic ceiling extensions when an upper
// floor's closed structure overhangs the lower floor's ceiling polygon.
// ---------------------------------------------------------------------------

/**
 * Computes the fraction [0, 1] of the upper polygon's area that is supported
 * by (overlaps with) the union of the given lower-floor loop polygons.
 * Uses a raster grid at `resolutionM` metres for sampling.
 *
 * @param {Array<{x,y}>} upperPoints          — vertices of the upper-floor polygon
 * @param {Array<{points:Array<{x,y}>}>} lowerLoopsList — lower-floor closed loops
 * @param {number} [resolutionM=0.1]           — grid cell size in metres
 * @returns {number}  support fraction ∈ [0, 1]; 0 if inputs are invalid
 */
export function computeSupportFraction(upperPoints, lowerLoopsList, resolutionM = 0.1) {
  if (!upperPoints || upperPoints.length < 3) return 0;
  if (!lowerLoopsList || lowerLoopsList.length === 0) return 0;

  const bounds = computePolygonBounds(upperPoints);
  const halfStep = resolutionM / 2;
  let totalCells = 0;
  let supportedCells = 0;

  for (let cy = bounds.minY + halfStep; cy <= bounds.maxY; cy += resolutionM) {
    for (let cx = bounds.minX + halfStep; cx <= bounds.maxX; cx += resolutionM) {
      const pt = { x: cx, y: cy };
      if (!pointInPolygon(pt, upperPoints)) continue;
      totalCells++;
      if (lowerLoopsList.some((loop) => pointInPolygon(pt, loop.points))) {
        supportedCells++;
      }
    }
  }

  return totalCells > 0 ? supportedCells / totalCells : 0;
}

/**
 * Computes the overhang region: parts of the upper polygon that do NOT
 * overlap any of the lower-floor loop polygons.
 *
 * Returns an array of axis-aligned rectangle strips in plan-space metres:
 * `[{ x0, y0, x1, y1 }]`.  Each strip is a horizontal run of adjacent
 * overhang grid cells merged together.  Returns an empty array when there
 * is no overhang, or when inputs are invalid / no lower loops exist.
 *
 * The strips are used directly by CantileverSlab3D in View3D.jsx to build
 * a merged BufferGeometry — no external polygon library required.
 *
 * Coordinate note: x0/x1 are plan-space X metres; y0/y1 are plan-space Y
 * metres.  View3D maps plan Y → Three.js Z directly (same sign), so the
 * caller uses the values as-is for the Z axis.
 *
 * @param {Array<{x,y}>} upperPoints          — vertices of the upper-floor polygon
 * @param {Array<{points:Array<{x,y}>}>} lowerLoopsList — lower-floor closed loops
 * @param {number} [resolutionM=0.1]           — grid cell size in metres
 * @returns {Array<{x0:number, y0:number, x1:number, y1:number}>}
 */
export function computePolygonOverhang(upperPoints, lowerLoopsList, resolutionM = 0.1) {
  if (!upperPoints || upperPoints.length < 3) return [];
  if (!lowerLoopsList || lowerLoopsList.length === 0) return [];

  const bounds = computePolygonBounds(upperPoints);
  const halfStep = resolutionM / 2;
  const strips = [];

  for (let cy = bounds.minY + halfStep; cy <= bounds.maxY; cy += resolutionM) {
    let stripStartX = null;
    let lastOverhangX = null;

    for (let cx = bounds.minX + halfStep; cx <= bounds.maxX; cx += resolutionM) {
      const pt = { x: cx, y: cy };
      const isOverhang =
        pointInPolygon(pt, upperPoints) &&
        !lowerLoopsList.some((loop) => pointInPolygon(pt, loop.points));

      if (isOverhang) {
        if (stripStartX === null) stripStartX = cx;
        lastOverhangX = cx;
      } else if (stripStartX !== null) {
        strips.push({
          x0: stripStartX - halfStep,
          y0: cy - halfStep,
          x1: lastOverhangX + halfStep,
          y1: cy + halfStep,
        });
        stripStartX = null;
        lastOverhangX = null;
      }
    }

    // Close any open strip at row end
    if (stripStartX !== null) {
      strips.push({
        x0: stripStartX - halfStep,
        y0: cy - halfStep,
        x1: lastOverhangX + halfStep,
        y1: cy + halfStep,
      });
    }
  }

  return strips;
}

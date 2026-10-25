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
 * Checks if point P (given as vertex index pIdx) lies strictly on the segment
 * between vertices[u] and vertices[v] (not at the endpoints), within tolerance.
 * Returns the parametric t ∈ (0,1) along the segment, or -1 if not on segment.
 */
function pointOnSegmentT(vertices, pIdx, u, v, tolerance) {
  const p  = vertices[pIdx];
  const a  = vertices[u];
  const b  = vertices[v];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-10) return -1; // degenerate edge

  // Project p onto line AB
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  if (t <= tolerance / Math.sqrt(lenSq) || t >= 1 - tolerance / Math.sqrt(lenSq)) {
    return -1; // at or beyond endpoint — not a T-junction
  }

  // Check perpendicular distance
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  const distSq = (p.x - projX) * (p.x - projX) + (p.y - projY) * (p.y - projY);
  return distSq <= tolerance * tolerance ? t : -1;
}

/**
 * Detects closed loops from wall segments.
 *
 * Handles T-junctions: when a wall endpoint lies on another wall's segment
 * (but not at its endpoints), that segment is split at the junction so the
 * interior room is part of the graph and can form a valid closed loop.
 *
 * @param {Array} walls - Array of wall objects with start: {x,y} and end: {x,y}
 * @param {number} tolerance - Snapping distance in meters (default 0.15m)
 * @returns {Array} Array of closed loop objects: [{ points: [{x,y},...], area: number, bounds: object }]
 */
export function findClosedLoops(walls, tolerance = 0.15) {
  if (!walls || walls.length < 3) return [];

  // 1. Build unique vertices
  const vertices = [];
  let edges = []; // { u, v, wallId }

  for (const wall of walls) {
    if (!wall.start || !wall.end) continue;
    const u = getOrCreateVertex(vertices, wall.start, tolerance);
    const v = getOrCreateVertex(vertices, wall.end, tolerance);
    if (u !== v) {
      edges.push({ u, v, wallId: wall.id });
    }
  }

  if (vertices.length < 3 || edges.length < 3) return [];

  // 1b. T-junction splitting: for every vertex P, check if it lies strictly
  //     on any edge (u→v) that does not already include P as an endpoint.
  //     If so, split that edge into (u→P) and (P→v).
  //     Iterate until stable (a single pass can miss cascading junctions).
  let changed = true;
  while (changed) {
    changed = false;
    const nextEdges = [];
    for (const edge of edges) {
      const { u, v, wallId } = edge;
      let splitAt = -1;
      let splitT   = Infinity;
      // Check every vertex against this edge; split at the nearest junction
      for (let pIdx = 0; pIdx < vertices.length; pIdx++) {
        if (pIdx === u || pIdx === v) continue;
        const t = pointOnSegmentT(vertices, pIdx, u, v, tolerance);
        if (t > 0 && t < splitT) {
          splitT  = t;
          splitAt = pIdx;
        }
      }
      if (splitAt >= 0) {
        // Split this edge at the junction vertex
        nextEdges.push({ u, v: splitAt, wallId });
        nextEdges.push({ u: splitAt, v, wallId });
        changed = true;
      } else {
        nextEdges.push(edge);
      }
    }
    edges = nextEdges;
  }

  // 2. Build adjacency list
  const adj = Array.from({ length: vertices.length }, () => []);
  for (let i = 0; i < edges.length; i++) {
    const { u, v, wallId } = edges[i];
    adj[u].push({ to: v, edgeIdx: i, wallId });
    adj[v].push({ to: u, edgeIdx: i, wallId });
  }

  // 3. Find simple cycles using bounded DFS.
  //
  // For each start vertex we run an edge-backtracking DFS to find all simple
  // cycles reachable from it. Two bounding measures keep runtime practical:
  //   • path length cap of 12: rooms with >12 corners are unrealistic and the
  //     cap prevents the combinatorial blowup on dense graphs.
  //   • global cycle cap of 600: once we have found this many raw candidate
  //     cycles the dedup/area filters in step 4 will select the primitives;
  //     we stop early rather than enumerate every compound spanning loop.
  // For typical floor plans (≤15 walls, ≤4 rooms per floor) performance is
  // well under 1 ms. The cap only kicks in for pathological dense grids that
  // no user would draw manually.
  const MAX_PATH   = 12;  // max vertices in a cycle (including start)
  const MAX_CYCLES = 600; // global cap to prevent exponential blowup
  const foundCycles = [];

  function dfs(startNode, currNode, visitedEdges, path, wallPath) {
    if (foundCycles.length >= MAX_CYCLES) return;
    for (const { to, edgeIdx, wallId } of adj[currNode]) {
      if (foundCycles.length >= MAX_CYCLES) return;
      if (visitedEdges.has(edgeIdx)) continue;

      if (to === startNode && path.length >= 3) {
        foundCycles.push({ cycle: [...path], cycleWalls: [...wallPath, wallId] });
        continue;
      }

      if (!path.includes(to) && path.length < MAX_PATH) {
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
    if (foundCycles.length >= MAX_CYCLES) break;
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

export const GEOMETRY_EPSILON = 1e-6;

function distanceToSegmentSquared(px, py, x1, y1, x2, y2) {
  const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  if (l2 === 0) return (px - x1) * (px - x1) + (py - y1) * (py - y1);
  
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  
  const projX = x1 + t * (x2 - x1);
  const projY = y1 + t * (y2 - y1);
  return (px - projX) * (px - projX) + (py - projY) * (py - projY);
}

/**
 * Checks if a 2D point is inside a polygon using ray-casting.
 * Uses an epsilon tolerance to allow exact boundary touches.
 * @param {object} point {x, y}
 * @param {Array} vs Array of points [{x,y}, ...]
 * @param {number} epsilon Distance tolerance (default GEOMETRY_EPSILON)
 * @returns {boolean} True if inside or on boundary
 */
export function pointInPolygon(point, vs, epsilon = GEOMETRY_EPSILON) {
  let x = point.x, y = point.y;
  let inside = false;
  const eps2 = epsilon * epsilon;

  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    let xi = vs[i].x, yi = vs[i].y;
    let xj = vs[j].x, yj = vs[j].y;
    
    // 1. Boundary check: If the point is on the segment within epsilon, it's inside
    if (distanceToSegmentSquared(x, y, xi, yi, xj, yj) <= eps2) {
      return true;
    }
    
    // 2. Ray-casting check
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

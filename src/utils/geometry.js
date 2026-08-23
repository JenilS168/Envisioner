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

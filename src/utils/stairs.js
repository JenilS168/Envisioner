import { checkPolygonOverlap, wallCorners, furnitureCorners } from './furniture';
import { pointInPolygon } from './geometry';

export const STAIR_CATALOG = {
  straight: { label: 'Straight' },
  l_shape: { label: 'L-Shaped' },
  u_shape: { label: 'U-Shaped' },
};

/**
 * Gets the array of convex polygons making up a stair.
 * We return multiple polygons for L-shaped and U-shaped to ensure
 * accurate collision detection (rather than a loose bounding box).
 * 
 * The origin (0,0) before translation/rotation is the geometric center of the primary flight.
 */
export function getStairPolygons(stair) {
  const { type, x, y, rotation, width, run, landingLength, turnDirection } = stair;
  const w = width ?? 1.0;
  const d = run ?? 3.0;
  const l = landingLength ?? 1.0;
  
  // Create unrotated, untranslated polygons
  let polys = [];
  
  if (type === 'straight') {
    // Single rectangle
    // origin at center
    polys.push([
      { x: -w/2, y: -d/2 },
      { x: w/2,  y: -d/2 },
      { x: w/2,  y: d/2 },
      { x: -w/2, y: d/2 }
    ]);
  } else if (type === 'l_shape') {
    const flight1Run = d / 2;
    const flight2Run = d / 2;
    
    // Flight 1 (bottom half)
    polys.push([
      { x: -w/2, y: -flight1Run/2 },
      { x: w/2,  y: -flight1Run/2 },
      { x: w/2,  y: flight1Run/2 },
      { x: -w/2, y: flight1Run/2 }
    ]);
    
    // Landing is attached to the top of Flight 1
    // Top of Flight 1 is at y = flight1Run/2
    const landingCenterY = flight1Run/2 + l/2;
    polys.push([
      { x: -w/2, y: landingCenterY - l/2 },
      { x: w/2,  y: landingCenterY - l/2 },
      { x: w/2,  y: landingCenterY + l/2 },
      { x: -w/2, y: landingCenterY + l/2 }
    ]);
    
    // Flight 2 attached to side of landing
    if (turnDirection === 'left') {
      // Goes left from landing. Left edge of landing is x = -w/2.
      // Flight 2 extends left by flight2Run
      const f2CenterX = -w/2 - flight2Run/2;
      polys.push([
        { x: f2CenterX - flight2Run/2, y: landingCenterY - w/2 },
        { x: f2CenterX + flight2Run/2, y: landingCenterY - w/2 },
        { x: f2CenterX + flight2Run/2, y: landingCenterY + w/2 },
        { x: f2CenterX - flight2Run/2, y: landingCenterY + w/2 }
      ]);
    } else {
      // Goes right
      const f2CenterX = w/2 + flight2Run/2;
      polys.push([
        { x: f2CenterX - flight2Run/2, y: landingCenterY - w/2 },
        { x: f2CenterX + flight2Run/2, y: landingCenterY - w/2 },
        { x: f2CenterX + flight2Run/2, y: landingCenterY + w/2 },
        { x: f2CenterX - flight2Run/2, y: landingCenterY + w/2 }
      ]);
    }
  } else if (type === 'u_shape') {
    const flight1Run = d / 2;
    const flight2Run = d / 2;
    const gap = 0.2; // small gap between the two flights
    const totalLandingWidth = w * 2 + gap;
    
    // Flight 1 (bottom half, offset to the right if turning left, or left if turning right)
    const f1OffsetX = turnDirection === 'left' ? (w/2 + gap/2) : -(w/2 + gap/2);
    polys.push([
      { x: f1OffsetX - w/2, y: -flight1Run/2 },
      { x: f1OffsetX + w/2, y: -flight1Run/2 },
      { x: f1OffsetX + w/2, y: flight1Run/2 },
      { x: f1OffsetX - w/2, y: flight1Run/2 }
    ]);
    
    // Landing
    const landingCenterY = flight1Run/2 + l/2;
    polys.push([
      { x: -totalLandingWidth/2, y: landingCenterY - l/2 },
      { x: totalLandingWidth/2,  y: landingCenterY - l/2 },
      { x: totalLandingWidth/2,  y: landingCenterY + l/2 },
      { x: -totalLandingWidth/2, y: landingCenterY + l/2 }
    ]);
    
    // Flight 2 (goes back down)
    const f2OffsetX = turnDirection === 'left' ? -(w/2 + gap/2) : (w/2 + gap/2);
    polys.push([
      { x: f2OffsetX - w/2, y: -flight2Run/2 },
      { x: f2OffsetX + w/2, y: -flight2Run/2 },
      { x: f2OffsetX + w/2, y: flight2Run/2 },
      { x: f2OffsetX - w/2, y: flight2Run/2 }
    ]);
  }
  
  // Transform all polygons (rotate, then translate)
  const theta = ((rotation ?? 0) * Math.PI) / 180;
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  
  return polys.map(poly => poly.map(pt => ({
    x: x + pt.x * cosT - pt.y * sinT,
    y: y + pt.x * sinT + pt.y * cosT,
  })));
}

/**
 * Returns a SINGLE merged outline polygon for a stair — used for ceiling/floor
 * hole cutting in THREE.js.  getStairPolygons() returns separate convex
 * sub-polygons (good for SAT collision), but THREE.Shape.holes cannot handle
 * multiple overlapping/edge-sharing holes — the earcut triangulator produces
 * garbage.  This function computes the true L / U outline instead.
 *
 * Returns one array of {x, y} points (already rotated + translated).
 */
export function getStairOutline(stair) {
  const { type, x, y, rotation, width, run, landingLength, turnDirection } = stair;
  const w = width ?? 1.0;
  const d = run ?? 3.0;
  const l = landingLength ?? 1.0;

  let pts = [];

  if (type === 'straight') {
    // Single rectangle — same as getStairPolygons
    pts = [
      { x: -w / 2, y: -d / 2 },
      { x:  w / 2, y: -d / 2 },
      { x:  w / 2, y:  d / 2 },
      { x: -w / 2, y:  d / 2 },
    ];
  } else if (type === 'l_shape') {
    const f1Run = d / 2;
    const f2Run = d / 2;
    const lcy = f1Run / 2 + l / 2;       // landing centre Y
    const R = w / 2;                       // right edge of main body
    const L = -w / 2;                      // left edge of main body
    const B = -f1Run / 2;                  // bottom of flight 1
    const T = f1Run / 2 + l;              // top of landing
    const f2B = lcy - w / 2;             // flight 2 bottom Y
    const f2T = lcy + w / 2;             // flight 2 top Y

    if (turnDirection === 'left') {
      const f2L = L - f2Run;             // flight 2 left edge X
      pts.push({ x: L, y: B });          // bottom-left of flight 1
      pts.push({ x: R, y: B });          // bottom-right
      pts.push({ x: R, y: T });          // top-right of landing
      // Trace from top-right down to flight 2
      if (f2T < T) {
        // w < l: flight 2 doesn't reach landing top → inner notch
        pts.push({ x: L, y: T });
        pts.push({ x: L, y: f2T });
      } else if (f2T > T) {
        // w > l: flight 2 extends above landing → step up
        pts.push({ x: L, y: T });
        pts.push({ x: L, y: f2T });
      } else {
        // w === l: flush
        pts.push({ x: L, y: T });
      }
      pts.push({ x: f2L, y: f2T });      // top-left of flight 2
      pts.push({ x: f2L, y: f2B });      // bottom-left of flight 2
      // Trace back to main body
      if (f2B > f1Run / 2) {
        // w < l: flight 2 bottom above flight 1 top → inner step
        pts.push({ x: L, y: f2B });
      } else if (f2B < f1Run / 2) {
        // w > l: flight 2 extends below landing bottom
        pts.push({ x: L, y: f2B });
      } else {
        // flush at f1Run/2
        pts.push({ x: L, y: f2B });
      }
    } else {
      // Right turn — mirror
      const f2R = R + f2Run;
      pts.push({ x: L, y: B });
      pts.push({ x: R, y: B });
      // Trace up right side with flight 2
      if (f2B > f1Run / 2) {
        pts.push({ x: R, y: f2B });
      } else if (f2B < f1Run / 2) {
        pts.push({ x: R, y: f2B });
      } else {
        pts.push({ x: R, y: f2B });
      }
      pts.push({ x: f2R, y: f2B });
      pts.push({ x: f2R, y: f2T });
      if (f2T < T) {
        pts.push({ x: R, y: f2T });
        pts.push({ x: R, y: T });
      } else if (f2T > T) {
        pts.push({ x: R, y: f2T });
        pts.push({ x: R, y: T });
      } else {
        pts.push({ x: R, y: T });
      }
      pts.push({ x: L, y: T });
    }
  } else if (type === 'u_shape') {
    const f1Run = d / 2;
    const f2Run = d / 2;
    const gap = 0.2;
    const lcy = f1Run / 2 + l / 2;
    const totalW = 2 * w + gap;
    const f1cx = turnDirection === 'left' ? (w / 2 + gap / 2) : -(w / 2 + gap / 2);
    const f2cx = turnDirection === 'left' ? -(w / 2 + gap / 2) : (w / 2 + gap / 2);

    // Outer rect: x in [-totalW/2, totalW/2], y in [-f1Run/2, lcy + l/2]
    // with a notch at the bottom between the two flights (the gap)
    const outerL = -totalW / 2;
    const outerR = totalW / 2;
    const outerB = -f1Run / 2;
    const outerT = lcy + l / 2;

    // Gap notch: x in [f2cx + w/2, f1cx - w/2] (or mirrored), y = outerB
    // For left turn: gap is from x = f2cx+w/2 to f1cx-w/2
    // For right turn: gap is from x = f1cx+w/2 to f2cx-w/2
    let gapL, gapR;
    if (turnDirection === 'left') {
      gapL = f2cx + w / 2;   // -0.1
      gapR = f1cx - w / 2;   // 0.1
    } else {
      gapL = f1cx + w / 2;
      gapR = f2cx - w / 2;
    }

    // The gap notch extends from outerB up to f1Run/2 (bottom of landing)
    const notchTop = f1Run / 2;
    pts.push({ x: outerL, y: outerB });   // 0: bottom-left
    pts.push({ x: gapL,   y: outerB });   // 1: bottom edge, gap left
    pts.push({ x: gapL,   y: notchTop }); // 2: gap left, up to landing bottom
    pts.push({ x: gapR,   y: notchTop }); // 3: gap right, at landing bottom
    pts.push({ x: gapR,   y: outerB });   // 4: gap right, back down
    pts.push({ x: outerR, y: outerB });   // 5: bottom-right
    pts.push({ x: outerR, y: outerT });   // 6: top-right
    pts.push({ x: outerL, y: outerT });   // 7: top-left
  }

  // Rotate + translate (same transform as getStairPolygons)
  const theta = ((rotation ?? 0) * Math.PI) / 180;
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);

  return pts.map(pt => ({
    x: x + pt.x * cosT - pt.y * sinT,
    y: y + pt.x * sinT + pt.y * cosT,
  }));
}

/** Check if any part of stairA overlaps with any part of stairB */
export function checkStairOverlap(stairA, stairB) {
  const polysA = getStairPolygons(stairA);
  const polysB = getStairPolygons(stairB);
  for (const pA of polysA) {
    for (const pB of polysB) {
      if (checkPolygonOverlap(pA, pB)) return true;
    }
  }
  return false;
}

/** Check if stair overlaps with a wall */
export function checkStairWallOverlap(stair, wall) {
  const polys = getStairPolygons(stair);
  const wCorners = wallCorners(wall);
  for (const p of polys) {
    if (checkPolygonOverlap(p, wCorners)) return true;
  }
  return false;
}

/** Check if stair overlaps with furniture */
export function checkStairFurnitureOverlap(stair, item) {
  const polys = getStairPolygons(stair);
  const fCorners = furnitureCorners(item);
  for (const p of polys) {
    if (checkPolygonOverlap(p, fCorners)) return true;
  }
  return false;
}

/** 
 * Check if stair is fully inside a closed room loop.
 * Also ensure we sample enough points along the edges to catch concave intersections.
 */
export function checkStairInRoom(stair, loopPoints) {
  const polys = getStairPolygons(stair);
  for (const p of polys) {
    for (let i = 0; i < p.length; i++) {
      const p1 = p[i];
      const p2 = p[(i + 1) % p.length];
      // Check vertex
      if (!pointInPolygon(p1, loopPoints)) return false;
      // Check midpoint
      if (!pointInPolygon({ x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }, loopPoints)) return false;
    }
  }
  return true;
}

/** Calculate recommended step count based on floor height */
export function calculateStepCount(floorHeight) {
  const targetRiser = 0.175; // 17.5 cm
  let steps = Math.round(floorHeight / targetRiser);
  if (steps < 10) steps = 10;
  if (steps > 30) steps = 30;
  return steps;
}

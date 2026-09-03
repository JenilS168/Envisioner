import { checkFurnitureOverlap, checkFurnitureWallOverlap } from './furniture';
import { checkStairOverlap, checkStairWallOverlap, checkStairFurnitureOverlap, checkStairInRoom } from './stairs';
import { pointInPolygon, GEOMETRY_EPSILON } from './geometry';

/**
 * Pure validation module to compute collisions and unsupported geometry.
 * Returns fresh Set and Map instances on each calculation.
 */
export function computeFloorValidations({
  activeFloorId,
  walls,
  furniture,
  stairs,
  closedLoops,
  belowFloorLoops,
  isGroundFloor,
  allFloors
}) {
  const invalidStairIds = new Set();
  const overlappingFurnIds = new Set();
  const unsupportedWallIds = new Set();
  const stairCollisionReasons = new Map();
  const furnitureCollisionReasons = new Map();

  // 1. Validate Stairs (Only validate stairs that belong to the active floor)
  // Ensure we don't accidentally validate the upper-floor visual guide!
  const activeStairs = stairs.filter(s => s.fromFloorId === activeFloorId);

  for (let i = 0; i < activeStairs.length; i++) {
    const stair = activeStairs[i];
    let isInvalid = false;
    let reason = '';

    // Check vs walls
    for (const wall of walls) {
      if (checkStairWallOverlap(stair, wall)) {
        invalidStairIds.add(stair.id);
        isInvalid = true;
        reason = 'Overlaps a wall';
        break;
      }
    }

    // Check vs other stairs
    if (!isInvalid) {
      for (let j = 0; j < activeStairs.length; j++) {
        if (i === j) continue;
        if (checkStairOverlap(stair, activeStairs[j])) {
          invalidStairIds.add(stair.id);
          isInvalid = true;
          reason = 'Overlaps another stair';
          break;
        }
      }
    }

    // Check vs furniture (symmetric check)
    if (!isInvalid) {
      for (const item of furniture) {
        if (checkStairFurnitureOverlap(stair, item)) {
          invalidStairIds.add(stair.id);
          overlappingFurnIds.add(item.id);
          isInvalid = true;
          reason = 'Overlaps furniture';
          furnitureCollisionReasons.set(item.id, 'Overlaps a stair');
          break; // Stair is invalid, stop checking it against more furniture
        }
      }
    }

    // Check if fully inside a room
    if (!isInvalid && closedLoops.length > 0) {
      const inRoom = closedLoops.some(loop => checkStairInRoom(stair, loop.points));
      if (!inRoom) {
        invalidStairIds.add(stair.id);
        isInvalid = true;
        reason = 'Not fully inside a closed room';
      }
    }

    if (isInvalid) {
      stairCollisionReasons.set(stair.id, reason);
    }
  }

  // 2. Validate Furniture
  for (let i = 0; i < furniture.length; i++) {
    const item = furniture[i];

    // Furniture vs stairs was partially checked above, but what if furniture overlaps a stair that ALREADY turned invalid? 
    // We should ensure the furniture also gets flagged if it overlaps *any* stair.
    for (const stair of activeStairs) {
      if (checkStairFurnitureOverlap(stair, item)) {
        overlappingFurnIds.add(item.id);
        invalidStairIds.add(stair.id);
        furnitureCollisionReasons.set(item.id, 'Overlaps a stair');
        stairCollisionReasons.set(stair.id, 'Overlaps furniture');
        break;
      }
    }

    // Check vs walls
    for (const wall of walls) {
      if (checkFurnitureWallOverlap(item, wall)) {
        overlappingFurnIds.add(item.id);
        furnitureCollisionReasons.set(item.id, 'Overlaps a wall');
        break;
      }
    }

    // Check vs other furniture
    for (let j = i + 1; j < furniture.length; j++) {
      if (checkFurnitureOverlap(item, furniture[j])) {
        overlappingFurnIds.add(item.id);
        overlappingFurnIds.add(furniture[j].id);
        furnitureCollisionReasons.set(item.id, 'Overlaps other furniture');
        furnitureCollisionReasons.set(furniture[j].id, 'Overlaps other furniture');
      }
    }
  }

  // 3. Validate Walls (Unsupported check against lower floor)
  // A wall is flagged if MORE THAN 50% of its length is unsupported,
  // so partial overhangs and cantilevers do NOT trigger the warning.
  if (!isGroundFloor) {
    if (belowFloorLoops.length === 0) {
      for (const wall of walls) {
        unsupportedWallIds.add(wall.id);
      }
    } else {
      const SUPPORT_SAMPLES = 12;
      const SUPPORT_THRESHOLD = 0.5;

      for (const wall of walls) {
        let unsupportedCount = 0;
        for (let k = 0; k <= SUPPORT_SAMPLES; k++) {
          const t = k / SUPPORT_SAMPLES;
          const px = wall.start.x + t * (wall.end.x - wall.start.x);
          const py = wall.start.y + t * (wall.end.y - wall.start.y);

          // Epsilon-aware check
          const supported = belowFloorLoops.some(loop =>
            pointInPolygon({ x: px, y: py }, loop.points, GEOMETRY_EPSILON)
          );
          
          if (!supported) {
            unsupportedCount++;
          }
        }
        if (unsupportedCount / (SUPPORT_SAMPLES + 1) > SUPPORT_THRESHOLD) {
          unsupportedWallIds.add(wall.id);
        }
      }
    }
  }

  return {
    invalidStairIds,
    overlappingFurnIds,
    unsupportedWallIds,
    stairCollisionReasons,
    furnitureCollisionReasons
  };
}

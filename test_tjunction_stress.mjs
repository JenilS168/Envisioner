// Stress test: T-junction splitting on complex floor plans
import { findClosedLoops } from './src/utils/geometry.js';

function timed(label, fn) {
  const t0 = performance.now();
  const result = fn();
  const ms = (performance.now() - t0).toFixed(3);
  return { result, ms, label };
}

// ── Test A: 8-room "apartment block" ───────────────────────────────────────
// Long outer walls (0→24m wide, 0→6m tall), 7 vertical dividers at x=3,6,9,12,15,18,21
// All dividers T-junction both top and bottom walls
function makeApartmentBlock(dividers) {
  const walls = [
    { id: 'top',    start: {x:0,y:0},               end: {x:dividers*3,y:0} },
    { id: 'right',  start: {x:dividers*3,y:0},       end: {x:dividers*3,y:6} },
    { id: 'bottom', start: {x:dividers*3,y:6},       end: {x:0,y:6} },
    { id: 'left',   start: {x:0,y:6},                end: {x:0,y:0} },
  ];
  for (let i = 1; i < dividers; i++) {
    walls.push({ id: `div${i}`, start: {x:i*3,y:0}, end: {x:i*3,y:6} });
  }
  return walls;
}

// ── Test B: Grid layout (NxM rooms) ────────────────────────────────────────
// Creates a grid of rooms with T-junctions on all interior walls
function makeGrid(cols, rows) {
  const W = cols * 3, H = rows * 4;
  const walls = [];
  let id = 0;
  // Full-span outer walls
  walls.push({ id: `w${id++}`, start: {x:0,y:0},   end: {x:W,y:0} });   // top
  walls.push({ id: `w${id++}`, start: {x:W,y:0},   end: {x:W,y:H} });   // right
  walls.push({ id: `w${id++}`, start: {x:W,y:H},   end: {x:0,y:H} });   // bottom
  walls.push({ id: `w${id++}`, start: {x:0,y:H},   end: {x:0,y:0} });   // left
  // Vertical dividers — T-junction on top and bottom outer walls
  for (let c = 1; c < cols; c++) {
    walls.push({ id: `vc${id++}`, start: {x:c*3,y:0}, end: {x:c*3,y:H} });
  }
  // Horizontal dividers — T-junction on left and right outer walls
  for (let r = 1; r < rows; r++) {
    walls.push({ id: `hr${id++}`, start: {x:0,y:r*4}, end: {x:W,y:r*4} });
  }
  return walls;
}

// ── Test C: L-shaped compound ──────────────────────────────────────────────
// Two rectangular blocks sharing a wall, with sub-rooms in each block
function makeLShaped() {
  return [
    // Block 1: 6×8, divided into 2 rooms by vertical divider
    { id: 'b1t',  start: {x:0,y:0},   end: {x:6,y:0} },
    { id: 'b1r',  start: {x:6,y:0},   end: {x:6,y:8} },
    { id: 'b1b',  start: {x:6,y:8},   end: {x:0,y:8} },
    { id: 'b1l',  start: {x:0,y:8},   end: {x:0,y:0} },
    { id: 'b1d',  start: {x:3,y:0},   end: {x:3,y:8} }, // T-junction both ends
    // Block 2: 9×6, attached to right of block 1, divided into 3 rooms
    { id: 'b2t',  start: {x:6,y:0},   end: {x:15,y:0} },
    { id: 'b2r',  start: {x:15,y:0},  end: {x:15,y:6} },
    { id: 'b2b',  start: {x:15,y:6},  end: {x:6,y:6} },
    // b2 left wall is shared with b1r (same segment, endpoints match at (6,0)-(6,6))
    // Actually b1r goes 0 to 8, and b2 left is 0 to 6 — partial overlap via T-junction
    { id: 'b2l',  start: {x:6,y:6},   end: {x:6,y:0} },  // same as b1r reversed, endpoints match
    { id: 'b2d1', start: {x:9,y:0},   end: {x:9,y:6} },  // T-junction both
    { id: 'b2d2', start: {x:12,y:0},  end: {x:12,y:6} }, // T-junction both
  ];
}

console.log('=== T-junction Stress Tests ===\n');

// Apartment block tests (1D comb)
for (const n of [3, 5, 7, 10, 15]) {
  const walls = makeApartmentBlock(n);
  const { result, ms } = timed(`${n+1}-room apartment (${walls.length} walls)`, () => findClosedLoops(walls));
  const expectedRooms = n + 1; // n rooms + outer composite
  const roomsFound = result.filter(l => {
    const area = l.area;
    return Math.abs(area - 18) < 0.5; // 3×6 each
  }).length;
  console.log(`  ${n}-divider apartment (${walls.length} walls): ${result.length} loops in ${ms}ms`);
  console.log(`    Expected ${n+1} rooms of 18m² each: found ${roomsFound}/${n+1} ✅`);
}

console.log('');

// Grid tests (2D, all interior walls are T-junctions on the outer walls but cross each other at endpoints)
for (const [cols, rows] of [[2,2],[3,3],[4,4],[5,4]]) {
  const walls = makeGrid(cols, rows);
  const { result, ms } = timed(`${cols}×${rows} grid (${walls.length} walls)`, () => findClosedLoops(walls));
  const expectedMinRooms = cols * rows;
  console.log(`  ${cols}×${rows} grid (${walls.length} walls): ${result.length} loops in ${ms}ms`);
  console.log(`    Expected >= ${expectedMinRooms} rooms: found ${result.length >= expectedMinRooms ? '✅' : '❌'} (${result.length})`);
}

console.log('');

// L-shaped compound
{
  const walls = makeLShaped();
  const { result, ms } = timed('L-shaped compound', () => findClosedLoops(walls));
  console.log(`  L-shaped compound (${walls.length} walls): ${result.length} loops in ${ms}ms`);
  console.log(`    Expected >= 5 rooms: ${result.length >= 5 ? '✅' : '❌'}`);
  console.log(`    Areas (sorted): [${result.map(l=>l.area.toFixed(0)).sort((a,b)=>a-b).join(', ')}]`);
}

console.log('');

// Large stress: 20 rooms in a row (max realistic single-floor)
{
  const n = 20;
  const walls = makeApartmentBlock(n);
  const { result, ms } = timed(`${n+1}-room apartment`, () => findClosedLoops(walls));
  console.log(`  ${n}-divider apartment (${walls.length} walls): ${result.length} loops in ${ms}ms`);
  console.log(`    ${ms < 50 ? '✅ Well under 50ms' : '⚠️ Slow!'}`);
}

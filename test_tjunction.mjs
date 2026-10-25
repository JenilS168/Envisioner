// Quick unit test for T-junction split in findClosedLoops
import { findClosedLoops } from './src/utils/geometry.js';

let passed = 0;
let failed = 0;

function check(label, actual, expected) {
  if (actual === expected) {
    console.log(`  ✅ ${label}: ${actual}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}: expected ${expected}, got ${actual}`);
    failed++;
  }
}

// Test 1: Two rooms with shared endpoint walls (no T-junction needed)
// A--B  C
// |  |  |
// D--E--F
// Dividing wall goes B->E, sharing endpoints with outer walls
const walls1 = [
  { id: 'w1', start: {x:0,y:0}, end: {x:3,y:0} },
  { id: 'w2', start: {x:3,y:0}, end: {x:6,y:0} },
  { id: 'w3', start: {x:6,y:0}, end: {x:6,y:4} },
  { id: 'w4', start: {x:6,y:4}, end: {x:0,y:4} },
  { id: 'w5', start: {x:0,y:4}, end: {x:0,y:0} },
  { id: 'w6', start: {x:3,y:0}, end: {x:3,y:4} }, // divider shares endpoints — no T-junction
];
console.log('\nTest 1 (shared endpoints, no T-junction):');
const loops1 = findClosedLoops(walls1);
// Expected: left rect, right rect, outer (which has 6 vertices)
check('loop count >=2', loops1.length >= 2, true);

// Test 2: THE BUG CASE — outer walls are FULL width, dividing wall hits their MIDPOINTS
// This creates T-junctions: (3,0) on wall_top=(0,0)-(6,0) and (3,4) on wall_bottom=(6,4)-(0,4)
const walls2 = [
  { id: 'top',    start: {x:0,y:0}, end: {x:6,y:0} }, // no vertex at x=3!
  { id: 'right',  start: {x:6,y:0}, end: {x:6,y:4} },
  { id: 'bottom', start: {x:6,y:4}, end: {x:0,y:4} }, // no vertex at x=3!
  { id: 'left',   start: {x:0,y:4}, end: {x:0,y:0} },
  { id: 'div',    start: {x:3,y:0}, end: {x:3,y:4} }, // T-junctions both ends!
];
console.log('\nTest 2 (T-junction — divider endpoints on outer walls):');
const loops2 = findClosedLoops(walls2);
check('loop count >=2 (both rooms detected)', loops2.length >= 2, true);
// Check there's a loop with area ~12 (left room: 3x4) and ~12 (right room: 3x4)
const areas2 = loops2.map(l => l.area).sort((a,b)=>a-b);
console.log('  Loop areas (sorted):', areas2.map(a=>a.toFixed(1)));
const hasLeftRoom = areas2.some(a => Math.abs(a - 12) < 0.5);
check('left room (3x4=12 m²) detected', hasLeftRoom, true);
const hasRightRoom = areas2.filter(a => Math.abs(a - 12) < 0.5).length >= 2;
check('right room (3x4=12 m²) also detected', hasRightRoom, true);

// Test 3: Simple square — no regression
const walls3 = [
  { id: 'w1', start: {x:0,y:0}, end: {x:4,y:0} },
  { id: 'w2', start: {x:4,y:0}, end: {x:4,y:3} },
  { id: 'w3', start: {x:4,y:3}, end: {x:0,y:3} },
  { id: 'w4', start: {x:0,y:3}, end: {x:0,y:0} },
];
console.log('\nTest 3 (simple square — regression):');
const loops3 = findClosedLoops(walls3);
check('exactly 1 loop', loops3.length, 1);
check('area ~12 (4x3)', Math.abs((loops3[0]?.area ?? 0) - 12) < 0.5, true);

// Test 4: Three rooms via two T-junction dividers
const walls4 = [
  { id: 'top',    start: {x:0,y:0}, end: {x:9,y:0} },
  { id: 'right',  start: {x:9,y:0}, end: {x:9,y:4} },
  { id: 'bottom', start: {x:9,y:4}, end: {x:0,y:4} },
  { id: 'left',   start: {x:0,y:4}, end: {x:0,y:0} },
  { id: 'div1',   start: {x:3,y:0}, end: {x:3,y:4} }, // T-junction at x=3
  { id: 'div2',   start: {x:6,y:0}, end: {x:6,y:4} }, // T-junction at x=6
];
console.log('\nTest 4 (two T-junction dividers — 3 rooms + outer):');
const loops4 = findClosedLoops(walls4);
const areas4 = loops4.map(l => l.area).sort((a,b)=>a-b);
console.log('  Loop areas (sorted):', areas4.map(a=>a.toFixed(1)));
check('at least 3 rooms detected', loops4.length >= 3, true);
const threeSmall = areas4.filter(a => Math.abs(a - 12) < 0.5);
check('three 3x4 rooms found', threeSmall.length >= 3, true);

// Test 5: Only 2 walls (edge case — too few)
const walls5 = [
  { id: 'w1', start: {x:0,y:0}, end: {x:4,y:0} },
  { id: 'w2', start: {x:4,y:0}, end: {x:4,y:3} },
];
console.log('\nTest 5 (edge case — only 2 walls):');
const loops5 = findClosedLoops(walls5);
check('returns [] for <3 edges', loops5.length, 0);

console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed out of ${passed+failed} assertions.`);
if (failed > 0) process.exit(1);

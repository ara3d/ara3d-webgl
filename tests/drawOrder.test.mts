/**
 * Standalone test for sortDrawsFrontToBack.
 *
 * Usage:
 *   npx esbuild tests/drawOrder.test.mts --bundle --platform=node --format=cjs --outfile=out/drawOrder.test.cjs
 *   node out/drawOrder.test.cjs
 */
import { sortDrawsFrontToBack } from '../src/gpu/drawOrder'
import { DRAW_COMMAND_WORDS } from '../src/gpu/gpuScene'

function assert (cond: boolean, msg: string): void {
  if (!cond) throw new Error('FAIL: ' + msg)
}

/** Builds parallel arrays for `n` slots where slot i's center is (centers[i], 0, 0). */
function makeScene (centers: number[]) {
  const n = centers.length
  const drawCommands = new Uint32Array(n * DRAW_COMMAND_WORDS)
  const instanceSpheres = new Float32Array(n * 4)
  const instanceIds = new Uint32Array(n)
  for (let i = 0; i < n; i++) {
    for (let w = 0; w < DRAW_COMMAND_WORDS; w++) {
      drawCommands[i * DRAW_COMMAND_WORDS + w] = i * 10 + w
    }
    instanceSpheres[i * 4] = centers[i]
    instanceSpheres[i * 4 + 3] = i + 0.5 // radius, just a per-slot marker
    instanceIds[i] = 1000 + i
  }
  return { drawCommands, instanceSpheres, instanceIds }
}

/** The original slot index each slot's data came from, recovered from instanceIds. */
const slotOrigin = (ids: Uint32Array, i: number) => ids[i] - 1000

function checkSlotConsistent (s: ReturnType<typeof makeScene>, i: number): void {
  const o = slotOrigin(s.instanceIds, i)
  for (let w = 0; w < DRAW_COMMAND_WORDS; w++) {
    assert(s.drawCommands[i * DRAW_COMMAND_WORDS + w] === o * 10 + w,
      `slot ${i}: drawCommands word ${w} moved with the wrong slot`)
  }
  assert(s.instanceSpheres[i * 4 + 3] === o + 0.5,
    `slot ${i}: sphere did not move with its command`)
}

const eye = { x: 0, y: 0, z: 0 }

// Sorts a shuffled range, permuting all three arrays consistently,
// and leaves slots outside the range untouched.
{
  const centers = [99, 5, 1, 4, 2, 3, -99] // slots 1..5 are the range
  const s = makeScene(centers)
  const changed = sortDrawsFrontToBack(
    s.drawCommands, s.instanceSpheres, s.instanceIds, { first: 1, count: 5 }, eye)
  assert(changed === true, 'shuffled range should report a change')
  for (let i = 1; i <= 5; i++) {
    assert(s.instanceSpheres[i * 4] === i, `slot ${i} should hold center ${i}`)
    checkSlotConsistent(s, i)
  }
  assert(slotOrigin(s.instanceIds, 0) === 0, 'slot before range must not move')
  assert(slotOrigin(s.instanceIds, 6) === 6, 'slot after range must not move')
  checkSlotConsistent(s, 0)
  checkSlotConsistent(s, 6)
}

// Returns false on an already-sorted range and changes nothing.
{
  const s = makeScene([1, 2, 3, 4])
  const before = s.drawCommands.slice()
  const changed = sortDrawsFrontToBack(
    s.drawCommands, s.instanceSpheres, s.instanceIds, { first: 0, count: 4 }, eye)
  assert(changed === false, 'sorted range should report no change')
  assert(before.every((v, i) => v === s.drawCommands[i]), 'sorted range must not be touched')
}

// Equal distances count as sorted.
{
  const s = makeScene([2, 2, 2])
  const changed = sortDrawsFrontToBack(
    s.drawCommands, s.instanceSpheres, s.instanceIds, { first: 0, count: 3 }, eye)
  assert(changed === false, 'equal keys should report no change')
}

// Count 0 and 1.
{
  const s = makeScene([5, 1])
  assert(sortDrawsFrontToBack(s.drawCommands, s.instanceSpheres, s.instanceIds,
    { first: 0, count: 0 }, eye) === false, 'count 0 should report no change')
  assert(sortDrawsFrontToBack(s.drawCommands, s.instanceSpheres, s.instanceIds,
    { first: 0, count: 1 }, eye) === false, 'count 1 should report no change')
  assert(slotOrigin(s.instanceIds, 0) === 0 && slotOrigin(s.instanceIds, 1) === 1,
    'count 0/1 must not move anything')
}

// Distance uses the actual eye position, not the origin.
{
  const s = makeScene([0, 10]) // eye at x=10: slot 1 is nearer
  const changed = sortDrawsFrontToBack(
    s.drawCommands, s.instanceSpheres, s.instanceIds, { first: 0, count: 2 },
    { x: 10, y: 0, z: 0 })
  assert(changed === true, 'eye offset should reorder')
  assert(s.instanceSpheres[0] === 10 && s.instanceSpheres[4] === 0,
    'nearest-to-eye slot must come first')
  checkSlotConsistent(s, 0)
  checkSlotConsistent(s, 1)
}

// Rough timing on 100k shuffled slots.
{
  const n = 100_000
  const centers = new Array<number>(n)
  let seed = 12345
  for (let i = 0; i < n; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    centers[i] = seed % 1_000_000
  }
  const s = makeScene(centers)
  const start = performance.now()
  const changed = sortDrawsFrontToBack(
    s.drawCommands, s.instanceSpheres, s.instanceIds, { first: 0, count: n }, eye)
  const elapsed = performance.now() - start
  assert(changed === true, '100k shuffled slots should report a change')
  for (let i = 1; i < n; i++) {
    assert(s.instanceSpheres[i * 4] >= s.instanceSpheres[(i - 1) * 4],
      `100k: slot ${i} out of order`)
  }
  checkSlotConsistent(s, 0)
  checkSlotConsistent(s, n - 1)
  console.log(`sorted 100k shuffled slots in ${elapsed.toFixed(1)} ms`)
  const again = performance.now()
  assert(sortDrawsFrontToBack(s.drawCommands, s.instanceSpheres, s.instanceIds,
    { first: 0, count: n }, eye) === false, '100k re-sort should report no change')
  console.log(`already-sorted early exit in ${(performance.now() - again).toFixed(1)} ms`)
}

console.log('drawOrder: all tests passed')

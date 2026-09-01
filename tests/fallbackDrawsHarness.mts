/**
 * Headless test for the fallback draw selection: the N largest instances a
 * renderer without multi-draw shows instead of freezing on millions of calls.
 *
 * Usage:
 *   node_modules/esbuild-windows-64/esbuild.exe tests/fallbackDrawsHarness.mts --bundle --platform=node --format=cjs --outfile=out/fallbackDraws.cjs
 *   node out/fallbackDraws.cjs
 */
import { selectLargestDraws } from '../src/gpu/fallbackDraws'
import { DRAW_COMMAND_WORDS, GpuScene } from '../src/gpu/gpuScene'

let failures = 0
const check = (ok: boolean, message: string) => {
  if (ok) return
  failures++
  console.log(`FAIL: ${message}`)
}

/** A scene with just the fields the selection reads; radii in slot order. */
function scene (radii: number[], opaqueCount: number): GpuScene {
  const n = radii.length
  const instanceSpheres = new Float32Array(n * 4)
  const drawCommands = new Uint32Array(n * DRAW_COMMAND_WORDS)
  for (let i = 0; i < n; i++) {
    instanceSpheres[i * 4 + 3] = radii[i]
    // Distinct values per word so a mixed-up copy is caught.
    for (let w = 0; w < DRAW_COMMAND_WORDS; w++) {
      drawCommands[i * DRAW_COMMAND_WORDS + w] = i * 10 + w
    }
    drawCommands[i * DRAW_COMMAND_WORDS + 4] = i // firstInstance = slot
  }
  return {
    instanceSpheres,
    drawCommands,
    opaque: { first: 0, count: opaqueCount },
    transparent: { first: opaqueCount, count: n - opaqueCount }
  } as GpuScene
}

/** The slots a selection's commands point at, read back from firstInstance. */
const slots = (commands: Uint32Array) => {
  const out: number[] = []
  for (let i = 4; i < commands.length; i += DRAW_COMMAND_WORDS) out.push(commands[i])
  return out
}

// A scene under the limit passes through untouched.
{
  const s = scene([5, 1, 9], 3)
  const r = selectLargestDraws(s, 10)
  check(r.commands === s.drawCommands && r.opaque === s.opaque && r.transparent === s.transparent,
    'a small scene should pass through untouched')
}

// The largest radii win, split correctly between opaque and transparent.
{
  const s = scene([5, 1, 9, 3, 8, 2], 4)
  const r = selectLargestDraws(s, 3)
  check(slots(r.commands).join() === '0,2,4', `picked slots ${slots(r.commands)}, expected 0,2,4`)
  check(r.opaque.first === 0 && r.opaque.count === 2, `opaque range ${JSON.stringify(r.opaque)}`)
  check(r.transparent.first === 2 && r.transparent.count === 1,
    `transparent range ${JSON.stringify(r.transparent)}`)
  const first = Array.from(r.commands.subarray(0, DRAW_COMMAND_WORDS))
  check(first.join() === '0,1,2,3,0', `command words copied wrong: ${first}`)
}

// Ties at the threshold fill up to the limit, in slot order.
{
  const r = selectLargestDraws(scene([4, 4, 4, 4, 4], 5), 3)
  check(slots(r.commands).join() === '0,1,2', `ties picked ${slots(r.commands)}, expected 0,1,2`)
  check(r.opaque.count === 3 && r.transparent.count === 0, 'tie ranges wrong')
}

// At scale: exactly the limit survives, and nothing dropped outranks a keeper.
{
  const n = 10000
  const limit = 1000
  const radii = Array.from({ length: n }, (_, i) => ((i * 2654435761) % 100000) / 7)
  const opaqueCount = 9000
  const r = selectLargestDraws(scene(radii, opaqueCount), limit)
  const kept = slots(r.commands)
  check(kept.length === limit, `kept ${kept.length}, expected ${limit}`)
  const keptSet = new Set(kept)
  const minKept = Math.min(...kept.map((s) => radii[s]))
  const maxDropped = Math.max(...radii.filter((_, s) => !keptSet.has(s)))
  check(minKept >= maxDropped, `dropped radius ${maxDropped} outranks kept ${minKept}`)
  const boundary = kept.findIndex((s) => s >= opaqueCount)
  const opaqueKept = boundary < 0 ? kept.length : boundary
  check(r.opaque.count === opaqueKept && r.transparent.count === kept.length - opaqueKept,
    `ranges ${JSON.stringify(r.opaque)} ${JSON.stringify(r.transparent)}, expected split at ${opaqueKept}`)
  check(kept.slice(0, opaqueKept).every((s) => s < opaqueCount) &&
    kept.slice(opaqueKept).every((s) => s >= opaqueCount),
  'opaque and transparent slots are interleaved')
}

console.log(failures === 0 ? 'All checks passed.' : `${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)

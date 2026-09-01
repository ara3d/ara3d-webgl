/**
 * Profiler for the .bfast load pipeline.
 * Splits the load into stages, repeats each one so the numbers are stable, and
 * benchmarks alternative implementations of the stages that dominate, so it is
 * clear what is worth changing before anything is changed.
 *
 * Usage:
 *   node_modules/esbuild-windows-64/esbuild.exe tests/bfastProfile.mts --bundle --platform=node --format=cjs --outfile=out/bfastProfile.cjs
 *   node --max-old-space-size=8192 --expose-gc out/bfastProfile.cjs <path-to.bfast> [repeats]
 */
import { openSync, readSync, readFileSync, closeSync, fstatSync } from 'fs'
import { basename } from 'path'
import { readBFast } from '../src/loader/bfast'
import {
  INSTANCE_FLOAT_STRIDE,
  MESH_SLICE_INTS,
  RenderModel,
  instanceAlpha,
  instanceCount,
  instanceHidden,
  instanceRows,
  instanceMeshIndex,
  readRenderModel,
  vertexCount
} from '../src/loader/renderModel'
import { buildGpuSceneFromModel, collectVisibleInstances } from '../src/gpu/buildGpuSceneFromModel'
import { INSTANCE_FLOATS } from '../src/gpu/gpuScene'
import { byteLength } from '../src/gpu/gpuBytes'

const mb = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1) + ' MB'
const ms = (t: number) => t.toFixed(1).padStart(9) + ' ms'

/** Runs `f` `repeats` times and reports the best and median run. */
function bench (name: string, repeats: number, f: () => unknown): number {
  const times: number[] = []
  for (let i = 0; i < repeats; i++) {
    const start = performance.now()
    f()
    times.push(performance.now() - start)
  }
  times.sort((a, b) => a - b)
  const best = times[0]
  const median = times[times.length >> 1]
  console.log(`${name.padEnd(38)} best ${ms(best)}   median ${ms(median)}`)
  return best
}

const heap = () => process.memoryUsage()

function reportMemory (label: string) {
  const m = heap()
  console.log(`${label.padEnd(38)} heap ${mb(m.heapUsed).padStart(10)}  rss ${mb(m.rss).padStart(10)}` +
    `  external ${mb(m.external).padStart(10)}  arrayBuffers ${mb(m.arrayBuffers).padStart(10)}`)
}

// ---------------------------------------------------------------------------
// Stage 1: getting the bytes into memory.
// ---------------------------------------------------------------------------

/** Reads the whole file into one buffer, the way a browser fetch would. */
const readWhole = (path: string) => readFileSync(path)

/** Reads only the header, to show what a range request would cost. */
function readHeaderOnly (path: string) {
  const fd = openSync(path, 'r')
  try {
    const head = Buffer.alloc(64 * 1024)
    readSync(fd, head, 0, head.length, 0)
    return { size: fstatSync(fd).size, head }
  } finally {
    closeSync(fd)
  }
}

// ---------------------------------------------------------------------------
// Stage 3 alternatives: selecting the instances that will be drawn.
// The shipped version pushes into two `number[]`, concatenates them, and copies
// the result into an Int32Array. These avoid the boxed arrays.
// ---------------------------------------------------------------------------

/** Two passes over the instances, writing straight into one typed array. */
function collectVisibleTyped (model: RenderModel): Int32Array {
  const count = instanceCount(model)
  const ints = model.instanceInts
  const slices = model.meshSlices

  let opaqueCount = 0
  let transparentCount = 0
  for (let i = 0; i < count; i++) {
    const r = i * INSTANCE_FLOAT_STRIDE
    const mesh = ints[r + 12]
    if (mesh < 0) continue
    if ((ints[r + 15] >>> 8) & 0x1) continue
    if (slices[mesh * MESH_SLICE_INTS + 3] === 0) continue
    if ((ints[r + 14] >>> 24) < 255) transparentCount++
    else opaqueCount++
  }

  const out = new Int32Array(opaqueCount + transparentCount)
  let o = 0
  let t = opaqueCount
  for (let i = 0; i < count; i++) {
    const r = i * INSTANCE_FLOAT_STRIDE
    const mesh = ints[r + 12]
    if (mesh < 0) continue
    if ((ints[r + 15] >>> 8) & 0x1) continue
    if (slices[mesh * MESH_SLICE_INTS + 3] === 0) continue
    if ((ints[r + 14] >>> 24) < 255) out[t++] = i
    else out[o++] = i
  }
  return out
}

// ---------------------------------------------------------------------------
// Stage 4: the per-instance work, measured one part at a time.
// ---------------------------------------------------------------------------

function benchInstanceParts (model: RenderModel, visible: Int32Array, repeats: number) {
  const n = visible.length
  const instanceData = new Float32Array(n * INSTANCE_FLOATS)
  const instanceSpheres = new Float32Array(n * 4)
  const drawCommands = new Uint32Array(n * 5)

  bench('  transforms only', repeats, () => {
    for (let slot = 0; slot < n; slot++) {
      instanceRows(model, visible[slot], instanceData, slot * INSTANCE_FLOATS)
    }
  })

  bench('  colors only', repeats, () => {
    const ints = model.instanceInts
    for (let slot = 0; slot < n; slot++) {
      const color = ints[visible[slot] * INSTANCE_FLOAT_STRIDE + 14]
      const base = slot * INSTANCE_FLOATS
      instanceData[base + 12] = (color & 0xff) / 255
      instanceData[base + 13] = ((color >>> 8) & 0xff) / 255
      instanceData[base + 14] = ((color >>> 16) & 0xff) / 255
      instanceData[base + 15] = ((color >>> 24) & 0xff) / 255
    }
  })

  bench('  bounding spheres only', repeats, () => {
    const b = model.instanceBounds
    for (let slot = 0; slot < n; slot++) {
      const o = visible[slot] * 6
      const hx = (b[o + 3] - b[o]) * 0.5
      const hy = (b[o + 4] - b[o + 1]) * 0.5
      const hz = (b[o + 5] - b[o + 2]) * 0.5
      instanceSpheres[slot * 4] = (b[o] + b[o + 3]) * 0.5
      instanceSpheres[slot * 4 + 1] = (b[o + 1] + b[o + 4]) * 0.5
      instanceSpheres[slot * 4 + 2] = (b[o + 2] + b[o + 5]) * 0.5
      instanceSpheres[slot * 4 + 3] = Math.sqrt(hx * hx + hy * hy + hz * hz)
    }
  })

  bench('  draw commands only', repeats, () => {
    const slices = model.meshSlices
    const ints = model.instanceInts
    for (let slot = 0; slot < n; slot++) {
      const s = ints[visible[slot] * INSTANCE_FLOAT_STRIDE + 12] * MESH_SLICE_INTS
      const cmd = slot * 5
      drawCommands[cmd] = slices[s + 3]
      drawCommands[cmd + 1] = 1
      drawCommands[cmd + 2] = slices[s + 2]
      drawCommands[cmd + 3] = slices[s]
      drawCommands[cmd + 4] = slot
    }
  })
}

// ---------------------------------------------------------------------------
// Stage 5: what the renderer has to hand to the GPU.
// `device.queue.writeBuffer` copies through a staging allocation, so a copy of
// each buffer is the floor on upload cost. Measured here as a memcpy.
// ---------------------------------------------------------------------------

function benchUpload (bytes: number, repeats: number) {
  const source = new Uint8Array(bytes)
  bench(`  memcpy ${mb(bytes)}`, repeats, () => {
    const dest = new Uint8Array(source.length)
    dest.set(source)
    return dest.length
  })
}

function profile (path: string, repeats: number) {
  console.log(`\n=== ${basename(path)} ===\n`)
  reportMemory('at start')

  console.log('\n--- reading the bytes ---')
  bench('read whole file', Math.min(repeats, 3), () => readWhole(path).byteLength)
  bench('read header only (64 KB)', repeats, () => readHeaderOnly(path).size)

  const file = readWhole(path)
  console.log(`\nfile size: ${mb(file.byteLength)}`)
  reportMemory('after read')

  console.log('\n--- parsing ---')
  bench('parse bfast header', repeats,
    () => readBFast(file.buffer as ArrayBuffer, file.byteOffset).buffers.length)
  const bfast = readBFast(file.buffer as ArrayBuffer, file.byteOffset)

  bench('decode render model', repeats, () => readRenderModel(bfast).floatsPerVertex)
  const model = readRenderModel(bfast)

  console.log(`\nvertices ${vertexCount(model)}, indices ${model.indices.length}, ` +
    `meshes ${model.meshSlices.length / MESH_SLICE_INTS}, instances ${instanceCount(model)}`)

  console.log('\n--- building the scene ---')
  const whole = bench('buildGpuSceneFromModel (whole)', repeats, () => buildGpuSceneFromModel(model))

  const shipped = bench('  collectVisibleInstances (arrays)', repeats,
    () => collectVisibleInstances(model).length)
  const typed = bench('  collectVisibleInstances (typed)', repeats,
    () => collectVisibleTyped(model).length)

  const visible = collectVisibleInstances(model)
  const alt = collectVisibleTyped(model)
  const same = visible.length === alt.length && visible.every((v, i) => v === alt[i])
  console.log(`  the two selections agree: ${same}`)
  console.log(`  visible instances: ${visible.length} of ${instanceCount(model)}`)

  benchInstanceParts(model, visible, repeats)

  console.log('\n--- what reaches the GPU ---')
  const scene = buildGpuSceneFromModel(model)
  const uploads: [string, number][] = [
    ['vertices', scene.vertices.buffers.reduce((n, b) => n + byteLength(b.bytes), 0)],
    ['indices', byteLength(scene.indices)],
    ['instances', scene.instanceData.byteLength],
    ['spheres', scene.instanceSpheres.byteLength],
    ['draw commands', scene.drawCommands.byteLength]
  ]
  let total = 0
  for (const [name, size] of uploads) {
    console.log(`  ${name.padEnd(16)} ${mb(size).padStart(10)}`)
    total += size
  }
  console.log(`  ${'total'.padEnd(16)} ${mb(total).padStart(10)}`)
  benchUpload(uploads[0][1], Math.min(repeats, 3))

  console.log('\n--- allocated by the scene build ---')
  const derived = scene.instanceData.byteLength + scene.instanceSpheres.byteLength +
    scene.instanceIds.byteLength + scene.drawCommands.byteLength
  console.log(`  derived buffers  ${mb(derived).padStart(10)}`)
  console.log(`  copied geometry  ${mb(0).padStart(10)}  (vertices and indices are views on the file)`)
  reportMemory('after build')

  console.log('\n--- summary ---')
  console.log(`  scene build accounts for ${ms(whole)} of the load`)
  console.log(`  instance selection is ${(shipped / whole * 100).toFixed(0)}% of that; ` +
    `the typed version would make it ${(typed / whole * 100).toFixed(0)}%`)
}

const [path, repeatsArg] = process.argv.slice(2)
if (!path) {
  console.error('Usage: node bfastProfile.cjs <path-to.bfast> [repeats]')
  process.exit(2)
}
profile(path, Number(repeatsArg) || 5)

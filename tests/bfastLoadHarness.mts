/**
 * Headless test and measurement harness for the .bfast render model loader.
 * Parses the container, decodes the render model, builds the GPU scene, and
 * checks the draw commands against the vertex and index buffers, all in Node
 * with no browser.
 *
 * Usage (bundle first, to match tests/bosLoadHarness.mts):
 *   npx esbuild tests/bfastLoadHarness.mts --bundle --platform=node --format=cjs --outfile=out/bfastHarness.cjs
 *   node --max-old-space-size=8192 out/bfastHarness.cjs <path-to.bfast ...>
 */
import { readFileSync } from 'fs'
import { basename } from 'path'
import { readBFast } from '../src/loader/bfast'
import {
  MESH_SLICE_INTS,
  RenderModel,
  instanceCount,
  isRenderModel,
  meshCount,
  readRenderModel,
  vertexCount
} from '../src/loader/renderModel'
import { buildGpuSceneFromModel } from '../src/gpu/buildGpuSceneFromModel'
import { DRAW_COMMAND_WORDS, GpuScene, drawCount } from '../src/gpu/gpuScene'
import { byteLength } from '../src/gpu/gpuBytes'

type StageTimings = Record<string, number>

function timed<T> (timings: StageTimings, name: string, f: () => T): T {
  const start = performance.now()
  const result = f()
  timings[name] = performance.now() - start
  return result
}

const mb = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1) + ' MB'
const ms = (t: number) => t.toFixed(0) + ' ms'
const fmt3 = (v: ArrayLike<number>) =>
  `(${v[0].toFixed(1)}, ${v[1].toFixed(1)}, ${v[2].toFixed(1)})`

let failures = 0
function check (condition: boolean, message: string) {
  if (condition) return
  failures++
  console.log(`FAIL: ${message}`)
}

/** Every draw command must address vertices and indices that exist. */
function checkDrawCommands (model: RenderModel, scene: GpuScene) {
  const draws = drawCount(scene)
  const vertices = vertexCount(model)
  const indices = model.indices.length
  let badRange = 0
  let badIndex = 0
  let emptyDraw = 0

  for (let d = 0; d < draws; d++) {
    const c = d * DRAW_COMMAND_WORDS
    const indexCount = scene.drawCommands[c]
    const firstIndex = scene.drawCommands[c + 2]
    const baseVertex = scene.drawCommands[c + 3]

    if (indexCount === 0) emptyDraw++
    if (indexCount % 3 !== 0) badRange++
    if (firstIndex + indexCount > indices) badRange++
    if (baseVertex > vertices) badRange++
  }

  // Indices are mesh local, so spot check a sample of slices rather than all.
  const meshes = meshCount(model)
  const step = Math.max(1, Math.floor(meshes / 1000))
  for (let m = 0; m < meshes; m += step) {
    const s = m * MESH_SLICE_INTS
    const baseVertex = model.meshSlices[s]
    const sliceVertices = model.meshSlices[s + 1]
    const firstIndex = model.meshSlices[s + 2]
    const indexCount = model.meshSlices[s + 3]
    if (baseVertex + sliceVertices > vertices) { badRange++; continue }
    for (let k = 0; k < indexCount; k++) {
      if (model.indices[firstIndex + k] >= sliceVertices) { badIndex++; break }
    }
  }

  check(badRange === 0, `${badRange} draw commands or mesh slices point outside their buffers`)
  check(badIndex === 0, `${badIndex} sampled mesh slices contain out of range indices`)
  check(emptyDraw === 0, `${emptyDraw} draw commands have no indices`)
  check(draws > 0, 'the scene has no draw commands')
}

/** Instance transforms must be finite, and the scene bounds must be real numbers. */
function checkScene (scene: GpuScene) {
  const bad = [...scene.instanceData].findIndex((v) => !isFinite(v))
  check(bad < 0, `instance data has a non-finite value at ${bad}`)
  check(scene.boundsMin.every(isFinite) && scene.boundsMax.every(isFinite),
    'scene bounds are not finite')
  check(scene.opaque.count + scene.transparent.count === drawCount(scene),
    'opaque and transparent ranges do not cover every draw')
}

function loadAndMeasure (path: string) {
  console.log(`\n=== ${basename(path)} ===`)
  const timings: StageTimings = {}

  const file = timed(timings, 'read file', () => readFileSync(path))
  console.log(`file size: ${mb(file.byteLength)}`)

  // Parsed in place: readBFast takes the offset rather than a copied slice.
  const bfast = timed(timings, 'parse bfast',
    () => readBFast(file.buffer as ArrayBuffer, file.byteOffset))
  console.log('buffers: ' + bfast.buffers.map((b) => `${b.name} (${mb(b.bytes.byteLength)})`).join(', '))
  if (!isRenderModel(bfast)) {
    check(false, 'the file is not a render model')
    return
  }

  const model = timed(timings, 'read render model', () => readRenderModel(bfast))
  const scene = timed(timings, 'build gpu scene', () => buildGpuSceneFromModel(model))
  timed(timings, 'validate', () => { checkDrawCommands(model, scene); checkScene(scene) })

  console.log('\n--- timings ---')
  for (const [name, t] of Object.entries(timings)) console.log(`${name}: ${ms(t)}`)
  console.log(`total: ${ms(Object.values(timings).reduce((a, b) => a + b, 0))}`)

  console.log('\n--- model ---')
  console.log(`vertices: ${vertexCount(model)} (${model.floatsPerVertex} floats each)`)
  console.log(`indices: ${model.indices.length}`)
  console.log(`meshes: ${meshCount(model)}`)
  console.log(`instances: ${instanceCount(model)}`)
  console.log(`primitive size: ${model.meta.primitiveSize}, flags: ${model.meta.flags}`)
  console.log(`file bounds min: ${fmt3(model.meta.boundsMin)} max: ${fmt3(model.meta.boundsMax)}`)
  console.log(`file totals: ${model.meta.totalVertexCount} vertices, ${model.meta.totalFaceCount} faces`)

  console.log('\n--- scene ---')
  console.log(`draw commands: ${drawCount(scene)} (opaque ${scene.opaque.count}, transparent ${scene.transparent.count})`)
  console.log(`triangles: ${scene.triangleCount}`)
  console.log(`vertex buffers: ${scene.vertices.buffers.length}, format ${scene.vertices.format}, scale ${scene.vertices.scale}`)
  console.log(`bounds min: ${fmt3(scene.boundsMin)} max: ${fmt3(scene.boundsMax)}`)

  const upload =
    scene.vertices.buffers.reduce((n, b) => n + byteLength(b.bytes), 0) +
    byteLength(scene.indices) + scene.instanceData.byteLength +
    scene.instanceSpheres.byteLength + scene.drawCommands.byteLength
  console.log(`bytes to upload: ${mb(upload)}`)

  const mem = process.memoryUsage()
  console.log(`heap used: ${mb(mem.heapUsed)}, rss: ${mb(mem.rss)}`)
}

const paths = process.argv.slice(2)
if (paths.length === 0) {
  console.error('Usage: node bfastHarness.cjs <path-to.bfast ...>')
  process.exit(2)
}

for (const path of paths) loadAndMeasure(path)
console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)

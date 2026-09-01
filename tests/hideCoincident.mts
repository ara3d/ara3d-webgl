/**
 * Marks coincident duplicate instances hidden, BFAST in, BFAST out.
 *
 * BIM exports often contain the same geometry twice in the same place under
 * different element ids, which z-fights badly when the copies have different
 * materials. The duplicates are not removed, because their element ids must
 * stay addressable; instead all but one of each coincident group get the
 * instance hidden flag, which the scene builders already skip.
 *
 * Usage:
 *   npx esbuild tests/hideCoincident.mts --bundle --platform=node --format=cjs --outfile=out/hideCoincident.cjs
 *   node --max-old-space-size=8192 out/hideCoincident.cjs <in.bfast> <out.bfast>
 */
import { readFileSync, writeFileSync } from 'fs'
import { readBFast } from '../src/loader/bfast'
import {
  INSTANCE_FLOAT_STRIDE,
  INSTANCE_HIDDEN_FLAG,
  MESH_SLICE_INTS,
  RenderModel,
  instanceAlpha,
  instanceColor,
  instanceCount,
  instanceHidden,
  instanceMeshIndex,
  isRenderModel,
  readRenderModel
} from '../src/loader/renderModel'
import { writeBFast } from './writeBFast.mjs'

/** Model units within which two world space vertices count as coincident. */
const EPSILON = 1e-3

/** True when both instances share the exact 12 float transform. */
function sameTransform (model: RenderModel, a: number, b: number): boolean {
  const f = model.instanceFloats
  const ra = a * INSTANCE_FLOAT_STRIDE
  const rb = b * INSTANCE_FLOAT_STRIDE
  for (let k = 0; k < 12; k++) if (f[ra + k] !== f[rb + k]) return false
  return true
}

/** True when both mesh slices hold identical index and vertex bytes. */
function sameMeshGeometry (model: RenderModel, meshA: number, meshB: number): boolean {
  if (meshA === meshB) return true
  const s = model.meshSlices
  const a = meshA * MESH_SLICE_INTS
  const b = meshB * MESH_SLICE_INTS
  if (s[a + 1] !== s[b + 1] || s[a + 3] !== s[b + 3]) return false
  for (let k = 0; k < s[a + 3]; k++) {
    if (model.indices[s[a + 2] + k] !== model.indices[s[b + 2] + k]) return false
  }
  const fpv = model.floatsPerVertex
  const va = s[a] * fpv
  const vb = s[b] * fpv
  const n = s[a + 1] * fpv
  for (let k = 0; k < n; k++) {
    if (model.vertices[va + k] !== model.vertices[vb + k]) return false
  }
  return true
}

/**
 * True when both instances produce the same world space triangles within
 * EPSILON: equal index arrays, and every vertex lands on its counterpart
 * after each instance's own transform. Catches copies whose translation was
 * baked into the vertices instead of the transform.
 */
function sameWorldGeometry (model: RenderModel, a: number, b: number): boolean {
  const s = model.meshSlices
  const ma = instanceMeshIndex(model, a) * MESH_SLICE_INTS
  const mb = instanceMeshIndex(model, b) * MESH_SLICE_INTS
  if (s[ma + 1] !== s[mb + 1] || s[ma + 3] !== s[mb + 3]) return false
  for (let k = 0; k < s[ma + 3]; k++) {
    if (model.indices[s[ma + 2] + k] !== model.indices[s[mb + 2] + k]) return false
  }

  const f = model.instanceFloats
  const ra = a * INSTANCE_FLOAT_STRIDE
  const rb = b * INSTANCE_FLOAT_STRIDE
  const fpv = model.floatsPerVertex
  const va = s[ma] * fpv
  const vb = s[mb] * fpv
  const v = model.vertices
  for (let k = 0; k < s[ma + 1]; k++) {
    const xa = v[va + k * fpv]; const ya = v[va + k * fpv + 1]; const za = v[va + k * fpv + 2]
    const xb = v[vb + k * fpv]; const yb = v[vb + k * fpv + 1]; const zb = v[vb + k * fpv + 2]
    const dx = (f[ra] * xa + f[ra + 1] * ya + f[ra + 2] * za + f[ra + 3]) -
               (f[rb] * xb + f[rb + 1] * yb + f[rb + 2] * zb + f[rb + 3])
    const dy = (f[ra + 4] * xa + f[ra + 5] * ya + f[ra + 6] * za + f[ra + 7]) -
               (f[rb + 4] * xb + f[rb + 5] * yb + f[rb + 6] * zb + f[rb + 7])
    const dz = (f[ra + 8] * xa + f[ra + 9] * ya + f[ra + 10] * za + f[ra + 11]) -
               (f[rb + 8] * xb + f[rb + 9] * yb + f[rb + 10] * zb + f[rb + 11])
    if (dx * dx + dy * dy + dz * dz > EPSILON * EPSILON) return false
  }
  return true
}

/** Coincidence candidates: same index count and identical world space box. */
function candidateGroups (model: RenderModel): number[][] {
  const groups = new Map<string, number[]>()
  const count = instanceCount(model)
  for (let i = 0; i < count; i++) {
    const mesh = instanceMeshIndex(model, i)
    if (mesh < 0) continue
    const indexCount = model.meshSlices[mesh * MESH_SLICE_INTS + 3]
    if (indexCount === 0) continue
    const b = i * 6
    let key = indexCount + ''
    for (let k = 0; k < 6; k++) key += '|' + model.instanceBounds[b + k]
    const list = groups.get(key)
    if (list) list.push(i)
    else groups.set(key, [i])
  }
  return [...groups.values()].filter((g) => g.length > 1)
}

function hideCoincident (model: RenderModel) {
  const stats = {
    groups: 0,
    hiddenExact: 0,
    hiddenWorld: 0,
    unverified: 0,
    differentColor: 0,
    trianglesHidden: 0
  }

  for (const group of candidateGroups(model)) {
    const visible = group.filter((i) => !instanceHidden(model, i))
    if (visible.length < 2) continue
    stats.groups++

    // Keep an opaque instance when there is one, else the lowest index.
    const keeper = visible.find((i) => instanceAlpha(model, i) === 255) ?? visible[0]

    for (const i of visible) {
      if (i === keeper) continue
      const exact = sameTransform(model, keeper, i) &&
        sameMeshGeometry(model, instanceMeshIndex(model, keeper), instanceMeshIndex(model, i))
      if (exact) stats.hiddenExact++
      else if (sameWorldGeometry(model, keeper, i)) stats.hiddenWorld++
      else { stats.unverified++; continue }

      if (instanceColor(model, i) !== instanceColor(model, keeper)) stats.differentColor++
      const mesh = instanceMeshIndex(model, i)
      stats.trianglesHidden += model.meshSlices[mesh * MESH_SLICE_INTS + 3] / 3
      model.instanceInts[i * INSTANCE_FLOAT_STRIDE + 15] |= INSTANCE_HIDDEN_FLAG << 8
    }
  }
  return stats
}

const [input, output] = process.argv.slice(2)
if (!input || !output) {
  console.error('Usage: node hideCoincident.cjs <in.bfast> <out.bfast>')
  process.exit(2)
}

const file = readFileSync(input)
const bfast = readBFast(file.buffer as ArrayBuffer, file.byteOffset)
if (!isRenderModel(bfast)) {
  console.error(`${input} is not a render model.`)
  process.exit(1)
}

// The model views alias the file bytes, so setting flags on the model edits
// the buffers written back out; everything but InstanceData stays identical.
const model = readRenderModel(bfast)
const stats = hideCoincident(model)

console.log(`coincident groups: ${stats.groups}`)
console.log(`hidden: ${stats.hiddenExact + stats.hiddenWorld} of ${instanceCount(model)} instances ` +
  `(${stats.hiddenExact} identical, ${stats.hiddenWorld} matched within ${EPSILON} units)`)
console.log(`  with a different color than their keeper: ${stats.differentColor}`)
console.log(`  triangles no longer drawn: ${stats.trianglesHidden}`)
if (stats.unverified > 0) {
  console.log(`left visible, same bounds but different geometry: ${stats.unverified}`)
}

const out = writeBFast(bfast.buffers)
writeFileSync(output, out)
console.log(`Wrote ${output}: ${(out.byteLength / 1048576).toFixed(1)} MB`)

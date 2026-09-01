import { DRAW_COMMAND_WORDS, GpuScene, INSTANCE_FLOATS } from './gpuScene'
import { GpuBytes, cpuBytes } from './gpuBytes'
import { GpuVertices, interleavedVertices } from './gpuVertices'
import {
  MESH_SLICE_INTS,
  RenderModel,
  RenderModelTables,
  instanceAlpha,
  instanceColor,
  instanceHidden,
  instanceMatrix,
  instanceMeshIndex,
  instanceCount
} from '../loader/renderModel'

/** Flattens a render model held whole in memory. */
export const buildGpuSceneFromModel = (model: RenderModel): GpuScene =>
  buildGpuSceneFromTables(
    model,
    interleavedVertices(cpuBytes(model.vertices), model.floatsPerVertex),
    cpuBytes(model.indices))

/**
 * Flattens a BFAST render model into indirect draw buffers.
 * One draw command per visible instance, matching the BOS path, so both model
 * formats feed the same renderer and culler. The geometry is passed separately
 * because a streamed model has already handed it to the GPU.
 */
export function buildGpuSceneFromTables (
  model: RenderModelTables,
  vertices: GpuVertices,
  indices: GpuBytes
): GpuScene {
  console.time('Building GPU scene')

  if (model.meta.primitiveSize !== 3) {
    throw new Error(
      `Only triangle models can be rendered; this one has ${model.meta.primitiveSize} vertices per primitive.`)
  }

  const visible = collectVisibleInstances(model)
  const n = visible.length

  const instanceData = new Float32Array(n * INSTANCE_FLOATS)
  const instanceSpheres = new Float32Array(n * 4)
  const instanceIds = new Uint32Array(n)
  const drawCommands = new Uint32Array(n * DRAW_COMMAND_WORDS)

  let triangleCount = 0
  let minX = Infinity; let minY = Infinity; let minZ = Infinity
  let maxX = -Infinity; let maxY = -Infinity; let maxZ = -Infinity

  for (let slot = 0; slot < n; slot++) {
    const i = visible[slot]
    const base = slot * INSTANCE_FLOATS
    instanceMatrix(model, i, instanceData, base)

    const color = instanceColor(model, i)
    instanceData[base + 16] = (color & 0xff) / 255
    instanceData[base + 17] = ((color >>> 8) & 0xff) / 255
    instanceData[base + 18] = ((color >>> 16) & 0xff) / 255
    instanceData[base + 19] = ((color >>> 24) & 0xff) / 255

    // The file already carries a world space box per instance, so the sphere
    // needs no transform of the mesh bounds.
    const b = i * 6
    const cx = (model.instanceBounds[b] + model.instanceBounds[b + 3]) * 0.5
    const cy = (model.instanceBounds[b + 1] + model.instanceBounds[b + 4]) * 0.5
    const cz = (model.instanceBounds[b + 2] + model.instanceBounds[b + 5]) * 0.5
    const hx = (model.instanceBounds[b + 3] - model.instanceBounds[b]) * 0.5
    const hy = (model.instanceBounds[b + 4] - model.instanceBounds[b + 1]) * 0.5
    const hz = (model.instanceBounds[b + 5] - model.instanceBounds[b + 2]) * 0.5
    const radius = Math.sqrt(hx * hx + hy * hy + hz * hz)

    instanceSpheres[slot * 4 + 0] = cx
    instanceSpheres[slot * 4 + 1] = cy
    instanceSpheres[slot * 4 + 2] = cz
    instanceSpheres[slot * 4 + 3] = radius

    minX = Math.min(minX, cx - radius); maxX = Math.max(maxX, cx + radius)
    minY = Math.min(minY, cy - radius); maxY = Math.max(maxY, cy + radius)
    minZ = Math.min(minZ, cz - radius); maxZ = Math.max(maxZ, cz + radius)

    const slice = instanceMeshIndex(model, i) * MESH_SLICE_INTS
    const indexCount = model.meshSlices[slice + 3]

    const cmd = slot * DRAW_COMMAND_WORDS
    drawCommands[cmd + 0] = indexCount
    drawCommands[cmd + 1] = 1
    drawCommands[cmd + 2] = model.meshSlices[slice + 2]
    drawCommands[cmd + 3] = model.meshSlices[slice + 0]
    drawCommands[cmd + 4] = slot

    instanceIds[slot] = i
    triangleCount += indexCount / 3
  }

  const opaqueCount = countOpaque(instanceData, n)

  const scene: GpuScene = {
    vertices,
    indices,
    instanceData,
    instanceSpheres,
    instanceIds,
    drawCommands,
    opaque: { first: 0, count: opaqueCount },
    transparent: { first: opaqueCount, count: n - opaqueCount },
    triangleCount,
    ...sceneBounds(model, [minX, minY, minZ], [maxX, maxY, maxZ])
  }

  console.timeEnd('Building GPU scene')
  console.log(
    `GPU scene: ${n} draws, ${triangleCount} triangles, ${vertices.count} vertices`)
  return scene
}

type Bounds = [number, number, number]

/**
 * The file's own bounds have had outliers trimmed, which is what a camera
 * should frame; a stray instance far from the model would otherwise push the
 * whole scene into the distance. Falls back to the instance bounds when the
 * file's are empty or missing.
 */
function sceneBounds (model: RenderModelTables, min: Bounds, max: Bounds) {
  const { boundsMin, boundsMax } = model.meta
  const usable =
    boundsMin.every(isFinite) && boundsMax.every(isFinite) &&
    boundsMin.every((v, i) => v <= boundsMax[i])
  return usable
    ? { boundsMin, boundsMax }
    : { boundsMin: min, boundsMax: max }
}

/**
 * Instance slots in draw order: opaque instances first, then transparent ones,
 * so each group is a contiguous range of draw commands.
 */
export function collectVisibleInstances (model: RenderModelTables): Int32Array {
  const count = instanceCount(model)
  const opaque: number[] = []
  const transparent: number[] = []

  for (let i = 0; i < count; i++) {
    const mesh = instanceMeshIndex(model, i)
    if (mesh < 0) continue
    if (instanceHidden(model, i)) continue
    if (model.meshSlices[mesh * MESH_SLICE_INTS + 3] === 0) continue
    ;(instanceAlpha(model, i) < 255 ? transparent : opaque).push(i)
  }

  return Int32Array.from(opaque.concat(transparent))
}

const countOpaque = (instanceData: Float32Array, n: number) => {
  let count = 0
  while (count < n && instanceData[count * INSTANCE_FLOATS + 19] >= 1) count++
  return count
}

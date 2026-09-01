import * as THREE from 'three'
import { BimGeometry } from '../loader/bimGeometry'
import { computeMeshSpheres } from './meshBounds'
import { DRAW_COMMAND_WORDS, GpuScene, INSTANCE_ALPHA_FLOAT, INSTANCE_FLOATS } from './gpuScene'
import { columnVertices } from './gpuVertices'
import { cpuBytes } from './gpuBytes'

/** BOS stores vertex positions as integers multiplied by this. */
const VERTEX_MULTIPLIER = 10_000

/**
 * Flattens BOS geometry tables into indirect draw buffers.
 * One draw command per visible instance, so the whole model is a single
 * `multiDrawIndexedIndirect` call and every instance can be culled on its own.
 */
export function buildGpuScene (bg: BimGeometry): GpuScene {
  console.time('Building GPU scene')

  const vertexScale = 1 / VERTEX_MULTIPLIER
  const meshCount = bg.MeshVertexOffset.length
  const totalIndices = bg.IndexBuffer.length
  const totalVertices = bg.VertexX.length
  const meshSpheres = computeMeshSpheres(bg, vertexScale)

  const visible = collectVisibleInstances(bg)
  const n = visible.length

  const instanceData = new Float32Array(n * INSTANCE_FLOATS)
  const instanceSpheres = new Float32Array(n * 4)
  const instanceIds = new Uint32Array(n)
  const drawCommands = new Uint32Array(n * DRAW_COMMAND_WORDS)

  const matrix = new THREE.Matrix4()
  const position = new THREE.Vector3()
  const quaternion = new THREE.Quaternion()
  const scale = new THREE.Vector3()
  const center = new THREE.Vector3()

  let triangleCount = 0
  let minX = Infinity; let minY = Infinity; let minZ = Infinity
  let maxX = -Infinity; let maxY = -Infinity; let maxZ = -Infinity

  for (let slot = 0; slot < n; slot++) {
    const i = visible[slot]
    const mesh = bg.InstanceMeshIndex[i]
    const t = bg.InstanceTransformIndex[i]
    const mat = bg.InstanceMaterialIndex[i]

    position.set(bg.TransformTX[t], bg.TransformTY[t], bg.TransformTZ[t])
    quaternion.set(bg.TransformQX[t], bg.TransformQY[t], bg.TransformQZ[t], bg.TransformQW[t])
    scale.set(bg.TransformSX[t], bg.TransformSY[t], bg.TransformSZ[t])
    matrix.compose(position, quaternion, scale)

    const base = slot * INSTANCE_FLOATS
    setInstanceRows(instanceData, base, matrix.elements)
    instanceData[base + 12] = bg.MaterialRed[mat] / 255
    instanceData[base + 13] = bg.MaterialGreen[mat] / 255
    instanceData[base + 14] = bg.MaterialBlue[mat] / 255
    instanceData[base + 15] = bg.MaterialAlpha[mat] / 255

    center
      .set(meshSpheres[mesh * 4], meshSpheres[mesh * 4 + 1], meshSpheres[mesh * 4 + 2])
      .applyMatrix4(matrix)
    const radius = meshSpheres[mesh * 4 + 3] * maxAbs(scale)

    instanceSpheres[slot * 4 + 0] = center.x
    instanceSpheres[slot * 4 + 1] = center.y
    instanceSpheres[slot * 4 + 2] = center.z
    instanceSpheres[slot * 4 + 3] = radius

    minX = Math.min(minX, center.x - radius); maxX = Math.max(maxX, center.x + radius)
    minY = Math.min(minY, center.y - radius); maxY = Math.max(maxY, center.y + radius)
    minZ = Math.min(minZ, center.z - radius); maxZ = Math.max(maxZ, center.z + radius)

    const firstIndex = bg.MeshIndexOffset[mesh]
    const indexCount =
            (mesh + 1 < meshCount ? bg.MeshIndexOffset[mesh + 1] : totalIndices) - firstIndex

    const cmd = slot * DRAW_COMMAND_WORDS
    drawCommands[cmd + 0] = indexCount
    drawCommands[cmd + 1] = 1
    drawCommands[cmd + 2] = firstIndex
    drawCommands[cmd + 3] = bg.MeshVertexOffset[mesh]
    drawCommands[cmd + 4] = slot

    instanceIds[slot] = i
    triangleCount += indexCount / 3
  }

  const opaqueCount = countOpaque(instanceData, n)

  const scene: GpuScene = {
    vertices: columnVertices(bg.VertexX, bg.VertexY, bg.VertexZ, vertexScale),
    indices: cpuBytes(new Uint32Array(bg.IndexBuffer.buffer, bg.IndexBuffer.byteOffset, totalIndices)),
    instanceData,
    instanceSpheres,
    instanceIds,
    drawCommands,
    opaque: { first: 0, count: opaqueCount },
    transparent: { first: opaqueCount, count: n - opaqueCount },
    triangleCount,
    boundsMin: [minX, minY, minZ],
    boundsMax: [maxX, maxY, maxZ]
  }

  console.timeEnd('Building GPU scene')
  console.log(
        `GPU scene: ${n} draws, ${triangleCount} triangles, ${totalVertices} vertices`
  )
  return scene
}

/** Writes a column-major 4x4 as the three rows of a 3x4, the instance record layout. */
function setInstanceRows (out: Float32Array, at: number, e: number[] | Float32Array) {
  for (let row = 0; row < 3; row++) {
    out[at + row * 4 + 0] = e[row]
    out[at + row * 4 + 1] = e[4 + row]
    out[at + row * 4 + 2] = e[8 + row]
    out[at + row * 4 + 3] = e[12 + row]
  }
}

const maxAbs = (v: THREE.Vector3) =>
  Math.max(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z))

/**
 * Instance slots in draw order: opaque instances first, then transparent ones,
 * so each group is a contiguous range of draw commands.
 */
function collectVisibleInstances (bg: BimGeometry): Int32Array {
  const count = bg.InstanceMeshIndex.length
  const opaque: number[] = []
  const transparent: number[] = []

  for (let i = 0; i < count; i++) {
    const mesh = bg.InstanceMeshIndex[i]
    if (mesh < 0) continue
    if (bg.InstanceFlags[i] & 0x1) continue

    const meshCount = bg.MeshVertexOffset.length
    const firstIndex = bg.MeshIndexOffset[mesh]
    const nextIndex = mesh + 1 < meshCount ? bg.MeshIndexOffset[mesh + 1] : bg.IndexBuffer.length
    if (nextIndex <= firstIndex) continue

    const alpha = bg.MaterialAlpha[bg.InstanceMaterialIndex[i]]
    ;(alpha < 255 ? transparent : opaque).push(i)
  }

  return Int32Array.from(opaque.concat(transparent))
}

const countOpaque = (instanceData: Float32Array, n: number) => {
  let count = 0
  while (count < n && instanceData[count * INSTANCE_FLOATS + INSTANCE_ALPHA_FLOAT] >= 1) count++
  return count
}

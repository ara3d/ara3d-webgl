import { BFast } from './bfast'

/**
 * The geometry payload of an Ara 3D `.bfast` model: interleaved float vertices,
 * a shared index buffer, mesh slices into both, and 64 byte instance records.
 * Every array is a view on the file, so reading one copies nothing.
 */

/** Ints per mesh slice: baseVertex, vertexCount, firstIndex, indexCount. */
export const MESH_SLICE_INTS = 4

/** Bytes per instance record. */
export const INSTANCE_BYTES = 64

/** Floats per instance record: three rows of the 3x4 transform, then packed data. */
export const INSTANCE_FLOAT_STRIDE = INSTANCE_BYTES / 4

/** Instance is not drawn. */
export const INSTANCE_HIDDEN_FLAG = 0x1

/** Sentinel mesh index of an instance with no geometry. */
export const NO_MESH_INDEX = -1

/** Set when each vertex carries an RGB colour after its position. */
export const VERTEX_COLORS_FLAG = 0x1

export type RenderModelMeta = {
    boundsMin: [number, number, number];
    boundsMax: [number, number, number];
    totalVertexCount: number;
    totalFaceCount: number;
    /** Vertices per primitive: 2 for lines, 3 for triangles, 4 for quads. */
    primitiveSize: number;
    flags: number;
}

/**
 * Everything except the vertex and index buffers. These tables are small even
 * for a very large model, which is what lets the geometry go straight to the
 * GPU while the scene is built from what is left.
 */
export type RenderModelTables = {
    floatsPerVertex: number;
    /** `MESH_SLICE_INTS` per mesh. */
    meshSlices: Int32Array;
    /** `INSTANCE_FLOAT_STRIDE` floats per instance; see `instanceMatrix`. */
    instanceFloats: Float32Array;
    /** The same instance records read as integers, for the index and colour fields. */
    instanceInts: Int32Array;
    /** Local space AABB per mesh: min xyz then max xyz. */
    meshBounds: Float32Array;
    /** World space AABB per instance: min xyz then max xyz. */
    instanceBounds: Float32Array;
    meta: RenderModelMeta;
}

/** The tables plus the geometry, for a model read whole from memory. */
export type RenderModel = RenderModelTables & {
    /** Interleaved vertex data, `floatsPerVertex` floats per vertex. */
    vertices: Float32Array;
    /** Indices are local to their mesh slice; the slice supplies the base vertex. */
    indices: Uint32Array;
}

export const meshCount = (m: RenderModelTables) => m.meshSlices.length / MESH_SLICE_INTS
export const instanceCount = (m: RenderModelTables) => m.instanceInts.length / INSTANCE_FLOAT_STRIDE
export const vertexCount = (m: RenderModel) => m.vertices.length / m.floatsPerVertex

/** Field offsets within one instance record, in 32-bit words. */
const MESH_INDEX_WORD = 12
const ENTITY_INDEX_WORD = 13
const PACKED_COLOR_WORD = 14
const FLAGS_WORD = 15

export const instanceMeshIndex = (m: RenderModelTables, i: number) =>
  m.instanceInts[i * INSTANCE_FLOAT_STRIDE + MESH_INDEX_WORD]

export const instanceEntityIndex = (m: RenderModelTables, i: number) =>
  m.instanceInts[i * INSTANCE_FLOAT_STRIDE + ENTITY_INDEX_WORD]

/** Byte 1 of the last word holds the flags; byte 0 is unused. */
export const instanceFlags = (m: RenderModelTables, i: number) =>
  (m.instanceInts[i * INSTANCE_FLOAT_STRIDE + FLAGS_WORD] >>> 8) & 0xff

export const instanceHidden = (m: RenderModelTables, i: number) =>
  (instanceFlags(m, i) & INSTANCE_HIDDEN_FLAG) !== 0

/** Packed RGBA, one byte per channel with red in the low byte. */
export const instanceColor = (m: RenderModelTables, i: number) =>
  m.instanceInts[i * INSTANCE_FLOAT_STRIDE + PACKED_COLOR_WORD] >>> 0

export const instanceAlpha = (m: RenderModelTables, i: number) =>
  (instanceColor(m, i) >>> 24) & 0xff

/**
 * Writes the instance transform into `out` as a column-major 4x4 matrix.
 * The file stores the three rows of a 3x4 matrix, with translation in the
 * fourth column of each row.
 */
export function instanceMatrix (m: RenderModelTables, i: number, out: Float32Array, at = 0): Float32Array {
  const f = m.instanceFloats
  const r = i * INSTANCE_FLOAT_STRIDE
  out[at + 0] = f[r + 0]; out[at + 1] = f[r + 4]; out[at + 2] = f[r + 8]; out[at + 3] = 0
  out[at + 4] = f[r + 1]; out[at + 5] = f[r + 5]; out[at + 6] = f[r + 9]; out[at + 7] = 0
  out[at + 8] = f[r + 2]; out[at + 9] = f[r + 6]; out[at + 10] = f[r + 10]; out[at + 11] = 0
  out[at + 12] = f[r + 3]; out[at + 13] = f[r + 7]; out[at + 14] = f[r + 11]; out[at + 15] = 1
  return out
}

/** Buffer names written by the Ara 3D render model serializer. */
export const RENDER_MODEL_BUFFERS = {
  vertices: 'VertexData',
  indices: 'IndexData',
  meshSlices: 'MeshSliceData',
  instances: 'InstanceData',
  meshBounds: 'MeshBoundsData',
  instanceBounds: 'InstanceBoundsData',
  meta: 'Meta'
} as const

/** True when `bfast` holds a render model rather than some other payload. */
export const isRenderModel = (bfast: BFast) =>
  Object.values(RENDER_MODEL_BUFFERS).every((n) => bfast.find(n) !== undefined)

/** How the tables are found: by name in a BFAST, or supplied by a streaming reader. */
export type BufferSource = (name: string) => Uint8Array

/** Reads everything but the geometry, so a caller holding only the tables can use it. */
export function readRenderModelTables (source: BufferSource): RenderModelTables {
  const B = RENDER_MODEL_BUFFERS
  const meta = readMeta(source(B.meta))
  const instanceBytes = source(B.instances)

  return {
    floatsPerVertex: (meta.flags & VERTEX_COLORS_FLAG) !== 0 ? 6 : 3,
    meshSlices: asInts(source(B.meshSlices), B.meshSlices),
    instanceFloats: asFloats(instanceBytes, B.instances),
    instanceInts: asInts(instanceBytes, B.instances),
    meshBounds: asFloats(source(B.meshBounds), B.meshBounds),
    instanceBounds: asFloats(source(B.instanceBounds), B.instanceBounds),
    meta
  }
}

/** Reads the render model buffers of a BFAST file into typed array views. */
export function readRenderModel (bfast: BFast): RenderModel {
  const B = RENDER_MODEL_BUFFERS
  return {
    ...readRenderModelTables((name) => bfast.get(name)),
    vertices: asFloats(bfast.get(B.vertices), B.vertices),
    indices: asUints(bfast.get(B.indices), B.indices)
  }
}

function readMeta (bytes: Uint8Array): RenderModelMeta {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return {
    boundsMin: [v.getFloat32(0, true), v.getFloat32(4, true), v.getFloat32(8, true)],
    boundsMax: [v.getFloat32(12, true), v.getFloat32(16, true), v.getFloat32(20, true)],
    totalVertexCount: Number(v.getBigInt64(24, true)),
    totalFaceCount: Number(v.getBigInt64(32, true)),
    primitiveSize: v.getInt32(40, true),
    flags: v.getInt32(44, true)
  }
}

/**
 * Typed array views need their offset aligned to the element size. BFAST aligns
 * every buffer to 64 bytes, so this only copies for a malformed file.
 */
function view<T> (
  bytes: Uint8Array,
  name: string,
  Ctor: { new(b: ArrayBufferLike, o: number, n: number): T; BYTES_PER_ELEMENT: number }
): T {
  const size = Ctor.BYTES_PER_ELEMENT
  if (bytes.byteLength % size !== 0) {
    throw new Error(`BFAST buffer "${name}" is ${bytes.byteLength} bytes, not a multiple of ${size}.`)
  }
  const aligned = bytes.byteOffset % size === 0 ? bytes : new Uint8Array(bytes)
  return new Ctor(aligned.buffer, aligned.byteOffset, aligned.byteLength / size)
}

const asFloats = (b: Uint8Array, name: string) => view(b, name, Float32Array)
const asInts = (b: Uint8Array, name: string) => view(b, name, Int32Array)
const asUints = (b: Uint8Array, name: string) => view(b, name, Uint32Array)

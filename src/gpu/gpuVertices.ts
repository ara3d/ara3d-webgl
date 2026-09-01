/**
 * How a scene's vertex positions are laid out for the vertex shader.
 * BOS models store x, y, z as three scaled integer columns; BFAST models store
 * them interleaved as floats. Both are described here so the renderer builds
 * its pipeline from the scene rather than assuming one layout.
 */
import { GpuBytes, byteLength, cpuBytes } from './gpuBytes'

/** Vertex attribute formats the scene shader can read positions from. */
export type GpuVertexFormat = 'sint32' | 'float32'

/** One buffer bound to a vertex slot, and the position components read from it. */
export type GpuVertexBuffer = {
    bytes: GpuBytes;
    /** Bytes between consecutive vertices. */
    stride: number;
    /** Byte offset of each component within a vertex, by shader location. */
    attributes: { shaderLocation: number; offset: number }[];
}

/** The vertex positions of a scene, in the form the renderer uploads. */
export type GpuVertices = {
    buffers: GpuVertexBuffer[];
    format: GpuVertexFormat;
    /** Multiply an attribute value by this to get model units. */
    scale: number;
    count: number;
}

/** Three scaled integer columns, one buffer per axis. */
export const columnVertices = (
  x: Int32Array, y: Int32Array, z: Int32Array, scale: number
): GpuVertices => ({
  buffers: [x, y, z].map((column, i) => ({
    bytes: cpuBytes(column),
    stride: 4,
    attributes: [{ shaderLocation: i, offset: 0 }]
  })),
  format: 'sint32',
  scale,
  count: x.length
})

/** Interleaved floats; `floatsPerVertex` may exceed 3 when colours follow. */
export const interleavedVertices = (
  bytes: GpuBytes, floatsPerVertex: number
): GpuVertices => ({
  buffers: [{
    bytes,
    stride: floatsPerVertex * 4,
    attributes: [0, 1, 2].map((shaderLocation) => ({ shaderLocation, offset: shaderLocation * 4 }))
  }],
  format: 'float32',
  scale: 1,
  count: byteLength(bytes) / (floatsPerVertex * 4)
})

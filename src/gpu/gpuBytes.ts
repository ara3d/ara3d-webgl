/**
 * Bytes headed for a GPU buffer. A scene built from a file in memory carries
 * typed arrays; a scene streamed from the network has already handed its
 * geometry to the GPU and carries the buffer instead, so the bytes never exist
 * as a JavaScript array.
 */
export type GpuBytes =
    | { readonly kind: 'cpu'; readonly data: ArrayBufferView }
    | { readonly kind: 'gpu'; readonly gpuBuffer: GPUBuffer; readonly byteLength: number }

/** Bytes still in memory, to be uploaded when the scene is set. */
export const cpuBytes = (data: ArrayBufferView): GpuBytes => ({ kind: 'cpu', data })

/**
 * Bytes already uploaded. The renderer takes ownership of the buffer with the
 * scene, and destroys it when the scene is replaced.
 */
export const gpuBytes = (gpuBuffer: GPUBuffer, byteLength: number): GpuBytes =>
  ({ kind: 'gpu', gpuBuffer, byteLength })

export const isUploaded = (b: GpuBytes) => b.kind === 'gpu'

export const byteLength = (b: GpuBytes): number =>
  b.kind === 'gpu' ? b.byteLength : b.data.byteLength

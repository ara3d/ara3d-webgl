/// <reference path="./webgpuMultiDraw.d.ts" />

/** Creates a GPU buffer holding a copy of `data`. */
export function createBuffer (
  device: GPUDevice,
  data: ArrayBufferView,
  usage: GPUBufferUsageFlags,
  label: string
): GPUBuffer {
  const buffer = device.createBuffer({
    label,
    size: align4(data.byteLength),
    usage: usage | GPUBufferUsage.COPY_DST
  })
  device.queue.writeBuffer(buffer, 0, data.buffer, data.byteOffset, data.byteLength)
  return buffer
}

/** Creates an empty buffer of `size` bytes. */
export const createEmptyBuffer = (
  device: GPUDevice,
  size: number,
  usage: GPUBufferUsageFlags,
  label: string
): GPUBuffer => device.createBuffer({ label, size: align4(size), usage })

export const align4 = (n: number) => (n + 3) & ~3

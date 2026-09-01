import { BFastRange } from '../loader/bfast'
import { BFastSink, BFastStreamReader, memorySink } from '../loader/bfastStream'
import {
  RENDER_MODEL_BUFFERS,
  readRenderModelTables
} from '../loader/renderModel'
import { buildGpuSceneFromTables } from './buildGpuSceneFromModel'
import { align4 } from './gpuBuffers'
import { gpuBufferSink } from './gpuBufferSink'
import { gpuBytes } from './gpuBytes'
import { GpuScene } from './gpuScene'
import { interleavedVertices } from './gpuVertices'

/**
 * Builds a scene from a stream of BFAST bytes, writing the vertex and index
 * buffers to the GPU as they arrive. Only the small tables are kept in memory,
 * so a model far larger than the tab's memory budget can still be loaded, and
 * the upload overlaps the download instead of following it.
 */
export async function streamGpuScene (
  device: GPUDevice,
  chunks: AsyncIterable<Uint8Array>
): Promise<GpuScene> {
  const B = RENDER_MODEL_BUFFERS
  const usage: Record<string, GPUBufferUsageFlags> = {
    [B.vertices]: GPUBufferUsage.VERTEX,
    [B.indices]: GPUBufferUsage.INDEX
  }

  const uploaded = new Map<string, { buffer: GPUBuffer; byteLength: number }>()
  const tables = new Map<string, Uint8Array>()

  const sinkFor = (range: BFastRange): BFastSink | undefined => {
    const size = range.end - range.begin
    const geometry = usage[range.name]
    if (geometry !== undefined) {
      const buffer = device.createBuffer({
        label: range.name,
        size: align4(size),
        usage: geometry | GPUBufferUsage.COPY_DST
      })
      uploaded.set(range.name, { buffer, byteLength: size })
      return gpuBufferSink(device, buffer)
    }
    const bytes = new Uint8Array(size)
    tables.set(range.name, bytes)
    return memorySink(bytes)
  }

  const reader = new BFastStreamReader(sinkFor)
  try {
    const stats = { waitMs: 0, pushMs: 0, chunks: 0, bytes: 0 }
    let mark = performance.now()
    for await (const chunk of chunks) {
      const arrived = performance.now()
      stats.waitMs += arrived - mark
      reader.push(chunk)
      mark = performance.now()
      stats.pushMs += mark - arrived
      stats.chunks++
      stats.bytes += chunk.length
    }
    reader.end()
    logStreamStats(stats)

    const model = readRenderModelTables((name) => {
      const bytes = tables.get(name)
      if (!bytes) {
        throw new Error(
          `The stream has no buffer named "${name}". Found: ${found(reader.ranges)}`)
      }
      return bytes
    })

    const vertices = need(uploaded, B.vertices, reader.ranges)
    const indices = need(uploaded, B.indices, reader.ranges)
    return buildGpuSceneFromTables(
      model,
      interleavedVertices(gpuBytes(vertices.buffer, vertices.byteLength), model.floatsPerVertex),
      gpuBytes(indices.buffer, indices.byteLength))
  } catch (e) {
    // Nothing owns the buffers until a scene is returned.
    for (const { buffer } of uploaded.values()) buffer.destroy()
    throw e
  }
}

/**
 * Says whether a streamed load spent its time waiting for bytes (network or
 * disk bound) or handing them to the GPU (CPU bound), to guide optimization.
 */
function logStreamStats (stats: { waitMs: number; pushMs: number; chunks: number; bytes: number }) {
  const { waitMs, pushMs, chunks, bytes } = stats
  const mb = bytes / (1024 * 1024)
  const totalS = (waitMs + pushMs) / 1000
  console.log(
    `Streamed ${mb.toFixed(1)} MB in ${totalS.toFixed(2)} s ` +
    `(${(mb / totalS).toFixed(0)} MB/s): ` +
    `${(waitMs / 1000).toFixed(2)} s awaiting bytes, ` +
    `${(pushMs / 1000).toFixed(2)} s pushing to GPU, ` +
    `${chunks} chunks averaging ${(bytes / chunks / 1024).toFixed(0)} KB`)
}

const found = (ranges: BFastRange[] | undefined) =>
  ranges ? ranges.map((r) => r.name).join(', ') : 'nothing, the header was never read'

function need (
  uploaded: Map<string, { buffer: GPUBuffer; byteLength: number }>,
  name: string,
  ranges: BFastRange[] | undefined
) {
  const found_ = uploaded.get(name)
  if (!found_) {
    throw new Error(`The stream has no buffer named "${name}". Found: ${found(ranges)}`)
  }
  return found_
}

/** Reads a `ReadableStream` of bytes as an async iterable, after a peeked prefix. */
export async function * streamChunks (
  reader: ReadableStreamDefaultReader<Uint8Array>,
  prefix: Uint8Array[] = []
): AsyncIterable<Uint8Array> {
  for (const p of prefix) yield p
  for (;;) {
    const { done, value } = await reader.read()
    if (done) return
    if (value) yield value
  }
}

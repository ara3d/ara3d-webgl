import JSZip from 'jszip'
import { BFAST_HEADER_PROBE, isBFast, readBFast } from '../loader/bfast'
import { isRenderModel, readRenderModel } from '../loader/renderModel'
import { loadBimGeometryFromZip } from '../loader/bimOpenSchemaLoader'
import { BimData } from '../loader/bimData'
import { buildGpuScene } from './buildGpuScene'
import { buildGpuSceneFromModel } from './buildGpuSceneFromModel'
import { GpuScene } from './gpuScene'
import { streamChunks, streamGpuScene } from './streamGpuScene'

/** A loaded model: the buffers the GPU renderer needs, plus the BOS tables when the file has them. */
export type GpuModel = {
    scene: GpuScene;
    /** Present for `.bos` files; `.bfast` render models carry geometry only. */
    bim?: BimData;
}

export type GpuModelLoaderOptions = {
    /**
     * Given a device, a `.bfast` is streamed into GPU buffers as it downloads
     * rather than read into memory first. This is faster and uses far less
     * memory, and is the only way to load a model larger than the tab can hold.
     */
    device?: GPUDevice;
}

/**
 * Loads a model straight into indirect draw buffers, choosing the reader from
 * the file's contents: a `.bfast` render model, or a `.bos` archive of parquet
 * tables whose vertex columns are uploaded as they are.
 *
 * A compressed response costs nothing extra here: the browser decodes it before
 * the loader sees a byte, so serving `.bfast` with `Content-Encoding: gzip` is
 * purely a win.
 */
export class GpuModelLoader {
  private readonly options: GpuModelLoaderOptions

  constructor (options: GpuModelLoaderOptions = {}) {
    this.options = options
  }

  async load (source: string): Promise<GpuModel> {
    const response = await fetch(source)
    if (!response.ok) {
      throw new Error(`Failed to fetch model from ${source}: ${response.status} ${response.statusText}`)
    }

    const device = this.options.device
    if (device && response.body) {
      return await loadFromStream(device, response.body.getReader())
    }
    return this.loadFromArrayBuffer(await response.arrayBuffer())
  }

  async loadFromFile (file: Blob): Promise<GpuModel> {
    const device = this.options.device
    if (device && typeof file.stream === 'function') {
      return await loadFromStream(device, file.stream().getReader())
    }
    return this.loadFromArrayBuffer(await file.arrayBuffer())
  }

  async loadFromArrayBuffer (buffer: ArrayBuffer): Promise<GpuModel> {
    return isBFast(buffer)
      ? { scene: loadBFastScene(buffer) }
      : await loadBosModel(buffer)
  }
}

/**
 * Reads enough of the stream to tell the formats apart, then either streams the
 * rest into GPU buffers or gathers it for the zip reader. Either way the body is
 * read once.
 */
async function loadFromStream (
  device: GPUDevice,
  reader: ReadableStreamDefaultReader<Uint8Array>
): Promise<GpuModel> {
  const { chunks, bytes, done } = await readAtLeast(reader, BFAST_HEADER_PROBE)
  const head = concat(chunks, bytes)

  if (isBFast(head.buffer, head.byteOffset)) {
    return { scene: await streamGpuScene(device, streamChunks(reader, [head])) }
  }

  const rest = done ? [] : (await readAll(reader)).chunks
  const whole = concat([head, ...rest], bytes + total(rest))
  return await loadBosModel(whole.buffer as ArrayBuffer)
}

/** Reads until `wanted` bytes are available or the stream ends. */
async function readAtLeast (reader: ReadableStreamDefaultReader<Uint8Array>, wanted: number) {
  const chunks: Uint8Array[] = []
  let bytes = 0
  while (bytes < wanted) {
    const { done, value } = await reader.read()
    if (done) return { chunks, bytes, done: true }
    if (value) { chunks.push(value); bytes += value.length }
  }
  return { chunks, bytes, done: false }
}

async function readAll (reader: ReadableStreamDefaultReader<Uint8Array>) {
  const chunks: Uint8Array[] = []
  for (;;) {
    const { done, value } = await reader.read()
    if (done) return { chunks }
    if (value) chunks.push(value)
  }
}

const total = (chunks: Uint8Array[]) => chunks.reduce((n, c) => n + c.length, 0)

const concat = (chunks: Uint8Array[], bytes: number): Uint8Array => {
  const out = new Uint8Array(bytes)
  let at = 0
  for (const c of chunks) { out.set(c, at); at += c.length }
  return out
}

/** Builds a scene from the bytes of a `.bfast` render model held in memory. */
export function loadBFastScene (buffer: ArrayBuffer): GpuScene {
  const bfast = readBFast(buffer)
  if (!isRenderModel(bfast)) {
    throw new Error(
      `This BFAST is not a render model. It contains: ${bfast.names.join(', ')}`)
  }
  return buildGpuSceneFromModel(readRenderModel(bfast))
}

async function loadBosModel (buffer: ArrayBuffer): Promise<GpuModel> {
  const zip = await JSZip.loadAsync(buffer)
  const bim = await loadBimGeometryFromZip(zip)
  return { bim, scene: buildGpuScene(bim.BimGeometry) }
}

/** File extensions {@link GpuModelLoader} can read. */
export const GPU_MODEL_EXTENSIONS = ['.bos', '.bfast']

export const isGpuModelFile = (name: string) =>
  GPU_MODEL_EXTENSIONS.some((e) => name.toLowerCase().endsWith(e))

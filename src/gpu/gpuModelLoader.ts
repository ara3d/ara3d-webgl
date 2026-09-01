import JSZip from 'jszip'
import { isBFast, readBFast } from '../loader/bfast'
import { isRenderModel, readRenderModel } from '../loader/renderModel'
import { loadBimGeometryFromZip } from '../loader/bimOpenSchemaLoader'
import { BimData } from '../loader/bimData'
import { buildGpuScene } from './buildGpuScene'
import { buildGpuSceneFromModel } from './buildGpuSceneFromModel'
import { GpuScene } from './gpuScene'

/** A loaded model: the buffers the GPU renderer needs, plus the BOS tables when the file has them. */
export type GpuModel = {
    scene: GpuScene;
    /** Present for `.bos` files; `.bfast` render models carry geometry only. */
    bim?: BimData;
}

/**
 * Loads a model straight into indirect draw buffers, choosing the reader from
 * the file's contents: a `.bfast` render model, or a `.bos` archive of parquet
 * tables whose vertex columns are uploaded as they are.
 */
export class GpuModelLoader {
  async load (source: string): Promise<GpuModel> {
    const response = await fetch(source)
    if (!response.ok) {
      throw new Error(`Failed to fetch model from ${source}: ${response.status} ${response.statusText}`)
    }
    return this.loadFromArrayBuffer(await response.arrayBuffer())
  }

  async loadFromFile (file: Blob): Promise<GpuModel> {
    return this.loadFromArrayBuffer(await file.arrayBuffer())
  }

  async loadFromArrayBuffer (buffer: ArrayBuffer): Promise<GpuModel> {
    return isBFast(buffer)
      ? { scene: loadBFastScene(buffer) }
      : await loadBosModel(buffer)
  }
}

/** Builds a scene from the bytes of a `.bfast` render model. */
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

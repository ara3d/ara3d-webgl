import JSZip from 'jszip'
import { loadBimGeometryFromZip } from '../loader/bimOpenSchemaLoader'
import { BimData } from '../loader/bimData'
import { buildGpuScene } from './buildGpuScene'
import { GpuScene } from './gpuScene'

/** A loaded model: the BOS tables plus the buffers the GPU renderer needs. */
export type BosGpuModel = {
    bim: BimData;
    scene: GpuScene;
}

/**
 * Loads a .bos file straight into indirect draw buffers.
 * Reuses the parquet reader of the Three.js loader, but skips building
 * BufferGeometry objects: the BOS vertex columns are uploaded as they are.
 */
export class BosGpuLoader {
  async load (source: string): Promise<BosGpuModel> {
    const response = await fetch(source)
    if (!response.ok) {
      throw new Error(`Failed to fetch BOS from ${source}: ${response.status} ${response.statusText}`)
    }
    return this.loadFromArrayBuffer(await response.arrayBuffer())
  }

  async loadFromFile (file: Blob): Promise<BosGpuModel> {
    return this.loadFromArrayBuffer(await file.arrayBuffer())
  }

  async loadFromArrayBuffer (buffer: ArrayBuffer): Promise<BosGpuModel> {
    const zip = await JSZip.loadAsync(buffer)
    const bim = await loadBimGeometryFromZip(zip)
    return { bim, scene: buildGpuScene(bim.BimGeometry) }
  }
}

/// <reference path="./webgpuMultiDraw.d.ts" />
import * as THREE from 'three'
import { createBuffer, createEmptyBuffer } from './gpuBuffers'
import { cullShader } from './shaders/cullShader'
import { writeFrustumPlanes } from './frustum'
import { pixelsPerUnitAtUnitDepth, writeDepthPlane } from './screenSize'
import { GpuScene, instanceCount } from './gpuScene'

const CULL_UNIFORM_BYTES = 208 // planes, counts, depth plane, limits, view-projection
const DEPTH_PLANE_FLOAT = 28 // byte 112
const LIMITS_FLOAT = 32 // byte 128
const VIEW_PROJ_FLOAT = 36 // byte 144
const WORKGROUP_SIZE = 64
const COUNTS_BYTES = 8 // one u32 per draw range

/** The depth pyramid the occlusion test reads; see `HiZPyramid`. */
export type CullPyramid = {
    view: GPUTextureView;
    width: number;
    height: number;
}

/** What the cull pass should test this frame. */
export type CullParams = {
    /** Test each bounding sphere against the frustum planes. */
    frustum: boolean;
    /** Drop instances projecting to less than this many pixels across. Zero disables. */
    minPixels: number;
    /** Viewport height in CSS pixels, so `minPixels` means what a viewer sees. */
    viewportHeight: number;
    /** Test each sphere against this depth pyramid. Absent disables. */
    pyramid?: CullPyramid;
}

/** Byte offset of a range's draw counter inside the counts buffer. */
export const OPAQUE_COUNT_OFFSET = 0
export const TRANSPARENT_COUNT_OFFSET = 4

/**
 * Compacts the indirect commands of the visible instances into a second buffer
 * each frame, and leaves the surviving count in a GPU buffer that
 * `multiDrawIndexedIndirect` can read as its draw count.
 */
export class GpuCuller {
  readonly visible: GPUBuffer
  readonly counts: GPUBuffer

  private readonly device: GPUDevice
  private readonly pipeline: GPUComputePipeline
  private bindGroup: GPUBindGroup
  private readonly dummyPyramid: GPUTexture
  private boundPyramid: GPUTextureView | undefined
  private readonly uniform: GPUBuffer
  private readonly uniformData = new Float32Array(CULL_UNIFORM_BYTES / 4)
  private readonly info: Uint32Array
  private readonly zeros = new Uint32Array(COUNTS_BYTES / 4)
  private readonly spheres: GPUBuffer
  private readonly readback: GPUBuffer
  private readonly groups: number

  private reading = false
  private lastCounts: [number, number] = [0, 0]

  constructor (device: GPUDevice, scene: GpuScene, source: GPUBuffer) {
    this.device = device
    const n = instanceCount(scene)
    this.groups = Math.ceil(n / WORKGROUP_SIZE)

    this.spheres = createBuffer(device, scene.instanceSpheres, GPUBufferUsage.STORAGE, 'spheres')
    this.visible = createEmptyBuffer(
      device,
      scene.drawCommands.byteLength,
      GPUBufferUsage.INDIRECT | GPUBufferUsage.STORAGE,
      'visibleCommands')
    this.counts = createEmptyBuffer(
      device,
      COUNTS_BYTES,
      GPUBufferUsage.INDIRECT | GPUBufferUsage.STORAGE |
            GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
      'drawCounts')
    this.readback = createEmptyBuffer(
      device, COUNTS_BYTES, GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST, 'countsReadback')

    this.uniform = createEmptyBuffer(
      device, CULL_UNIFORM_BYTES, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, 'cullUniform')

    this.info = new Uint32Array(this.uniformData.buffer, 96, 4)
    this.info[0] = n
    this.info[1] = scene.transparent.first

    this.pipeline = device.createComputePipeline({
      label: 'cull',
      layout: 'auto',
      compute: { module: device.createShaderModule({ label: 'cull', code: cullShader }), entryPoint: 'main' }
    })

    // The pyramid binding must always hold a texture; this stands in when the
    // occlusion test is off, and the uniform flag keeps it from being read.
    this.dummyPyramid = device.createTexture({
      label: 'dummy pyramid',
      size: [1, 1],
      format: 'r32float',
      usage: GPUTextureUsage.TEXTURE_BINDING
    })
    this.dummyView = this.dummyPyramid.createView()
    this.source = source
    this.bindGroup = this.createBindGroup(this.dummyView)
  }

  private readonly source: GPUBuffer
  private readonly dummyView: GPUTextureView

  private createBindGroup (pyramid: GPUTextureView): GPUBindGroup {
    return this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniform } },
        { binding: 1, resource: { buffer: this.spheres } },
        { binding: 2, resource: { buffer: this.source } },
        { binding: 3, resource: { buffer: this.visible } },
        { binding: 4, resource: { buffer: this.counts } },
        { binding: 5, resource: pyramid }
      ]
    })
  }

  /**
   * Re-uploads the bounding spheres after the caller permutes them, keeping
   * them parallel to the draw commands the cull shader indexes alongside.
   */
  writeSpheres (spheres: Float32Array) {
    this.device.queue.writeBuffer(
      this.spheres, 0, spheres.buffer, spheres.byteOffset, spheres.byteLength)
  }

  /** Records the cull pass. Call once per frame before the render pass. */
  cull (encoder: GPUCommandEncoder, viewProj: THREE.Matrix4, params: CullParams) {
    writeFrustumPlanes(viewProj, this.uniformData)
    writeDepthPlane(viewProj, this.uniformData, DEPTH_PLANE_FLOAT)
    this.info[2] = params.frustum ? 1 : 0
    this.info[3] = params.pyramid ? 1 : 0
    this.uniformData[LIMITS_FLOAT] = pixelsPerUnitAtUnitDepth(viewProj, params.viewportHeight)
    this.uniformData[LIMITS_FLOAT + 1] = params.minPixels
    this.uniformData[LIMITS_FLOAT + 2] = params.pyramid?.width ?? 1
    this.uniformData[LIMITS_FLOAT + 3] = params.pyramid?.height ?? 1
    this.uniformData.set(viewProj.elements, VIEW_PROJ_FLOAT)
    this.device.queue.writeBuffer(this.uniform, 0, this.uniformData)

    // Rebound only when the pyramid texture changes, e.g. after a resize.
    if (params.pyramid?.view !== this.boundPyramid) {
      this.boundPyramid = params.pyramid?.view
      this.bindGroup = this.createBindGroup(params.pyramid?.view ?? this.dummyView)
    }
    this.device.queue.writeBuffer(this.counts, 0, this.zeros)

    const pass = encoder.beginComputePass({ label: 'cull' })
    pass.setPipeline(this.pipeline)
    pass.setBindGroup(0, this.bindGroup)
    pass.dispatchWorkgroups(this.groups)
    pass.end()

    if (!this.reading) encoder.copyBufferToBuffer(this.counts, 0, this.readback, 0, COUNTS_BYTES)
  }

  /** Draw counts from a recent frame: opaque then transparent. Lags by a frame or two. */
  get drawnCounts (): [number, number] { return this.lastCounts }

  /** Starts an asynchronous read of the counters. Safe to call every frame. */
  pollCounts () {
    if (this.reading) return
    this.reading = true
    this.readback.mapAsync(GPUMapMode.READ).then(() => {
      const view = new Uint32Array(this.readback.getMappedRange().slice(0))
      this.lastCounts = [view[0], view[1]]
      this.readback.unmap()
      this.reading = false
    }).catch(() => { this.reading = false })
  }

  dispose () {
    for (const b of [this.spheres, this.visible, this.counts, this.readback, this.uniform]) {
      b.destroy()
    }
    this.dummyPyramid.destroy()
  }
}

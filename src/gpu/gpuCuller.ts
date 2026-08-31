/// <reference path="./webgpuMultiDraw.d.ts" />
import * as THREE from 'three'
import { createBuffer, createEmptyBuffer } from './gpuBuffers'
import { cullShader } from './shaders/cullShader'
import { writeFrustumPlanes } from './frustum'
import { pixelsPerUnitAtUnitDepth, writeDepthPlane } from './screenSize'
import { GpuScene, instanceCount } from './gpuScene'

const CULL_UNIFORM_BYTES = 144 // six planes, a uvec4 of counts, a depth plane and the limits
const DEPTH_PLANE_FLOAT = 28 // byte 112
const LIMITS_FLOAT = 32 // byte 128
const WORKGROUP_SIZE = 64
const COUNTS_BYTES = 8 // one u32 per draw range

/** What the cull pass should test this frame. */
export type CullParams = {
    /** Test each bounding sphere against the frustum planes. */
    frustum: boolean;
    /** Drop instances projecting to less than this many pixels across. Zero disables. */
    minPixels: number;
    /** Viewport height in device pixels, which sets the scale of `minPixels`. */
    viewportHeight: number;
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
  private readonly bindGroup: GPUBindGroup
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

    this.bindGroup = device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniform } },
        { binding: 1, resource: { buffer: this.spheres } },
        { binding: 2, resource: { buffer: source } },
        { binding: 3, resource: { buffer: this.visible } },
        { binding: 4, resource: { buffer: this.counts } }
      ]
    })
  }

  /** Records the cull pass. Call once per frame before the render pass. */
  cull (encoder: GPUCommandEncoder, viewProj: THREE.Matrix4, params: CullParams) {
    writeFrustumPlanes(viewProj, this.uniformData)
    writeDepthPlane(viewProj, this.uniformData, DEPTH_PLANE_FLOAT)
    this.info[2] = params.frustum ? 1 : 0
    this.uniformData[LIMITS_FLOAT] = pixelsPerUnitAtUnitDepth(viewProj, params.viewportHeight)
    this.uniformData[LIMITS_FLOAT + 1] = params.minPixels
    this.device.queue.writeBuffer(this.uniform, 0, this.uniformData)
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
  }
}
